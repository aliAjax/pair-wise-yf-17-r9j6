export type ReedStatus =
  | "正常"
  | "无簧片（笛管）"
  | "需清洁"
  | "需调整"
  | "轻微锈蚀"
  | "需更换";

export const REED_STATUSES: ReedStatus[] = [
  "正常",
  "无簧片（笛管）",
  "需清洁",
  "需调整",
  "轻微锈蚀",
  "需更换",
];

/** 单次调音维护记录 */
export interface MaintenanceRecord {
  id: string;
  ts: number;
  venue: string;
  stop: string;
  pipeNo: string;
  pitch: string;
  cents: number;
  temp: number;
  humidity: number;
  reed: ReedStatus;
  note?: string;
}

export interface RecordInput {
  venue: string;
  stop: string;
  pipeNo: string;
  pitch: string;
  cents: number;
  temp: number;
  humidity: number;
  reed: ReedStatus;
  note?: string;
}

/** 异常事件：同一音管连续两次偏差同向且绝对值扩大时产生 */
export interface AnomalyEvent {
  id: string;
  pipeKey: string;
  venue: string;
  stop: string;
  pipeNo: string;
  /** 触发本次异常的（较新）记录 */
  triggeredRecordId: string;
  /** 上一条同管记录 */
  previousRecordId: string;
  prevCents: number;
  cents: number;
  detectedAt: number;
  resolved: boolean;
  /** 解除冻结时必须填写的现场复核结论 */
  conclusion?: string;
  resolvedAt?: number;
}

/** 每根音管（场馆 + 音栓 + 音管号）的状态 */
export interface PipeStatus {
  frozen: boolean;
  anomalyIds: string[];
}

export interface AppData {
  version: 1;
  records: MaintenanceRecord[];
  anomalies: AnomalyEvent[];
  pipes: Record<string, PipeStatus>;
}

export type TabKey = "deviation" | "climate" | "report" | "anomaly";
