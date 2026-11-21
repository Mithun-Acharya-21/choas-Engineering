import { beforeEach, describe, expect, it } from 'vitest';
import { MockTelemetryService } from '../src/services/mock/mockTelemetryService';

describe('Experiment State Transitions & Lifecycle', () => {
  let service: MockTelemetryService;

  beforeEach(() => {
    service = new MockTelemetryService();
  });

  it('starts with initialized sandbox experiments', () => {
    const experiments = service.getExperiments();
    expect(experiments.length).toBeGreaterThan(0);
    expect(experiments.every((e) => e.cluster.startsWith('sandbox-'))).toBe(true);
  });

  it('transitions experiment state to running when launched', () => {
    const exp = service.launchExperiment({
      name: 'test-latency-injection',
      targetServiceId: 'checkout-core',
      faultType: 'latency',
      magnitude: 200,
      blastRadiusPct: 30,
      durationSec: 60,
      hypothesis: 'Verification test',
    });

    expect(exp.status).toBe('running');
    expect(exp.remainingSec).toBe(60);
    expect(exp.targetNamespace).toBe('sandbox-checkout');

    const running = service.getExperiments().filter((e) => e.status === 'running');
    expect(running.some((e) => e.id === exp.id)).toBe(true);
  });

  it('decrements remaining seconds on tick and completes when timer reaches zero', () => {
    const exp = service.launchExperiment({
      name: 'short-timer-exp',
      targetServiceId: 'checkout-core',
      faultType: 'latency',
      magnitude: 100,
      blastRadiusPct: 20,
      durationSec: 2, // 2 seconds duration
      hypothesis: 'Short timer test',
    });

    expect(exp.status).toBe('running');

    // 1 tick (2 seconds)
    const state = service.tick();
    const updatedExp = state.experiments.find((e) => e.id === exp.id);
    expect(updatedExp).toBeDefined();
    expect(updatedExp?.status).toBe('completed');
    expect(updatedExp?.remainingSec).toBe(0);
  });

  it('halts experiment manually and sets remainingSec to 0', () => {
    const exp = service.launchExperiment({
      name: 'manual-halt-exp',
      targetServiceId: 'auth-service',
      faultType: 'packet_loss',
      magnitude: 10,
      blastRadiusPct: 25,
      durationSec: 300,
      hypothesis: 'Manual halt test',
    });

    expect(exp.status).toBe('running');
    const success = service.haltExperiment(exp.id);
    expect(success).toBe(true);

    const haltedExp = service.getExperiments().find((e) => e.id === exp.id);
    expect(haltedExp?.status).toBe('halted');
    expect(haltedExp?.remainingSec).toBe(0);
  });
});
