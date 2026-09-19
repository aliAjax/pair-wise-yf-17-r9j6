import type { AppData } from "./types";

const HOUR = 3600_000;
const DAY = 24 * HOUR;
const base = Date.parse("2026-09-01T10:00:00");

/**
 * 演示数据：
 * - Bourdon 16' 的 F2 连续同向扩大（-8 → -14）→ 已自动异常并冻结
 * - Principal 4' 各音管正常
 * - Trumpet 8' 的 C#4 单次偏差超限，等待复测
 */
export function buildSeed(): AppData {
  return {
    version: 1,
    stops: [
      {
        id: "stop-principal",
        venue: "St. Mary 大教堂",
        name: "Principal",
        kind: "主音栓",
        footage: "4'",
      },
      {
        id: "stop-bourdon",
        venue: "St. Mary 大教堂",
        name: "Bourdon",
        kind: "低音管",
        footage: "16'",
      },
      {
        id: "stop-trumpet",
        venue: "城市音乐厅 A 厅",
        name: "Trumpet",
        kind: "簧片音栓",
        footage: "8'",
      },
    ],
    reports: [
      {
        id: "rep-0901",
        venue: "St. Mary 大教堂",
        date: "2026-09-01",
        maintainer: "李调音",
        note: "例行季度保养，重点复查低音区稳定性。",
        createdAt: base,
      },
      {
        id: "rep-0912",
        venue: "St. Mary 大教堂",
        date: "2026-09-12",
        maintainer: "李调音",
        note: "夏季温湿度波动后复测，Bourdon 低音节拍偏慢。",
        createdAt: base + 11 * DAY,
      },
      {
        id: "rep-0918",
        venue: "城市音乐厅 A 厅",
        date: "2026-09-18",
        maintainer: "王技师",
        note: "演出前排音，簧片音栓整排复测。",
        createdAt: base + 17 * DAY,
      },
    ],
    measurements: [
      {
        id: "m-1",
        reportId: "rep-0901",
        stopId: "stop-principal",
        pipeNo: "G3",
        pitch: "G3",
        cents: -3,
        temp: 21.4,
        humidity: 46,
        reed: "正常",
        remark: "声音稳定",
        createdAt: base + HOUR,
      },
      {
        id: "m-2",
        reportId: "rep-0901",
        stopId: "stop-bourdon",
        pipeNo: "F2",
        pitch: "F2",
        cents: -8,
        temp: 21.1,
        humidity: 47,
        reed: "正常",
        remark: "拍音略慢，标记复检",
        createdAt: base + 2 * HOUR,
      },
      {
        id: "m-3",
        reportId: "rep-0912",
        stopId: "stop-principal",
        pipeNo: "G3",
        pitch: "G3",
        cents: 1,
        temp: 23.8,
        humidity: 55,
        reed: "正常",
        remark: "温度回升后已归正",
        createdAt: base + 11 * DAY + HOUR,
      },
      {
        id: "m-4",
        reportId: "rep-0912",
        stopId: "stop-bourdon",
        pipeNo: "F2",
        pitch: "F2",
        cents: -14,
        temp: 23.6,
        humidity: 56,
        reed: "需微调",
        remark: "偏差继续扩大，已冻结待现场复核",
        createdAt: base + 11 * DAY + 2 * HOUR,
      },
      {
        id: "m-5",
        reportId: "rep-0918",
        stopId: "stop-trumpet",
        pipeNo: "C#4",
        pitch: "C#4",
        cents: 9,
        temp: 22.5,
        humidity: 50,
        reed: "需微调",
        remark: "簧舌尖略有偏移，单次超限，复测后处理",
        createdAt: base + 17 * DAY + HOUR,
      },
    ],
    incidents: [
      {
        id: "inc-f2",
        pipeKey: "stop-bourdon::F2",
        triggeredAt: base + 11 * DAY + 2 * HOUR,
        reportId: "rep-0912",
        prevMeasurementId: "m-2",
        prevCents: -8,
        measurementId: "m-4",
        cents: -14,
        resolved: null,
      },
    ],
  };
}
