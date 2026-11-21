import { ChaosSafetyValidation, ClusterId, ServiceNode } from '../../types';

/**
 * Validates that a namespace is an approved sandbox namespace.
 * Under no circumstances may an experiment target production, default, or control-plane namespaces.
 */
export function isAllowedSandboxNamespace(namespace: string): boolean {
  if (!namespace) return false;
  const lower = namespace.trim().toLowerCase();
  // Strictly enforce sandbox namespace prefix
  if (!lower.startsWith('sandbox-')) return false;

  // Explicitly deny protected system and control plane namespaces
  const forbiddenPrefixes = ['kube-', 'chaos-control-', 'prod-', 'istio-', 'monitoring-'];
  if (forbiddenPrefixes.some((p) => lower.startsWith(p))) return false;

  const forbiddenNamespaces = ['default', 'kube-system', 'kube-public', 'kube-node-lease', 'chaos-control-plane'];
  if (forbiddenNamespaces.includes(lower)) return false;

  return true;
}

/**
 * Checks whether a given service or namespace represents the platform control plane.
 * Control plane workloads must never be targeted by chaos experiments.
 */
export function isControlPlaneTarget(service: ServiceNode): boolean {
  if (service.isControlPlane) return true;
  const lowerName = service.name.toLowerCase();
  const lowerNs = service.namespace.toLowerCase();

  const controlPlaneIdentifiers = [
    'chaos-api',
    'control-plane',
    'celery-worker',
    'postgres-primary',
    'redis-broker',
    'otel-collector',
  ];

  if (controlPlaneIdentifiers.some((id) => lowerName.includes(id))) {
    // If it's labeled control-plane or in control-plane namespace, block it
    return lowerNs === 'chaos-control-plane' || lowerNs === 'kube-system';
  }

  return false;
}

/**
 * Comprehensive safety validation before launching a chaos experiment.
 * Note: Frontend safety validation is defense-in-depth only.
 * The backend authorization and admission controller enforce the authoritative security boundary.
 */
export function validateExperimentSafety(
  targetService: ServiceNode,
  cluster: ClusterId,
  blastRadiusPct: number
): ChaosSafetyValidation {
  const warnings: string[] = [];
  const errors: string[] = [];

  const isSandboxTarget = cluster.startsWith('sandbox-');
  if (!isSandboxTarget) {
    errors.push(`CRITICAL: Cluster '${cluster}' is not a designated sandbox cluster.`);
  }

  const isNamespaceAllowed = isAllowedSandboxNamespace(targetService.namespace);
  if (!isNamespaceAllowed) {
    errors.push(
      `SECURITY VIOLATION: Namespace '${targetService.namespace}' is not an authorized sandbox namespace (must start with 'sandbox-').`
    );
  }

  const isControlPlane = isControlPlaneTarget(targetService);
  if (isControlPlane) {
    errors.push(
      `GUARDRAIL BLOCKED: Service '${targetService.name}' is identified as control plane infrastructure and cannot be targeted.`
    );
  }

  if (blastRadiusPct > 50) {
    warnings.push(`High blast radius (${blastRadiusPct}%). Requires explicit operator confirmation.`);
  }

  return {
    isSandboxTarget,
    isControlPlaneProtected: !isControlPlane,
    isNamespaceAllowed,
    warnings,
    errors,
  };
}
