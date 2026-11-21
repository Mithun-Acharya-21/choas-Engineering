import { describe, expect, it } from 'vitest';
import {
  isAllowedSandboxNamespace,
  isControlPlaneTarget,
  validateExperimentSafety,
} from '../src/features/chaos/safetyGuardrails';
import { ClusterId, ServiceNode } from '../src/types';

describe('Safety Guardrails & Sandbox Target Restrictions', () => {
  it('allows valid sandbox namespaces', () => {
    expect(isAllowedSandboxNamespace('sandbox-checkout')).toBe(true);
    expect(isAllowedSandboxNamespace('sandbox-payments')).toBe(true);
    expect(isAllowedSandboxNamespace('sandbox-tenant1-sbx891')).toBe(true);
  });

  it('strictly blocks production, system, and default namespaces', () => {
    expect(isAllowedSandboxNamespace('default')).toBe(false);
    expect(isAllowedSandboxNamespace('kube-system')).toBe(false);
    expect(isAllowedSandboxNamespace('kube-public')).toBe(false);
    expect(isAllowedSandboxNamespace('chaos-control-plane')).toBe(false);
    expect(isAllowedSandboxNamespace('prod-payments')).toBe(false);
    expect(isAllowedSandboxNamespace('settlement-pci')).toBe(false);
    expect(isAllowedSandboxNamespace('commerce-mesh')).toBe(false);
  });

  it('identifies and blocks control plane infrastructure targets', () => {
    const controlPlaneSvc: ServiceNode = {
      id: 'cp-api',
      name: 'chaos-api-server',
      namespace: 'chaos-control-plane',
      cluster: 'sandbox-alpha-us-east-1',
      tier: 'compute',
      status: 'healthy',
      rps: 100,
      baseRps: 100,
      p50Ms: 5,
      p95Ms: 15,
      p99Ms: 25,
      baseP99Ms: 25,
      errorRatePct: 0,
      baseErrorRatePct: 0,
      cpuPct: 20,
      memoryPct: 30,
      sloBudgetRemainingPct: 100,
      podsReady: 2,
      podsTotal: 2,
      version: 'v1.0.0',
      cidr: '10.42.0.0/24',
      position: { x: 0, y: 0 },
      dependencies: [],
      isControlPlane: true,
    };

    expect(isControlPlaneTarget(controlPlaneSvc)).toBe(true);
  });

  it('validates experiment safety and flags non-sandbox clusters and high blast radius', () => {
    const validService: ServiceNode = {
      id: 'checkout-core',
      name: 'checkout-core',
      namespace: 'sandbox-checkout',
      cluster: 'sandbox-alpha-us-east-1',
      tier: 'compute',
      status: 'healthy',
      rps: 1000,
      baseRps: 1000,
      p50Ms: 10,
      p95Ms: 30,
      p99Ms: 50,
      baseP99Ms: 50,
      errorRatePct: 0.01,
      baseErrorRatePct: 0.01,
      cpuPct: 30,
      memoryPct: 40,
      sloBudgetRemainingPct: 99.5,
      podsReady: 4,
      podsTotal: 4,
      version: 'v1.0.0',
      cidr: '10.42.1.0/24',
      position: { x: 10, y: 10 },
      dependencies: [],
    };

    // Valid sandbox execution
    const validResult = validateExperimentSafety(validService, 'sandbox-alpha-us-east-1', 30);
    expect(validResult.errors.length).toBe(0);
    expect(validResult.isSandboxTarget).toBe(true);
    expect(validResult.isNamespaceAllowed).toBe(true);
    expect(validResult.warnings.length).toBe(0);

    // High blast radius triggers warning
    const highBlastResult = validateExperimentSafety(validService, 'sandbox-alpha-us-east-1', 75);
    expect(highBlastResult.errors.length).toBe(0);
    expect(highBlastResult.warnings.length).toBeGreaterThan(0);
    expect(highBlastResult.warnings[0]).toContain('High blast radius');

    // Invalid non-sandbox cluster triggers critical error
    const prodResult = validateExperimentSafety(validService, 'prod-us-east-1' as unknown as ClusterId, 20);
    expect(prodResult.errors.length).toBeGreaterThan(0);
    expect(prodResult.errors[0]).toContain('not a designated sandbox cluster');
  });
});
