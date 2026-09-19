import { useEffect, useMemo, useState } from "react";
import "./styles.css";
import type {
  AppData,
  RecordInput,
  TabKey,
} from "./types";
import {
  deleteRecord,
  insertRecord,
  loadData,
  resolveAnomaly,
  saveData,
  seedData,
} from "./store";
import RecordForm from "./components/RecordForm";
import DeviationTable from "./components/DeviationTable";
import ClimateLog from "./components/ClimateLog";
import AnomalyPanel from "./components/AnomalyPanel";
import MaintenanceReport from "./components/MaintenanceReport";

const TABS: { key: TabKey; label: string }[] = [
  { key: "deviation", label: "偏差表" },
  { key: "climate", label: "温湿度记录" },
  { key: "report", label: "单次维护报告" },
  { key: "anomaly", label: "异常冻结" },
];

export default function App() {
  const [data, setData] = useState<AppData>(() => loadData());
  const [tab, setTab] = useState<TabKey>("deviation");
  const [stopFilter, setStopFilter] = useState("全部");
  const [venueFilter, setVenueFilter] = useState("全部");
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    saveData(data);
  }, [data]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  const stops = useMemo(
    () => Array.from(new Set(data.records.map((r) => r.stop))).sort(),
    [data.records],
  );
  const venues = useMemo(
    () => Array.from(new Set(data.records.map((r) => r.venue))).sort(),
    [data.records],
  );

  const filteredRows = useMemo(
    () =>
      data.records
        .filter((r) => (stopFilter === "全部" ? true : r.stop === stopFilter))
        .filter((r) => (venueFilter === "全部" ? true : r.venue === venueFilter)),
    [data.records, stopFilter, venueFilter],
  );

  const frozenCount = Object.values(data.pipes).filter((p) => p.frozen).length;
  const outOfTuneCount = filteredRows.filter((r) => Math.abs(r.cents) > 5).length;
  const lastTemp = [...filteredRows].sort((a, b) => b.ts - a.ts)[0]?.temp;
  const lastHum = [...filteredRows].sort((a, b) => b.ts - a.ts)[0]?.humidity;

  const addRecord = (input: RecordInput) => {
    const next = insertRecord(data, input);
    setData(next);
    const pipeNow = next.pipes[`${input.venue.trim()}||${input.stop.trim()}||${input.pipeNo.trim()}`];
    if (pipeNow?.frozen) {
      setToast("已保存记录，但该音管连续偏差同向扩大，已自动标为异常并冻结。");
      setTab("anomaly");
    } else {
      setToast("维护记录已保存。");
    }
  };

  const handleResolve = (anomalyId: string, conclusion: string) => {
    setData(resolveAnomaly(data, anomalyId, conclusion));
    setToast("已写入现场复核结论，音管解除冻结；异常历史已保留。");
  };

  const handleDelete = (id: string) => {
    const before = data.records.length;
    const next = deleteRecord(data, id);
    if (next.records.length < before) {
      setData(next);
      setToast("记录已删除。");
    }
  };

  const loadSeed = () => {
    if (data.records.length > 0) {
      if (!window.confirm("载入演示数据会覆盖当前浏览器内的全部记录，确定继续？")) return;
    }
    setData(seedData());
    setStopFilter("全部");
    setVenueFilter("全部");
    setToast("已载入演示数据。");
  };

  const clearAll = () => {
    if (!window.confirm("确定清空浏览器本地的全部调音数据？此操作不可恢复。")) return;
    setData({ version: 1, records: [], anomalies: [], pipes: {} });
    setStopFilter("全部");
    setVenueFilter("全部");
    setToast("本地数据已清空。");
  };

  return (
    <main className="app">
      <section className="hero">
        <p>ORGAN TUNING CONSOLE · 管风琴调音台</p>
        <h1>管风琴音管调音台</h1>
        <span>
          逐管记录音分偏差与现场环境；同一音管连续两次偏差同向且绝对值扩大时自动标为异常并冻结调音，
          凭现场复核结论解冻。所有数据仅保存在本浏览器，刷新不丢失。
        </span>
      </section>

      <section className="metrics">
        <article>
          <small>音栓数量{stopFilter !== "全部" ? "（当前筛选）" : ""}</small>
          <strong>{stopFilter === "全部" ? stops.length : 1}</strong>
        </article>
        <article>
          <small>偏差超 5 cent（当前筛选）</small>
          <strong className={outOfTuneCount ? "metric-warn" : ""}>{outOfTuneCount}</strong>
        </article>
        <article>
          <small>冻结音管总数</small>
          <strong className={frozenCount ? "metric-danger" : ""}>{frozenCount}</strong>
        </article>
        <article>
          <small>最近一次温度 / 湿度</small>
          <strong className="metric-climate">
            {lastTemp !== undefined ? `${lastTemp}℃ / ${lastHum}%` : "—"}
          </strong>
        </article>
      </section>

      <section className="workspace">
        <aside className="panel sidebar no-print">
          <h2>场馆筛选</h2>
          <div className="chips">
            <button
              className={venueFilter === "全部" ? "chip-on" : ""}
              onClick={() => setVenueFilter("全部")}
            >
              全部场馆
            </button>
            {venues.map((v) => (
              <button
                key={v}
                className={venueFilter === v ? "chip-on" : ""}
                onClick={() => setVenueFilter(v)}
              >
                {v}
              </button>
            ))}
          </div>

          <h2 className="sidebar-h2">音栓筛选</h2>
          <div className="chips">
            <button
              className={stopFilter === "全部" ? "chip-on" : ""}
              onClick={() => setStopFilter("全部")}
            >
              全部音栓
            </button>
            {stops.map((s) => {
              const frozen = data.records.some(
                (r) =>
                  r.stop === s &&
                  (venueFilter === "全部" || r.venue === venueFilter) &&
                  data.pipes[`${r.venue}||${r.stop}||${r.pipeNo}`]?.frozen,
              );
              return (
                <button
                  key={s}
                  className={stopFilter === s ? "chip-on" : ""}
                  onClick={() => setStopFilter(s)}
                >
                  {frozen && <i className="dot-danger" title="含冻结音管" />}
                  {s}
                </button>
              );
            })}
          </div>

          <div className="sidebar-foot">
            <button onClick={loadSeed}>载入演示数据</button>
            <button onClick={clearAll}>清空本地数据</button>
            <p>数据仅存于浏览器 localStorage，不上传服务器。</p>
          </div>
        </aside>

        <div className="main-col">
          <RecordForm data={data} onAdd={addRecord} />

          <nav className="tabs no-print">
            {TABS.map((t) => {
              const badge =
                t.key === "anomaly" && frozenCount > 0 ? frozenCount : 0;
              return (
                <button
                  key={t.key}
                  className={`tab ${tab === t.key ? "tab-on" : ""}`}
                  onClick={() => setTab(t.key)}
                >
                  {t.label}
                  {badge > 0 && <i className="tab-badge">{badge}</i>}
                </button>
              );
            })}
          </nav>

          {tab === "deviation" && (
            <DeviationTable data={data} rows={filteredRows} onDelete={handleDelete} />
          )}
          {tab === "climate" && <ClimateLog rows={filteredRows} />}
          {tab === "report" && (
            <MaintenanceReport data={data} rows={filteredRows} />
          )}
          {tab === "anomaly" && (
            <AnomalyPanel
              data={data}
              stopFilter={stopFilter}
              venueFilter={venueFilter}
              onResolve={handleResolve}
            />
          )}
        </div>
      </section>

      {toast && <div className="toast">{toast}</div>}
    </main>
  );
}
