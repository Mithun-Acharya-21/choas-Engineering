import { beforeEach, describe, expect, it } from 'vitest';
import { MockTelemetryService } from '../src/services/mock/mockTelemetryService';

describe('Emergency Kill Switch & Halt Behavior', () => {
  let service: MockTelemetryService;

  beforeEach(() => {
    service = new MockTelemetryService();
  });

  it('halts all active faults across the active sandbox cluster', () => {
    // Launch two experiments
    service.launchExperiment({
      name: 'exp-1',
      targetServiceId: 'checkout-core',
      faultType: 'latency',
      magnitude: 150,
      blastRadiusPct: 30,
      durationSec: 120,
      hypothesis: 'Kill switch test 1',
    });

    service.launchExperiment({
      name: 'exp-2',
      targetServiceId: 'payment-ledger',
      faultType: 'pod_kill',
      magnitude: 1,
      blastRadiusPct: 20,
      durationSec: 120,
      hypothesis: 'Kill switch test 2',
    });

    const initialRunning = service.getExperiments().filter((e) => e.status === 'running');
    expect(initialRunning.length).toBeGreaterThanOrEqual(2);

    // Trigger emergency kill switch
    const haltedCount = service.haltAllActiveFaults();
    expect(haltedCount).toBe(initialRunning.length);

    // Verify zero active faults remain
    const remainingRunning = service.getExperiments().filter((e) => e.status === 'running');
    expect(remainingRunning.length).toBe(0);

    // Verify recovery log was emitted
    const latestLog = service.getLogs()[0];
    expect(latestLog.message).toContain('EMERGENCY KILL SWITCH');
  });
});
