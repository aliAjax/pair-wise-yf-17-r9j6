import type {
  AppData,
  Incident,
  Measurement,
  PipeStatus,
  Report,
  Stop,
} from "./types";

const STORAGE_KEY = "organ-tuning-console:v1";

export function uid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return (
    Date.now().toString(36) + Math.random().toString(36).slice(2, 10)
  );
}

/** 音管在系统内的唯一标识：音栓 + 音管编号 */
export function pipeKey(stopId: string, pipeNo: string): string {
  return `${stopId}::${pipeNo.trim()}`;
}

export function isFrozenPipe(status: PipeStatus): boolean {
  return (
    status.incident !== null && status.incident.resolved === null
  );
}

/**
 * 判断新测量是否构成异常：
 * 与该音管上一条测量相比，偏差同向（同正或同负）且绝对值严格扩大。
 * 0 不算正/负方向，不构成异常。
 */
export function detectEscalation(
  prev: Measurement | undefined,
  cents: number
): boolean {
  if (!prev) return false;
  if (prev.cents === 0 || cents === 0) return false;
  const sameSign = prev.cents > 0 === cents > 0;
  return sameSign && Math.abs(cents) > Math.abs(prev.cents);
}

export function pipeStatuses(data: AppData): Map<string, PipeStatus> {
  const map = new Map<string, PipeStatus>();
  for (const m of data.measurements) {
    const key = pipeKey(m.stopId, m.pipeNo);
    const cur = map.get(key);
    if (!cur || m.createdAt > cur.latest.createdAt) {
      map.set(key, { latest: m, incident: null });
    }
  }
  for (const inc of data.incidents) {
    const cur = map.get(inc.pipeKey);
    if (cur) cur.incident = inc;
  }
  return map;
}

/** 取某音管按时间排序的全部测量（时间相同按保存顺序） */
export function measurementsOfPipe(
  data: AppData,
  key: string
): Measurement[] {
  return data.measurements
    .filter((m) => pipeKey(m.stopId, m.pipeNo) === key)
    .sort((a, b) => a.createdAt - b.createdAt);
}

export interface AddResult {
  data: AppData;
  measurement: Measurement;
  incident: Incident | null;
  /** 该音管是否因此次记录进入冻结 */
  frozen: boolean;
}

/** 新增一条维护测量；若触发异常规则则同时生成异常事件并冻结音管 */
export function addMeasurement(
  data: AppData,
  input: Omit<Measurement, "id" | "createdAt">
): AddResult {
  const now = Date.now();
  const measurement: Measurement = {
    ...input,
    id: uid(),
    createdAt: now,
  };
  const key = pipeKey(measurement.stopId, measurement.pipeNo);
  const history = measurementsOfPipe(data, key);
  const prev = history.length ? history[history.length - 1] : undefined;
  // 已冻结（存在未解除异常）的音管不再重复生成异常事件；UI 层同时拦截录入
  const alreadyFrozen = data.incidents.some(
    (i) => i.pipeKey === key && i.resolved === null
  );

  let incident: Incident | null = null;
  if (!alreadyFrozen && detectEscalation(prev, measurement.cents)) {
    incident = {
      id: uid(),
      pipeKey: key,
      triggeredAt: now,
      reportId: measurement.reportId,
      prevMeasurementId: prev!.id,
      prevCents: prev!.cents,
      measurementId: measurement.id,
      cents: measurement.cents,
      resolved: null,
    };
  }

  const next: AppData = {
    ...data,
    measurements: [...data.measurements, measurement],
    incidents: incident
      ? [...data.incidents, incident]
      : data.incidents,
  };
  return { data: next, measurement, incident, frozen: incident !== null };
}

/**
 * 凭现场复核结论解除冻结。
 * 结论必须是具体内容（去空白后 ≥ 10 个字），否则抛出异常。
 */
export function resolveIncident(
  data: AppData,
  incidentId: string,
  conclusion: string
): { data: AppData; incident: Incident } {
  const text = conclusion.trim();
  if (text.length < 10) {
    throw new Error("请写出具体的现场复核结论（至少 10 个字）后再解除冻结");
  }
  const target = data.incidents.find((i) => i.id === incidentId);
  if (!target) throw new Error("未找到该异常事件");
  if (target.resolved) throw new Error("该异常事件已解除");
  const incident: Incident = {
    ...target,
    resolved: { at: Date.now(), conclusion: text },
  };
  return {
    data: {
      ...data,
      incidents: data.incidents.map((i) =>
        i.id === incidentId ? incident : i
      ),
    },
    incident,
  };
}

/** 新增音栓 */
export function addStop(
  data: AppData,
  input: Omit<Stop, "id">
): { data: AppData; stop: Stop } {
  const stop: Stop = { ...input, id: uid() };
  return { data: { ...data, stops: [...data.stops, stop] }, stop };
}

/** 新增维护报告 */
export function addReport(
  data: AppData,
  input: Omit<Report, "id" | "createdAt">
): { data: AppData; report: Report } {
  const report: Report = { ...input, id: uid(), createdAt: Date.now() };
  return {
    data: { ...data, reports: [...data.reports, report] },
    report,
  };
}

/** 读取本地数据；缺失或损坏时回退到种子数据 */
export function loadData(seed: AppData): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
      return seed;
    }
    const parsed = JSON.parse(raw) as AppData;
    if (!Array.isArray(parsed.measurements)) return seed;
    return parsed;
  } catch {
    return seed;
  }
}

export function saveData(data: AppData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // 存储已满或被禁用时静默失败，不影响当前会话
  }
}

export function clearStorage(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
