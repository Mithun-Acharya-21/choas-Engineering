import {
  ChaosExperiment,
  ClusterId,
  FaultType,
  LogEntry,
  ServiceNode,
  TelemetryPoint,
} from '../../types';
import {
  buildTraceSpans,
  CLUSTERS,
  FAULT_TYPE_META,
  generateInitialTelemetrySeries,
  INITIAL_EXPERIMENTS,
  INITIAL_LOGS,
  INITIAL_SERVICES,
} from './mockData';

export interface LaunchExperimentParams {
  name: string;
  targetServiceId: string;
  faultType: FaultType;
  magnitude: number;
  blastRadiusPct: number;
  durationSec: number;
  hypothesis: string;
}

export class MockTelemetryService {
  private services: ServiceNode[] = [...INITIAL_SERVICES];
  private experiments: ChaosExperiment[] = [...INITIAL_EXPERIMENTS];
  private series: TelemetryPoint[] = generateInitialTelemetrySeries();
  private logs: LogEntry[] = [...INITIAL_LOGS];
  private activeCluster: ClusterId = 'sandbox-alpha-us-east-1';
  private tickCount: number = 1;

  public getClusters() {
    return CLUSTERS;
  }

  public getActiveCluster(): ClusterId {
    return this.activeCluster;
  }

  public setActiveCluster(cluster: ClusterId) {
    this.activeCluster = cluster;
    this.services = this.services.map((s) => ({ ...s, cluster }));
  }

  public getServices(): ServiceNode[] {
    return [...this.services];
  }

  public getExperiments(): ChaosExperiment[] {
    return [...this.experiments];
  }

  public getTelemetrySeries(): TelemetryPoint[] {
    return [...this.series];
  }

  public getLogs(): LogEntry[] {
    return [...this.logs];
  }

  public clearLogs() {
    this.logs = [];
  }

  public launchExperiment(params: LaunchExperimentParams): ChaosExperiment {
    const svc = this.services.find((s) => s.id === params.targetServiceId) ?? this.services[0];
    const meta = FAULT_TYPE_META[params.faultType];
    const nowIso = new Date().toISOString();

    const newExp: ChaosExperiment = {
      id: `exp-${Math.floor(9413 + Math.random() * 500)}`,
      name: params.name,
      targetServiceId: svc.id,
      targetServiceName: svc.name,
      targetNamespace: svc.namespace,
      cluster: this.activeCluster,
      faultType: params.faultType,
      magnitude: params.magnitude,
      magnitudeUnit: meta.unit,
      blastRadiusPct: params.blastRadiusPct,
      durationSec: params.durationSec,
      remainingSec: params.durationSec,
      status: 'running',
      startedAt: `${nowIso.slice(11, 19)} UTC`,
      hypothesis: params.hypothesis,
      impactDeltaP99Pct: Number((params.magnitude * 0.9 + params.blastRadiusPct * 1.4).toFixed(1)),
    };

    this.experiments = [newExp, ...this.experiments];
    this.recomputeServices();

    const launchLog: LogEntry = {
      id: `log-launch-${Date.now()}`,
      timestampIso: nowIso,
      level: 'WARN',
      service: svc.name,
      cluster: this.activeCluster,
      traceId: `tr-${Math.random().toString(16).slice(2, 12)}`,
      durationMs: Math.round(svc.p99Ms + 120),
      message: `[SANDBOX FAULT] Started ${newExp.name} (${newExp.magnitude}${newExp.magnitudeUnit} @ ${newExp.blastRadiusPct}% blast in ${svc.namespace})`,
      metadata: { experiment: newExp.id, vector: newExp.faultType, target: svc.name, sandbox: this.activeCluster },
      spans: buildTraceSpans(svc.name, false, Math.round(svc.p99Ms + 120)),
    };
    this.logs = [launchLog, ...this.logs];

    return newExp;
  }

  public haltExperiment(experimentId: string): boolean {
    const targetExp = this.experiments.find((e) => e.id === experimentId);
    if (!targetExp) return false;

    this.experiments = this.experiments.map((e) =>
      e.id === experimentId ? { ...e, status: 'halted' as const, remainingSec: 0 } : e
    );
    this.recomputeServices();

    const nowIso = new Date().toISOString();
    this.logs = [
      {
        id: `log-halt-${Date.now()}`,
        timestampIso: nowIso,
        level: 'INFO',
        service: targetExp.targetServiceName,
        cluster: this.activeCluster,
        traceId: `tr-${Math.random().toString(16).slice(2, 12)}`,
        durationMs: 24,
        message: `[SANDBOX RECOVERY] ${targetExp.name} aborted in sandbox; Toxiproxy toxics deleted cleanly`,
        metadata: { experiment: targetExp.id, sandbox: this.activeCluster },
        spans: buildTraceSpans(targetExp.targetServiceName, false, 24),
      },
      ...this.logs,
    ];
    return true;
  }

  public haltAllActiveFaults(): number {
    const runningCount = this.experiments.filter((e) => e.status === 'running').length;
    this.experiments = this.experiments.map((e) =>
      e.status === 'running' ? { ...e, status: 'halted' as const, remainingSec: 0 } : e
    );
    this.recomputeServices();

    const nowIso = new Date().toISOString();
    this.logs = [
      {
        id: `log-halt-all-${Date.now()}`,
        timestampIso: nowIso,
        level: 'WARN',
        service: 'api-gateway',
        cluster: this.activeCluster,
        traceId: `tr-${Math.random().toString(16).slice(2, 12)}`,
        durationMs: 18,
        message: `[EMERGENCY KILL SWITCH] Flushed all ${runningCount} active sandbox faults in ${this.activeCluster}`,
        metadata: { cluster: this.activeCluster, action: 'sandbox_halt_all', haltedCount: runningCount },
        spans: buildTraceSpans('api-gateway', false, 18),
      },
      ...this.logs,
    ];
    return runningCount;
  }

  public tick(): {
    services: ServiceNode[];
    experiments: ChaosExperiment[];
    series: TelemetryPoint[];
    logs: LogEntry[];
  } {
    this.tickCount += 1;
    let completedNow: ChaosExperiment[] = [];

    this.experiments = this.experiments.map((exp) => {
      if (exp.status !== 'running') return exp;
      const nextRem = Math.max(0, exp.remainingSec - 2);
      if (nextRem === 0) {
        const done: ChaosExperiment = { ...exp, remainingSec: 0, status: 'completed' };
        completedNow.push(done);
        return done;
      }
      return { ...exp, remainingSec: nextRem };
    });

    this.recomputeServices();

    // Append telemetry point
    const faultActive = this.experiments.some((e) => e.status === 'running');
    const maxP99 = Math.max(...this.services.map((s) => s.p99Ms));
    const weightedP99 = faultActive
      ? Number((maxP99 * 0.58 + Math.sin(this.tickCount * 0.8) * 14).toFixed(1))
      : Number((58 + Math.sin(this.tickCount * 0.5) * 5).toFixed(1));
    const totalRps = this.services.reduce((acc, s) => acc + s.rps, 0);
    const weightedErr =
      totalRps > 0
        ? Number(
            (
              this.services.reduce((acc, s) => acc + s.errorRatePct * s.rps, 0) / totalRps
            ).toFixed(2)
          )
        : 0.04;

    const nowIso = new Date().toISOString();
    const nextPoint: TelemetryPoint = {
      timestamp: nowIso.slice(11, 19),
      p50: Number((weightedP99 * 0.14).toFixed(1)),
      p95: Number((weightedP99 * 0.59).toFixed(1)),
      p99: weightedP99,
      baselineP99: Number((62 + Math.sin(this.tickCount * 0.4) * 4).toFixed(1)),
      rps: totalRps,
      errorRate: weightedErr,
      faultActive,
    };
    this.series = [...this.series.slice(-35), nextPoint];

    // Emit logs
    if (this.tickCount % 2 === 0 || completedNow.length > 0) {
      const degraded = this.services.find((s) => s.status !== 'healthy') ?? this.services[0];
      const isCrit = degraded.status === 'critical';
      const isWarn = degraded.status === 'injecting';
      const traceId = `tr-${Math.random().toString(16).slice(2, 12)}`;
      const dur = Math.round(degraded.p99Ms);

      const newLog: LogEntry = {
        id: `log-${Date.now()}-${this.tickCount}`,
        timestampIso: nowIso,
        level: completedNow.length > 0 ? 'INFO' : isCrit ? 'CRIT' : isWarn ? 'WARN' : 'INFO',
        service: completedNow.length > 0 ? completedNow[0].targetServiceName : degraded.name,
        cluster: this.activeCluster,
        traceId,
        durationMs: dur,
        message:
          completedNow.length > 0
            ? `[SANDBOX RECOVERED] ${completedNow[0].name} converged cleanly; steady state restored`
            : isCrit
            ? `[SLO BREACH] ${degraded.name} in ${degraded.namespace}: 5xx=${degraded.errorRatePct.toFixed(2)}% p99=${degraded.p99Ms.toFixed(0)}ms`
            : isWarn
            ? `[CHAOS PROBE] ${degraded.name} synthetic delay observed at Toxiproxy sidecar`
            : `[HEALTH PROBE] Envoy upstream cluster ${degraded.name} 200 OK`,
        metadata: {
          cluster: this.activeCluster,
          'p99.ms': degraded.p99Ms,
          'pods.ready': `${degraded.podsReady}/${degraded.podsTotal}`,
          namespace: degraded.namespace,
        },
        spans: buildTraceSpans(degraded.name, isCrit, dur),
      };

      this.logs = [newLog, ...this.logs].slice(0, 120);
    }

    return {
      services: [...this.services],
      experiments: [...this.experiments],
      series: [...this.series],
      logs: [...this.logs],
    };
  }

  private recomputeServices() {
    const activeExps = this.experiments.filter((e) => e.status === 'running');

    this.services = INITIAL_SERVICES.map((svc, idx) => {
      const targeting = activeExps.filter((e) => e.targetServiceId === svc.id);
      const wave = Math.sin(this.tickCount * 0.7 + idx * 1.3);

      if (targeting.length === 0) {
        const p99 = Number(Math.max(2, svc.baseP99Ms + wave * 2.4).toFixed(1));
        return {
          ...svc,
          cluster: this.activeCluster,
          status: 'healthy',
          p99Ms: p99,
          p95Ms: Number((p99 * 0.62).toFixed(1)),
          p50Ms: Number((p99 * 0.28).toFixed(1)),
          errorRatePct: Number(Math.max(0, svc.baseErrorRatePct + Math.abs(wave) * 0.01).toFixed(2)),
          rps: Math.round(svc.baseRps + wave * (svc.baseRps * 0.025)),
          podsReady: svc.podsTotal,
          cpuPct: Math.min(95, Math.max(18, Math.round(38 + idx * 4 + wave * 3))),
        };
      }

      let latencyBoost = 0;
      let errorBoost = 0;
      let cpuBoost = 0;
      let podLoss = 0;
      let isCritical = false;

      targeting.forEach((exp) => {
        const scale = exp.blastRadiusPct / 100;
        if (exp.faultType === 'latency') {
          latencyBoost += exp.magnitude * (0.85 + scale * 0.5);
          errorBoost += 0.55 * scale;
        } else if (exp.faultType === 'packet_loss') {
          latencyBoost += exp.magnitude * 7.5;
          errorBoost += exp.magnitude * 0.14 * scale;
          if (exp.magnitude >= 15) isCritical = true;
        } else if (exp.faultType === 'cpu_pressure') {
          cpuBoost += Math.round(exp.magnitude * 0.55);
          latencyBoost += exp.magnitude * 2.4;
          errorBoost += 0.45 * scale;
        } else if (exp.faultType === 'pod_kill') {
          podLoss = Math.min(svc.podsTotal - 1, Math.max(1, Math.round(svc.podsTotal * scale)));
          latencyBoost += 260;
          errorBoost += 2.15;
          isCritical = true;
        } else if (exp.faultType === 'dns_blackhole') {
          latencyBoost += 310;
          errorBoost += (exp.magnitude / 100) * 4.5;
          isCritical = true;
        }
      });

      const p99 = Number((svc.baseP99Ms + latencyBoost + wave * 12).toFixed(1));
      const errorRatePct = Number((svc.baseErrorRatePct + errorBoost + Math.abs(wave) * 0.15).toFixed(2));
      if (errorRatePct >= 1.5) isCritical = true;

      return {
        ...svc,
        cluster: this.activeCluster,
        status: isCritical ? 'critical' : 'injecting',
        p99Ms: p99,
        p95Ms: Number((p99 * 0.61).toFixed(1)),
        p50Ms: Number((p99 * 0.14).toFixed(1)),
        errorRatePct,
        rps: Math.max(120, Math.round(svc.baseRps * (isCritical ? 0.86 : 0.96) + wave * 80)),
        podsReady: Math.max(1, svc.podsTotal - podLoss),
        cpuPct: Math.min(99, Math.max(40, 52 + cpuBoost + Math.round(wave * 4))),
      };
    });
  }
}

export const mockTelemetryService = new MockTelemetryService();
