"""Deterministic Multi-Factor Root Cause Analysis Scoring Engine (Milestone M8)."""

from datetime import datetime, timezone
import math
from typing import Any, Dict, List, Optional, Set, Tuple

from backend.app.domains.incident.models import IncidentEvidencePackage, IncidentRecord
from backend.app.domains.observability.models import (
    DistributedTrace,
    MetricPoint,
    ServiceHealthStatus,
    StructuredLogEntry,
    TimeSeriesMetric,
    TraceSpan,
)
from backend.app.domains.rca.graph import DependencyGraphAnalyzer
from backend.app.domains.rca.models import (
    ConfidenceClassification,
    RCAAnalysisStatus,
    RCACandidate,
    RCADependencyPath,
    RCAEvidence,
    RCAEvidenceType,
    RCAExecutionMetadata,
    RCAFactor,
    RCAFactorType,
)

DEFAULT_ALGORITHM_VERSION = "v1.0.0-deterministic"

# Configurable Normalized Weights (sum to 1.0)
DEFAULT_WEIGHTS: Dict[RCAFactorType, float] = {
    RCAFactorType.SPAN_LATENCY_CONTRIBUTION: 0.25,
    RCAFactorType.TEMPORAL_PRECEDENCE: 0.20,
    RCAFactorType.METRIC_ANOMALY_MAGNITUDE: 0.15,
    RCAFactorType.TOPOLOGY_DEPENDENCY_DEPTH: 0.15,
    RCAFactorType.EXPERIMENT_ALIGNMENT: 0.15,
    RCAFactorType.LOG_SEVERITY_CONCENTRATION: 0.10,
}


class DeterministicRCAEngine:
    """Evaluates multi-modal telemetry and topology to deterministically rank root cause candidates."""

    def __init__(
        self,
        weights: Optional[Dict[RCAFactorType, float]] = None,
        algorithm_version: str = DEFAULT_ALGORITHM_VERSION,
    ):
        self.weights = weights or DEFAULT_WEIGHTS
        self.algorithm_version = algorithm_version

    def analyze(
        self,
        incident: IncidentRecord,
        graph_analyzer: Optional[DependencyGraphAnalyzer] = None,
        metrics: Optional[List[TimeSeriesMetric]] = None,
        traces: Optional[List[DistributedTrace]] = None,
        logs: Optional[List[StructuredLogEntry]] = None,
        health: Optional[List[ServiceHealthStatus]] = None,
        active_experiment: Optional[Dict[str, Any]] = None,
    ) -> Tuple[RCAAnalysisStatus, List[RCACandidate], Optional[RCACandidate], List[RCACandidate], List[RCADependencyPath], List[RCAEvidence], List[str], RCAExecutionMetadata]:
        start_time = datetime.now(timezone.utc)
        graph = graph_analyzer or DependencyGraphAnalyzer.from_e_commerce_default()
        missing_warnings: List[str] = []
        evidence_items: List[RCAEvidence] = []

        # 1. Telemetry Completeness & Freshness Check
        if not metrics and not traces and not logs and not incident.evidence_package.metric_snapshots:
            missing_warnings.append("No metric, trace, or log telemetry available for analysis.")
            return (
                RCAAnalysisStatus.INSUFFICIENT_EVIDENCE,
                [],
                None,
                [],
                [],
                [],
                missing_warnings,
                RCAExecutionMetadata(
                    algorithm_version=self.algorithm_version,
                    telemetry_freshness="STALE",
                    evaluated_at=datetime.now(timezone.utc),
                ),
            )

        if incident.evidence_package.telemetry_freshness == "STALE":
            missing_warnings.append("Incident evidence package telemetry is marked STALE (>300s old).")

        # 2. Extract service observations
        services_observed = set(graph.nodes.keys())
        if incident.primary_affected_service:
            services_observed.add(incident.primary_affected_service)
        for s in incident.related_affected_services:
            services_observed.add(s)

        # Build Span Waterfall Analysis (Exclusive self-duration)
        exclusive_durations: Dict[str, float] = {}
        span_counts: Dict[str, int] = {}
        trace_spans_evaluated = 0

        if traces:
            for trace in traces:
                for span in trace.spans:
                    trace_spans_evaluated += 1
                    span_counts[span.service] = span_counts.get(span.service, 0) + 1
                    # Find child spans
                    child_duration = sum(
                        c.duration_ms for c in trace.spans if c.parent_span_id == span.id
                    )
                    self_dur = max(0.0, span.duration_ms - child_duration)
                    exclusive_durations[span.service] = max(
                        exclusive_durations.get(span.service, 0.0), self_dur
                    )
                    if span.status == "error" or span.duration_ms > 500.0:
                        evidence_items.append(
                            RCAEvidence(
                                evidence_type=RCAEvidenceType.TRACE_LATENCY_SPIKE,
                                service_id=span.service,
                                timestamp=span.start_time if hasattr(span, "start_time") else start_time,
                                details={
                                    "span_id": span.id,
                                    "trace_id": span.trace_id,
                                    "duration_ms": span.duration_ms,
                                    "exclusive_duration_ms": round(self_dur, 2),
                                    "status": span.status,
                                },
                                source_reference=f"jaeger:{span.trace_id}:{span.id}",
                            )
                        )
        else:
            missing_warnings.append("Distributed traces unavailable; relying on PromQL snapshots.")

        # Build Metric Anomaly Map
        metric_anomalies: Dict[str, float] = {}
        error_rates: Dict[str, float] = {}
        metrics_evaluated = 0

        # Ingest from M7 evidence package
        if incident.evidence_package.metric_snapshots:
            primary_svc = incident.primary_affected_service
            p99 = float(incident.evidence_package.metric_snapshots.get("p99", 0.0))
            err_rt = float(incident.evidence_package.metric_snapshots.get("error_rate", 0.0))
            if p99 > 100.0:
                metric_anomalies[primary_svc] = p99
            if err_rt > 0.0:
                error_rates[primary_svc] = err_rt
            evidence_items.append(
                RCAEvidence(
                    evidence_type=RCAEvidenceType.METRIC_ANOMALY,
                    service_id=primary_svc,
                    timestamp=incident.last_detected_at,
                    details=incident.evidence_package.metric_snapshots,
                    source_reference="prometheus:m7_evidence_package",
                )
            )

        if metrics:
            for ts in metrics:
                metrics_evaluated += len(ts.points)
                if ts.points:
                    latest = ts.points[-1]
                    baseline = max(10.0, latest.baseline_p99)
                    ratio = (latest.p99 - baseline) / baseline
                    metric_anomalies[ts.service_id] = max(
                        metric_anomalies.get(ts.service_id, 0.0), ratio
                    )
                    error_rates[ts.service_id] = max(
                        error_rates.get(ts.service_id, 0.0), latest.error_rate
                    )

        # Build Log Severity Concentration Map
        log_errors: Dict[str, int] = {}
        if logs:
            for log_entry in logs:
                if log_entry.level in ("CRIT", "ERROR", "WARN"):
                    log_errors[log_entry.service] = log_errors.get(log_entry.service, 0) + 1
                    evidence_items.append(
                        RCAEvidence(
                            evidence_type=RCAEvidenceType.LOG_ERROR_EVENT,
                            service_id=log_entry.service,
                            timestamp=log_entry.timestamp if hasattr(log_entry, "timestamp") else start_time,
                            details={"level": log_entry.level, "message": log_entry.message[:120]},
                            source_reference=f"loki:{log_entry.id}",
                        )
                    )

        # Calculate Topological Causal Depths
        causal_depths = graph.calculate_causal_depths()
        max_depth = max(causal_depths.values()) if causal_depths else 1

        # Check Active Chaos Experiment Alignment
        exp_target = None
        exp_active = False
        anomaly_preceded_experiment = False

        if active_experiment and active_experiment.get("status") == "RUNNING":
            exp_target = active_experiment.get("target_service")
            exp_active = True
            # Verify timing relative to incident start
            if incident.evidence_package.started_relative_to_experiment == "before":
                anomaly_preceded_experiment = True
                missing_warnings.append(
                    f"Warning: Incident anomaly began BEFORE experiment {active_experiment.get('id')} started. Reducing experiment alignment weight."
                )

            evidence_items.append(
                RCAEvidence(
                    evidence_type=RCAEvidenceType.CHAOS_FAULT_INJECTION,
                    service_id=exp_target or "unknown",
                    timestamp=start_time,
                    details=active_experiment,
                    source_reference=f"chaos:{active_experiment.get('id', 'exp-unknown')}",
                )
            )
        elif incident.related_experiment_id:
            exp_target = incident.primary_affected_service
            exp_active = True

        # 3. Generate and Score Candidates
        candidate_scores: List[RCACandidate] = []

        for svc_id in services_observed:
            node = graph.nodes.get(svc_id)
            node_name = node.name if node else svc_id.replace("-", " ").title()
            node_type = node.node_type.value if node else "app_service"

            # Check if this service had any degradation or observations
            has_metric_anomaly = svc_id in metric_anomalies or svc_id in error_rates
            has_trace_delay = svc_id in exclusive_durations
            has_logs = svc_id in log_errors
            is_exp_target = svc_id == exp_target

            # Skip services that showed zero anomalies and are not involved
            if not has_metric_anomaly and not has_trace_delay and not has_logs and not is_exp_target:
                continue

            factors: List[RCAFactor] = []
            supporting_ev: List[str] = []
            contradicting_ev: List[str] = []

            # Factor 1: Span Latency Contribution (Self-Duration)
            self_dur = exclusive_durations.get(svc_id, 0.0)
            if self_dur > 0.0:
                # Normalize 0 - 2000ms -> 0.0 to 1.0
                norm_span = min(1.0, self_dur / 1500.0)
                supporting_ev.append(f"Trace analysis reveals {self_dur:.1f}ms exclusive self-duration.")
            elif svc_id == incident.primary_affected_service and incident.evidence_package.metric_snapshots.get("p99", 0) > 400:
                # Latency surge proxy from M7
                norm_span = min(1.0, float(incident.evidence_package.metric_snapshots.get("p99")) / 1000.0)
                supporting_ev.append(f"Telemetry reports elevated P99 latency ({incident.evidence_package.metric_snapshots.get('p99')}ms).")
            else:
                norm_span = 0.05
                contradicting_ev.append("Low exclusive self-duration in trace waterfall; waiting on downstream dependencies.")

            w_span = self.weights[RCAFactorType.SPAN_LATENCY_CONTRIBUTION]
            factors.append(
                RCAFactor(
                    factor_type=RCAFactorType.SPAN_LATENCY_CONTRIBUTION,
                    raw_value=round(self_dur, 2),
                    normalized_score=round(norm_span, 3),
                    weight=w_span,
                    weighted_score=round(norm_span * w_span * 100.0, 2),
                    explanation=f"Exclusive internal latency: {self_dur:.1f}ms",
                )
            )

            # Factor 2: Temporal Precedence
            # Services that degraded first receive highest precedence
            if svc_id == incident.primary_affected_service:
                norm_time = 0.95
                supporting_ev.append("Earliest observed SLO violation timestamp recorded on this service.")
            elif svc_id in incident.related_affected_services:
                norm_time = 0.40
                contradicting_ev.append("Degradation appeared subsequent to downstream caller failure.")
            else:
                norm_time = 0.20

            w_time = self.weights[RCAFactorType.TEMPORAL_PRECEDENCE]
            factors.append(
                RCAFactor(
                    factor_type=RCAFactorType.TEMPORAL_PRECEDENCE,
                    raw_value=norm_time,
                    normalized_score=round(norm_time, 3),
                    weight=w_time,
                    weighted_score=round(norm_time * w_time * 100.0, 2),
                    explanation="Temporal anomaly onset sequence",
                )
            )

            # Factor 3: Metric Anomaly Magnitude
            err_rt = error_rates.get(svc_id, 0.0)
            norm_anomaly = min(1.0, (metric_anomalies.get(svc_id, 0.0) / 10.0) + (err_rt / 20.0))
            if norm_anomaly > 0.3:
                supporting_ev.append(f"Metric anomaly detected: error rate {err_rt:.1f}%, latency surge.")
            else:
                contradicting_ev.append("Metrics remained within baseline variance thresholds.")

            w_anom = self.weights[RCAFactorType.METRIC_ANOMALY_MAGNITUDE]
            factors.append(
                RCAFactor(
                    factor_type=RCAFactorType.METRIC_ANOMALY_MAGNITUDE,
                    raw_value=round(norm_anomaly, 2),
                    normalized_score=round(norm_anomaly, 3),
                    weight=w_anom,
                    weighted_score=round(norm_anomaly * w_anom * 100.0, 2),
                    explanation=f"Anomaly magnitude (err_rate={err_rt}%)",
                )
            )

            # Factor 4: Topology Dependency Depth
            # Deeper downstream services are initiating targets, not collateral callers
            depth = causal_depths.get(svc_id, 0)
            norm_depth = min(1.0, (depth + 1) / max(1, max_depth + 1))
            if depth >= 2:
                supporting_ev.append(f"Topology position: downstream dependency at depth {depth}.")
            else:
                contradicting_ev.append(f"Topology position: upstream caller (depth {depth}); prone to collateral symptom propagation.")

            w_depth = self.weights[RCAFactorType.TOPOLOGY_DEPENDENCY_DEPTH]
            factors.append(
                RCAFactor(
                    factor_type=RCAFactorType.TOPOLOGY_DEPENDENCY_DEPTH,
                    raw_value=float(depth),
                    normalized_score=round(norm_depth, 3),
                    weight=w_depth,
                    weighted_score=round(norm_depth * w_depth * 100.0, 2),
                    explanation=f"Graph dependency depth: {depth}",
                )
            )

            # Factor 5: Experiment Alignment
            if is_exp_target:
                if anomaly_preceded_experiment:
                    norm_exp = 0.30  # Heavily penalized because anomaly preceded experiment
                    contradicting_ev.append("Anomaly preceded experiment start time; experiment causality penalized.")
                else:
                    norm_exp = 0.95
                    supporting_ev.append(f"Active chaos experiment target ({active_experiment.get('fault_type', 'LATENCY') if active_experiment else 'LATENCY'}).")
            else:
                norm_exp = 0.10

            w_exp = self.weights[RCAFactorType.EXPERIMENT_ALIGNMENT]
            factors.append(
                RCAFactor(
                    factor_type=RCAFactorType.EXPERIMENT_ALIGNMENT,
                    raw_value=norm_exp,
                    normalized_score=round(norm_exp, 3),
                    weight=w_exp,
                    weighted_score=round(norm_exp * w_exp * 100.0, 2),
                    explanation="Chaos experiment correlation factor",
                )
            )

            # Factor 6: Log Severity Concentration
            err_count = log_errors.get(svc_id, 0)
            norm_log = min(1.0, err_count / 5.0)
            if err_count > 0:
                supporting_ev.append(f"Structured logs contain {err_count} CRITICAL/ERROR events.")

            w_log = self.weights[RCAFactorType.LOG_SEVERITY_CONCENTRATION]
            factors.append(
                RCAFactor(
                    factor_type=RCAFactorType.LOG_SEVERITY_CONCENTRATION,
                    raw_value=float(err_count),
                    normalized_score=round(norm_log, 3),
                    weight=w_log,
                    weighted_score=round(norm_log * w_log * 100.0, 2),
                    explanation=f"Error log count: {err_count}",
                )
            )

            # Sum total score (0.0 to 100.0)
            total_score = round(sum(f.weighted_score for f in factors), 1)

            # Assign recommended next actions
            actions = [
                f"Inspect container logs and thread dumps for {svc_id}.",
                f"Verify outbound network socket connection pools for {svc_id}.",
            ]
            if is_exp_target:
                actions.insert(0, f"Halt active chaos experiment on {svc_id} and observe recovery.")

            # Identify affected upstream paths
            affected_paths = [
                f"{caller} -> {svc_id}"
                for caller in graph.get_transitive_upstream_callers(svc_id)
            ]

            candidate_scores.append(
                RCACandidate(
                    service_id=svc_id,
                    service_name=node_name,
                    node_type=node_type,
                    score=total_score,
                    factors=factors,
                    supporting_evidence=supporting_ev,
                    contradicting_evidence=contradicting_ev,
                    affected_paths=affected_paths,
                    recommended_actions=actions,
                )
            )

        # If no candidates scored, return INSUFFICIENT_EVIDENCE
        if not candidate_scores:
            missing_warnings.append("Insufficient anomaly signal across all topology nodes.")
            return (
                RCAAnalysisStatus.INSUFFICIENT_EVIDENCE,
                [],
                None,
                [],
                [],
                evidence_items,
                missing_warnings,
                RCAExecutionMetadata(
                    algorithm_version=self.algorithm_version,
                    telemetry_freshness="FRESH",
                    evaluated_at=datetime.now(timezone.utc),
                ),
            )

        # 4. Rank Candidates by Score Descending
        candidate_scores.sort(key=lambda c: c.score, reverse=True)

        # Primary Cause vs Collateral Symptoms Classification
        primary_candidate = candidate_scores[0]
        primary_candidate.is_primary_cause = True

        # Confidence Classification based on score and delta over #2
        score_gap = primary_candidate.score - (candidate_scores[1].score if len(candidate_scores) > 1 else 0.0)
        if primary_candidate.score >= 70.0 and score_gap >= 15.0 and not anomaly_preceded_experiment:
            primary_candidate.confidence = ConfidenceClassification.HIGH
        elif primary_candidate.score >= 50.0:
            primary_candidate.confidence = ConfidenceClassification.MEDIUM
        elif score_gap < 5.0:
            primary_candidate.confidence = ConfidenceClassification.INCONCLUSIVE
        else:
            primary_candidate.confidence = ConfidenceClassification.LOW

        collateral_symptoms: List[RCACandidate] = []
        for c in candidate_scores[1:]:
            c.is_collateral_symptom = True
            c.confidence = ConfidenceClassification.LOW
            collateral_symptoms.append(c)

        # 5. Compute Failure Propagation Paths
        affected_set = {c.service_id for c in candidate_scores}
        propagation_paths = graph.trace_failure_propagation(
            fault_origin_service=primary_candidate.service_id,
            degraded_services=affected_set,
            latency_map=exclusive_durations,
        )

        exec_duration_ms = (datetime.now(timezone.utc) - start_time).total_seconds() * 1000.0

        metadata = RCAExecutionMetadata(
            algorithm_version=self.algorithm_version,
            execution_duration_ms=round(exec_duration_ms, 2),
            evaluated_services_count=len(services_observed),
            evaluated_spans_count=trace_spans_evaluated,
            evaluated_metrics_count=metrics_evaluated,
            telemetry_freshness=incident.evidence_package.telemetry_freshness,
            evaluated_at=datetime.now(timezone.utc),
        )

        return (
            RCAAnalysisStatus.COMPLETED,
            candidate_scores,
            primary_candidate,
            collateral_symptoms,
            propagation_paths,
            evidence_items,
            missing_warnings,
            metadata,
        )
