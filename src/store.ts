import type {
  AnomalyEvent,
  AppData,
  MaintenanceRecord,
  RecordInput,
} from "./types";

const STORAGE_KEY = "organ-tuning-console:v1";

export function pipeKey(venue: string, stop: string, pipeNo: string): string {
  return `${venue.trim()}||${stop.trim()}||${pipeNo.trim()}`;
}

/**
 * 异常判定：同一音管最近两条记录偏差同向且绝对值扩大。
 * 触发条件成立时，新记录仍正常入库，但该音管立即冻结，
 * 之后的调音提交将被拦截，直到写入现场复核结论解除冻结。
 */
export function evaluateAnomaly(
  prev: MaintenanceRecord | undefined,
  next: MaintenanceRecord,
): AnomalyEvent | null {
  if (!prev) return null;
  const sameDirection = prev.cents * next.cents > 0;
  const widening = Math.abs(next.cents) > Math.abs(prev.cents);
  if (sameDirection && widening) {
    return {
      id: `anom-${next.id}`,
      pipeKey: pipeKey(next.venue, next.stop, next.pipeNo),
      venue: next.venue,
      stop: next.stop,
      pipeNo: next.pipeNo,
      triggeredRecordId: next.id,
      previousRecordId: prev.id,
      prevCents: prev.cents,
      cents: next.cents,
      detectedAt: next.ts,
      resolved: false,
    };
  }
  return null;
}

export function emptyData(): AppData {
  return { version: 1, records: [], anomalies: [], pipes: {} };
}

function ensurePipe(data: AppData, key: string) {
  if (!data.pipes[key]) data.pipes[key] = { frozen: false, anomalyIds: [] };
  return data.pipes[key];
}

let seq = 0;
export function newId(prefix: string): string {
  seq = (seq + 1) % 1_000_000;
  return `${prefix}-${Date.now().toString(36)}-${seq.toString(36)}`;
}

/** 写入一条记录并执行异常检测，返回更新后的不可变数据副本 */
export function insertRecord(data: AppData, input: RecordInput): AppData {
  const record: MaintenanceRecord = {
    id: newId("rec"),
    ts: Date.now(),
    ...input,
  };
  const next: AppData = {
    ...data,
    records: [...data.records, record],
    anomalies: data.anomalies,
    pipes: data.pipes,
  };

  if (data.pipes[pipeKey(input.venue, input.stop, input.pipeNo)]?.frozen) {
    // 冻结拦截在 UI 层完成；到这里视为强制路径，直接返回
    return next;
  }

  const history = data.records
    .filter(
      (r) =>
        pipeKey(r.venue, r.stop, r.pipeNo) ===
        pipeKey(input.venue, input.stop, input.pipeNo),
    )
    .sort((a, b) => a.ts - b.ts);
  const prev = history[history.length - 1];
  const anomaly = evaluateAnomaly(prev, record);

  if (!anomaly) return next;

  const key = anomaly.pipeKey;
  return {
    ...next,
    anomalies: [...next.anomalies, anomaly],
    pipes: {
      ...next.pipes,
      [key]: {
        frozen: true,
        anomalyIds: [...(next.pipes[key]?.anomalyIds ?? []), anomaly.id],
      },
    },
  };
}

/** 现场复核解除冻结：必须给出具体复核结论，异常历史永久保留 */
export function resolveAnomaly(
  data: AppData,
  anomalyId: string,
  conclusion: string,
): AppData {
  const anomaly = data.anomalies.find((a) => a.id === anomalyId);
  if (!anomaly || anomaly.resolved) return data;
  if (conclusion.trim().length < 10) return data;
  const updated: AnomalyEvent = {
    ...anomaly,
    resolved: true,
    conclusion: conclusion.trim(),
    resolvedAt: Date.now(),
  };
  const key = anomaly.pipeKey;
  const pipe = data.pipes[key];
  return {
    ...data,
    anomalies: data.anomalies.map((a) => (a.id === anomalyId ? updated : a)),
    pipes: {
      ...data.pipes,
      [key]: { ...pipe, frozen: false },
    },
  };
}

/** 删除记录：被异常事件引用的记录不允许删除，保证判定链可追溯 */
export function deleteRecord(data: AppData, recordId: string): AppData {
  const referenced = data.anomalies.some(
    (a) =>
      a.triggeredRecordId === recordId || a.previousRecordId === recordId,
  );
  if (referenced) return data;
  return { ...data, records: data.records.filter((r) => r.id !== recordId) };
}

export function loadData(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyData();
    const parsed = JSON.parse(raw) as AppData;
    if (parsed.version !== 1) return emptyData();
    return {
      version: 1,
      records: Array.isArray(parsed.records) ? parsed.records : [],
      anomalies: Array.isArray(parsed.anomalies) ? parsed.anomalies : [],
      pipes: parsed.pipes && typeof parsed.pipes === "object" ? parsed.pipes : {},
    };
  } catch {
    return emptyData();
  }
}

export function saveData(data: AppData): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function isPipeFrozen(
  data: AppData,
  venue: string,
  stop: string,
  pipeNo: string,
): boolean {
  return Boolean(data.pipes[pipeKey(venue, stop, pipeNo)]?.frozen);
}

/* ---------------- 演示数据 ---------------- */

const DAY = 24 * 60 * 60 * 1000;

export function seedData(): AppData {
  const base = new Date("2026-09-12T09:30:00").getTime();
  const rows: Array<RecordInput & { ts: number }> = [
    {
      ts: base,
      venue: "St. Mary 教堂",
      stop: "Trumpet 8'",
      pipeNo: "C#4",
      pitch: "C#4",
      cents: 4,
      temp: 20.5,
      humidity: 48,
      reed: "正常",
      note: "早礼拜前例行巡检",
    },
    {
      ts: base + 3 * DAY,
      venue: "St. Mary 教堂",
      stop: "Trumpet 8'",
      pipeNo: "C#4",
      pitch: "C#4",
      cents: 9,
      temp: 22.1,
      humidity: 55,
      reed: "需清洁",
      note: "偏差同向扩大，系统自动冻结",
    },
    {
      ts: base + DAY,
      venue: "St. Mary 教堂",
      stop: "Principal 4'",
      pipeNo: "G3",
      pitch: "G3",
      cents: -3,
      temp: 20.8,
      humidity: 49,
      reed: "无簧片（笛管）",
      note: "状态正常",
    },
    {
      ts: base + 2 * DAY,
      venue: "市政音乐厅 A 厅",
      stop: "Bourdon 16'",
      pipeNo: "F2",
      pitch: "F2",
      cents: -8,
      temp: 19.6,
      humidity: 52,
      reed: "无簧片（笛管）",
      note: "低音区偏负",
    },
    {
      ts: base + 2 * DAY + 2 * 60 * 60 * 1000,
      venue: "市政音乐厅 A 厅",
      stop: "Bourdon 16'",
      pipeNo: "F2",
      pitch: "F2",
      cents: -13,
      temp: 19.4,
      humidity: 58,
      reed: "无簧片（笛管）",
      note: "夜间湿度上升后复测，触发异常，冻结等待现场排查",
    },
    {
      ts: base + 4 * DAY + 90 * 60 * 1000,
      venue: "市政音乐厅 A 厅",
      stop: "Mixtur IV",
      pipeNo: "A4",
      pitch: "A4",
      cents: 2,
      temp: 19.0,
      humidity: 60,
      reed: "无簧片（笛管）",
      note: "混合音栓整体复核",
    },
  ];

  let data = emptyData();
  for (const { ts, ...input } of rows) {
    const record: MaintenanceRecord = { id: newId("rec"), ts, ...input };
    data = { ...data, records: [...data.records, record] };
    const key = pipeKey(input.venue, input.stop, input.pipeNo);
    const history = data.records
      .filter((r) => pipeKey(r.venue, r.stop, r.pipeNo) === key)
      .sort((a, b) => a.ts - b.ts);
    const prev = history[history.length - 2];
    const anomaly = evaluateAnomaly(prev, record);
    if (anomaly) {
      data = {
        ...data,
        anomalies: [...data.anomalies, anomaly],
        pipes: {
          ...data.pipes,
          [key]: {
            frozen: true,
            anomalyIds: [...(data.pipes[key]?.anomalyIds ?? []), anomaly.id],
          },
        },
      };
    }
  }

  // F2 已完成现场复核并解除冻结（全部相关异常均关闭，异常历史保留）
  const f2Anomalies = data.anomalies.filter((a) => a.pipeNo === "F2");
  const conclusion =
    "现场复核：木管接口漏风是偏差持续扩大的原因，已补胶、稳湿 24 小时后复校，复测连续稳定在容差内，同意解除冻结继续观察。";
  for (const a of f2Anomalies) {
    data = resolveAnomaly(data, a.id, conclusion);
  }
  return data;
}
