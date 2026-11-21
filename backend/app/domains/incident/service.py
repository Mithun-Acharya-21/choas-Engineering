"""Incident Management Service, Lifecycle State Machine, and Dependency Correlator (Milestone M7)."""

import hashlib
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple
from uuid import UUID, uuid4

from backend.app.domains.incident.detection import (
    DetectionEngine,
)
from backend.app.domains.incident.models import (
    IncidentEvidencePackage,
    IncidentLifecycleEvent,
    IncidentRecord,
    IncidentSeverity,
    IncidentStatus,
)
from backend.app.domains.observability.engine import (
    observability_service,
)

logger = logging.getLogger(__name__)

# In-memory persistence tables for incidents and event history
_INCIDENT_DB: Dict[UUID, IncidentRecord] = {}
_INCIDENT_TIMELINES: Dict[UUID, List[IncidentLifecycleEvent]] = {}
_CONSECUTIVE_BREACH_CACHE: Dict[str, int] = {}

# Valid state transition matrix
VALID_TRANSITIONS: Dict[IncidentStatus, List[IncidentStatus]] = {
    IncidentStatus.OPEN: [IncidentStatus.ACKNOWLEDGED, IncidentStatus.INVESTIGATING, IncidentStatus.RESOLVED],
    IncidentStatus.ACKNOWLEDGED: [IncidentStatus.INVESTIGATING, IncidentStatus.RESOLVED],
    IncidentStatus.INVESTIGATING: [IncidentStatus.RESOLVED],
    IncidentStatus.RESOLVED: [IncidentStatus.CLOSED, IncidentStatus.OPEN],  # Reopening generates explicit event
    IncidentStatus.CLOSED: [IncidentStatus.OPEN],  # Reopening generates explicit event
}


class IncidentService:
    """Manages incident lifecycle, deduplication, topology dependency correlation, and evidence packages."""

    def __init__(self, detection_engine: Optional[DetectionEngine] = None):
        self.detection = detection_engine or DetectionEngine()

    @staticmethod
    def generate_fingerprint(sandbox_id: UUID, service: str, rule_family: str) -> str:
        """Generates deterministic sha256 fingerprint for deduplicating recurring alert signals."""
        raw = f"{sandbox_id}:{service}:{rule_family}"
        return hashlib.sha256(raw.encode()).hexdigest()[:16]

    def list_incidents(
        self,
        tenant_id: UUID,
        sandbox_id: Optional[UUID] = None,
        status: Optional[IncidentStatus] = None,
        severity: Optional[IncidentSeverity] = None,
        service: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> Tuple[List[IncidentRecord], int]:
        """Lists incidents filtered by tenant boundary and optional dimensions."""
        results: List[IncidentRecord] = []
        for inc in _INCIDENT_DB.values():
            if inc.tenant_id != tenant_id:
                continue
            if sandbox_id and inc.sandbox_id != sandbox_id:
                continue
            if status and inc.status != status:
                continue
            if severity and inc.severity != severity:
                continue
            if service and inc.primary_affected_service != service and service not in inc.related_affected_services:
                continue
            results.append(inc)

        # Sort newest first
        results.sort(key=lambda x: x.last_detected_at, reverse=True)
        total = len(results)
        return results[offset : offset + limit], total

    def get_incident(self, incident_id: UUID, tenant_id: UUID) -> IncidentRecord:
        """Retrieves an incident verifying strict tenant ownership."""
        inc = _INCIDENT_DB.get(incident_id)
        if not inc or inc.tenant_id != tenant_id:
            raise KeyError(f"Incident '{incident_id}' not found in active tenant.")
        return inc

    def get_incident_timeline(self, incident_id: UUID, tenant_id: UUID) -> List[IncidentLifecycleEvent]:
        """Retrieves immutable audit timeline of incident lifecycle state transitions."""
        self.get_incident(incident_id, tenant_id)
        return _INCIDENT_TIMELINES.get(incident_id, [])

    def transition_incident(
        self,
        incident_id: UUID,
        tenant_id: UUID,
        target_status: IncidentStatus,
        user_id: str,
        note: Optional[str] = None,
    ) -> IncidentRecord:
        """Executes a validated lifecycle transition and records an immutable event."""
        inc = self.get_incident(incident_id, tenant_id)
        now = datetime.now(timezone.utc)

        # Validate allowed transition
        allowed = VALID_TRANSITIONS.get(inc.status, [])
        if target_status not in allowed:
            raise ValueError(
                f"Invalid lifecycle transition: cannot move incident from {inc.status} to {target_status}."
            )

        prev_status = inc.status
        inc.status = target_status
        inc.updated_at = now

        # Record specific timestamps
        if target_status == IncidentStatus.ACKNOWLEDGED and not inc.acknowledged_at:
            inc.acknowledged_at = now
            inc.assigned_user = user_id
        elif target_status == IncidentStatus.RESOLVED and not inc.resolved_at:
            inc.resolved_at = now
        elif target_status == IncidentStatus.CLOSED and not inc.closed_at:
            inc.closed_at = now

        # Append immutable audit event
        event = IncidentLifecycleEvent(
            incident_id=incident_id,
            from_status=prev_status,
            to_status=target_status,
            triggered_by=user_id,
            timestamp=now,
            note=note or f"Transitioned from {prev_status} to {target_status}",
        )
        _INCIDENT_TIMELINES.setdefault(incident_id, []).append(event)

        logger.info(f"Incident {incident_id} transitioned: {prev_status} -> {target_status} by {user_id}")
        return inc

    def correlate_topology_dependencies(self, primary_service: str) -> Tuple[List[str], List[str]]:
        """Uses microservice topology graph to determine upstream/downstream dependency paths."""
        # Standard e-commerce graph paths
        dependency_graph = {
            "payment-service": {
                "upstream": ["order-service", "api-gateway"],
                "downstream": ["orders-db", "stripe-psp"],
                "paths": [
                    "api-gateway -> order-service -> payment-service",
                    "payment-service -> stripe-psp (external)",
                ],
            },
            "order-service": {
                "upstream": ["api-gateway"],
                "downstream": ["payment-service", "orders-db", "inventory-service"],
                "paths": [
                    "api-gateway -> order-service",
                    "order-service -> payment-service",
                    "order-service -> orders-db",
                ],
            },
            "inventory-service": {
                "upstream": ["api-gateway", "order-service"],
                "downstream": ["redis-cache"],
                "paths": ["order-service -> inventory-service -> redis-cache"],
            },
            "api-gateway": {
                "upstream": [],
                "downstream": ["order-service", "inventory-service"],
                "paths": ["client -> api-gateway"],
            },
        }

        meta = dependency_graph.get(
            primary_service,
            {
                "upstream": ["api-gateway"],
                "downstream": [],
                "paths": [f"api-gateway -> {primary_service}"],
            },
        )
        return meta["upstream"], meta["paths"]

    def evaluate_sandbox_incidents(
        self,
        tenant_id: UUID,
        project_id: UUID,
        sandbox_id: UUID,
        active_experiment: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, int]:
        """Evaluates telemetry across all services in a sandbox, deduplicates, and manages incidents."""
        now = datetime.now(timezone.utc)
        metrics_list = observability_service.get_service_metrics(
            sandbox_id=str(sandbox_id),
            active_experiment=active_experiment,
        )
        health_list = observability_service.get_service_health(
            sandbox_id=str(sandbox_id),
            active_experiment=active_experiment,
        )
        health_map = {h.service_id: h for h in health_list}

        incidents_created = 0
        incidents_updated = 0
        incidents_resolved = 0
        rules_triggered_count = 0

        for time_series in metrics_list:
            if not time_series.points:
                continue

            svc_id = time_series.service_id
            latest_point = time_series.points[-1]
            health = health_map.get(svc_id)

            triggered_rules, recovered_rules, freshness = self.detection.evaluate_metric_point(
                service_id=svc_id,
                metric_point=latest_point,
                health_status=health,
                consecutive_breach_counts=_CONSECUTIVE_BREACH_CACHE,
            )

            # 1. Handle Triggered Alert Rules
            if triggered_rules:
                rules_triggered_count += len(triggered_rules)
                primary_rule = triggered_rules[0]
                fingerprint = self.generate_fingerprint(sandbox_id, svc_id, primary_rule.family.value)

                # Check if an existing open incident shares this fingerprint
                existing_inc = next(
                    (
                        inc
                        for inc in _INCIDENT_DB.values()
                        if inc.fingerprint == fingerprint
                        and inc.status in (IncidentStatus.OPEN, IncidentStatus.ACKNOWLEDGED, IncidentStatus.INVESTIGATING)
                    ),
                    None,
                )

                upstream_svcs, dep_paths = self.correlate_topology_dependencies(svc_id)

                if existing_inc:
                    # Deduplicate: update existing incident
                    existing_inc.last_detected_at = now
                    existing_inc.occurrence_count += 1
                    existing_inc.evidence_package.metric_snapshots[f"point_{now.strftime('%H%M%S')}"] = {
                        "p99": latest_point.p99,
                        "error_rate": latest_point.error_rate,
                        "rps": latest_point.rps,
                    }
                    existing_inc.evidence_package.telemetry_freshness = freshness
                    incidents_updated += 1
                else:
                    # Create new incident
                    inc_id = uuid4()
                    severity = IncidentSeverity.CRITICAL if any(r.severity == IncidentSeverity.CRITICAL for r in triggered_rules) else IncidentSeverity.WARNING

                    # Experiment correlation metadata
                    rel_exp_id = active_experiment.get("id") if active_experiment else None
                    fault_type = active_experiment.get("fault_type") if active_experiment else None
                    mag = active_experiment.get("magnitude") if active_experiment else None
                    timing = "during" if active_experiment else None

                    evidence = IncidentEvidencePackage(
                        metric_snapshots={
                            "breach_point": {
                                "p50": latest_point.p50,
                                "p95": latest_point.p95,
                                "p99": latest_point.p99,
                                "baseline_p99": latest_point.baseline_p99,
                                "error_rate": latest_point.error_rate,
                                "rps": latest_point.rps,
                            }
                        },
                        latency_change_pct=round(((latest_point.p99 - latest_point.baseline_p99) / max(1.0, latest_point.baseline_p99)) * 100.0, 1),
                        error_rate_pct=latest_point.error_rate,
                        service_health_status=health.status if health else "healthy",
                        trace_ids=["4bf92f3577b34da6a3ce929d0e0e4736"],
                        log_ids=["log-err-01", "log-err-02"],
                        topology_version=1,
                        affected_dependency_paths=dep_paths,
                        related_experiment_id=rel_exp_id,
                        experiment_fault_type=fault_type,
                        experiment_magnitude=mag,
                        started_relative_to_experiment=timing,
                        telemetry_freshness=freshness,
                    )

                    new_inc = IncidentRecord(
                        id=inc_id,
                        fingerprint=fingerprint,
                        tenant_id=tenant_id,
                        project_id=project_id,
                        sandbox_id=sandbox_id,
                        primary_affected_service=svc_id,
                        related_affected_services=upstream_svcs,
                        related_experiment_id=rel_exp_id,
                        title=f"{primary_rule.name} on {svc_id}",
                        description=f"Automated SLO violation: {primary_rule.metric_name} breached threshold {primary_rule.threshold} on {svc_id}.",
                        severity=severity,
                        status=IncidentStatus.OPEN,
                        detection_source="DETERMINISTIC_SLO_ENGINE",
                        triggered_rule_ids=[r.rule_id for r in triggered_rules],
                        first_detected_at=now,
                        last_detected_at=now,
                        occurrence_count=1,
                        evidence_package=evidence,
                        created_at=now,
                        updated_at=now,
                    )

                    _INCIDENT_DB[inc_id] = new_inc
                    _INCIDENT_TIMELINES[inc_id] = [
                        IncidentLifecycleEvent(
                            incident_id=inc_id,
                            from_status=None,
                            to_status=IncidentStatus.OPEN,
                            triggered_by="SYSTEM_DETECTION_ENGINE",
                            timestamp=now,
                            note=f"Automated incident created: {primary_rule.name}",
                        )
                    ]
                    incidents_created += 1

            # 2. Handle Recovery Evaluation (Auto-Resolution via Hysteresis)
            elif recovered_rules:
                for rule in recovered_rules:
                    fingerprint = self.generate_fingerprint(sandbox_id, svc_id, rule.family.value)
                    active_inc = next(
                        (
                            inc
                            for inc in _INCIDENT_DB.values()
                            if inc.fingerprint == fingerprint
                            and inc.status in (IncidentStatus.OPEN, IncidentStatus.ACKNOWLEDGED, IncidentStatus.INVESTIGATING)
                        ),
                        None,
                    )
                    if active_inc:
                        self.transition_incident(
                            incident_id=active_inc.id,
                            tenant_id=tenant_id,
                            target_status=IncidentStatus.RESOLVED,
                            user_id="SYSTEM_AUTO_RECOVERY",
                            note=f"Recovery threshold satisfied: {rule.metric_name} returned below {rule.recovery_threshold}",
                        )
                        incidents_resolved += 1

        return {
            "evaluated_services": len(metrics_list),
            "rules_triggered": rules_triggered_count,
            "incidents_created": incidents_created,
            "incidents_updated": incidents_updated,
            "incidents_resolved": incidents_resolved,
        }


# Global singleton instance
incident_service = IncidentService()
