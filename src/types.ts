export type StopKind = "主音栓" | "簧片音栓" | "混合音栓" | "低音管";

export type ReedStatus = "正常" | "需微调" | "已修整" | "需更换";

export interface Stop {
  id: string;
  /** 所属场馆（教堂 / 音乐厅） */
  venue: string;
  name: string;
  kind: StopKind;
  /** 音管长度标称，如 8'、16' */
  footage: string;
}

export interface Report {
  id: string;
  venue: string;
  /** YYYY-MM-DD */
  date: string;
  maintainer: string;
  note: string;
  createdAt: number;
}

export interface Measurement {
  id: string;
  reportId: string;
  stopId: string;
  /** 音管编号 */
  pipeNo: string;
  /** 音高，如 C#4 */
  pitch: string;
  /** 音分偏差 cent，正偏高、负偏低 */
  cents: number;
  /** 温度 ℃ */
  temp: number;
  /** 相对湿度 % */
  humidity: number;
  reed: ReedStatus;
  remark: string;
  createdAt: number;
}

export interface ResolveRecord {
  at: number;
  conclusion: string;
}

/** 异常事件：同一音管连续两次偏差同向且绝对值扩大 */
export interface Incident {
  id: string;
  pipeKey: string;
  triggeredAt: number;
  reportId: string;
  prevMeasurementId: string;
  prevCents: number;
  measurementId: string;
  cents: number;
  /** 非 null 表示已经凭现场复核结论解除冻结，历史永久保留 */
  resolved: ResolveRecord | null;
}

export interface PipeStatus {
  latest: Measurement;
  /** 该音管最近一次异常事件（可能已解除），无则为 null */
  incident: Incident | null;
}

export interface AppData {
  version: 1;
  stops: Stop[];
  reports: Report[];
  measurements: Measurement[];
  incidents: Incident[];
}

export interface Filters {
  stopId: string; // "all" 或 Stop.id
  query: string;
}
