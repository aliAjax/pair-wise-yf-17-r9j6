import { useEffect, useMemo, useRef, useState } from "react";
import "./styles.css";
import type { AppData, Filters } from "./types";
import {
  clearStorage,
  isFrozenPipe,
  loadData,
  pipeStatuses,
  saveData,
} from "./storage";
import { buildSeed } from "./seed";
import { downloadJson } from "./format";
import Sidebar from "./components/Sidebar";
import EntryForm from "./components/EntryForm";
import DeviationTable from "./components/DeviationTable";
import ClimateLog from "./components/ClimateLog";
import IncidentPanel from "./components/IncidentPanel";
import ReportView from "./components/ReportView";

type Tab = "entry" | "deviation" | "climate" | "incident" | "report";

const TABS: { id: Tab; label: string }[] = [
  { id: "entry", label: "维护录入" },
  { id: "deviation", label: "调音偏差表" },
  { id: "climate", label: "温湿度记录" },
  { id: "incident", label: "异常音管" },
  { id: "report", label: "维护报告" },
];

interface Toast {
  id: number;
  msg: string;
  kind: "ok" | "warn" | "err";
}

function App() {
  const [data, setData] = useState<AppData>(() => loadData(buildSeed()));
  const dataRef = useRef<AppData>(data);
  const [tab, setTab] = useState<Tab>("entry");
  const [filters, setFilters] = useState<Filters>({
    stopId: "all",
    query: "",
  });
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [reportFocus, setReportFocus] = useState("");
  const toastSeq = useRef(0);

  useEffect(() => {
    saveData(data);
  }, [data]);

  const stopsById = useMemo(
    () => new Map(data.stops.map((s) => [s.id, s])),
    [data.stops]
  );

  const statuses = useMemo(() => pipeStatuses(data), [data]);
  const frozenCount = [...statuses.values()].filter((s) =>
    isFrozenPipe(s)
  ).length;
  const overCount = data.measurements.filter(
    (m) => Math.abs(m.cents) >= 10
  ).length;
  const lastM = [...data.measurements].sort(
    (a, b) => b.createdAt - a.createdAt
  )[0];

  function notify(msg: string, kind: "ok" | "warn" | "err" = "ok") {
    const id = ++toastSeq.current;
    setToasts((t) => [...t, { id, msg, kind }]);
    window.setTimeout(() => {
      setToasts((t) => t.filter((x) => x.id !== id));
    }, 4600);
  }

  /**
   * 统一提交入口：基于 dataRef 同步计算纯函数结果（连建报告/音栓/测量时
   * 能立刻拿到中间产物），再一次性更新 state 并触发持久化 effect。
   */
  function commit<T>(fn: (d: AppData) => T): T {
    const result = fn(dataRef.current);
    const next = (result as unknown as { data?: AppData }).data;
    if (next && next !== dataRef.current) {
      dataRef.current = next;
      setData(next);
    }
    return result;
  }

  function handleReset() {
    if (
      window.confirm(
        "确定清空本机全部调音数据并恢复演示数据？此操作不可撤销。"
      )
    ) {
      clearStorage();
      const fresh = buildSeed();
      dataRef.current = fresh;
      setData(fresh);
      setFilters({ stopId: "all", query: "" });
      notify("已清空本地数据并恢复演示数据", "ok");
    }
  }

  return (
    <main className="app">
      <section className="hero">
        <p>ORGAN TUNING CONSOLE · 管风琴调音台</p>
        <h1>管风琴音管调音记录</h1>
        <span>
          逐次记录场馆、音栓、音管、音分偏差、温湿度与簧片状态；同一音管连续两次偏差同向且绝对值扩大时自动标记异常并冻结调音，凭现场复核结论解冻，数据仅保存在本浏览器。
        </span>
      </section>

      <section className="metrics">
        <article>
          <small>音栓数量</small>
          <strong>{data.stops.length}</strong>
        </article>
        <article>
          <small>测量记录</small>
          <strong>{data.measurements.length}</strong>
        </article>
        <article className={frozenCount ? "metric-warn" : ""}>
          <small>冻结音管</small>
          <strong>{frozenCount}</strong>
        </article>
        <article>
          <small>偏差超限（≥10¢）</small>
          <strong>{overCount}</strong>
        </article>
        <article>
          <small>最近温度</small>
          <strong>{lastM ? `${lastM.temp.toFixed(1)}°` : "—"}</strong>
        </article>
        <article>
          <small>最近湿度</small>
          <strong>{lastM ? `${lastM.humidity}%` : "—"}</strong>
        </article>
      </section>

      <nav className="tabs no-print">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={tab === t.id ? "on" : ""}
            onClick={() => setTab(t.id)}
          >
            {t.label}
            {t.id === "incident" && frozenCount > 0 && (
              <em className="tab-badge">{frozenCount}</em>
            )}
          </button>
        ))}
        <span className="tabs-spacer" />
        <button onClick={() => downloadJson("organ-tuning-data.json", data)}>
          导出 JSON
        </button>
        <button onClick={handleReset}>清空并重置</button>
      </nav>

      <div className={"workspace " + (tab === "entry" ? "with-side" : "")}>
        {tab === "entry" && (
          <>
            <Sidebar data={data} filters={filters} onChange={setFilters} />
            <div className="stack">
              <EntryForm
                data={data}
                initialStopId={
                  filters.stopId === "all"
                    ? data.stops[data.stops.length - 1]?.id ?? ""
                    : filters.stopId
                }
                commit={commit}
                notify={notify}
              />
              <DeviationTable
                data={data}
                filters={filters}
                stopsById={stopsById}
              />
              <ClimateLog
                data={data}
                filters={filters}
                stopsById={stopsById}
              />
            </div>
          </>
        )}

        {tab === "deviation" && (
          <div className="stack full-width">
            <InlineFilter
              data={data}
              filters={filters}
              onChange={setFilters}
            />
            <DeviationTable
              data={data}
              filters={filters}
              stopsById={stopsById}
            />
          </div>
        )}

        {tab === "climate" && (
          <div className="stack full-width">
            <InlineFilter
              data={data}
              filters={filters}
              onChange={setFilters}
            />
            <ClimateLog
              data={data}
              filters={filters}
              stopsById={stopsById}
            />
          </div>
        )}

        {tab === "incident" && (
          <div className="stack full-width">
            <IncidentPanel
              data={data}
              stopsById={stopsById}
              commit={commit}
              notify={notify}
            />
          </div>
        )}

        {tab === "report" && (
          <div className="stack full-width">
            <ReportView
              data={data}
              selectedReportId={reportFocus}
              onSelect={setReportFocus}
              stopsById={stopsById}
            />
          </div>
        )}
      </div>

      <footer className="page-foot no-print">
        数据仅存于浏览器 localStorage（键 organ-tuning-console:v1），刷新与重开页面后保留。
      </footer>

      <div className="toasts no-print">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.kind}`}>
            {t.msg}
          </div>
        ))}
      </div>
    </main>
  );
}

function InlineFilter({
  data,
  filters,
  onChange,
}: {
  data: AppData;
  filters: Filters;
  onChange: (f: Filters) => void;
}) {
  return (
    <section className="panel inline-filter">
      <input
        className="search"
        placeholder="搜索场馆 / 音栓 / 音管编号 / 音高 / 备注…"
        value={filters.query}
        onChange={(e) => onChange({ ...filters, query: e.target.value })}
      />
      <div className="chips">
        <button
          className={filters.stopId === "all" ? "on" : ""}
          onClick={() => onChange({ ...filters, stopId: "all" })}
        >
          全部
        </button>
        {data.stops.map((s) => (
          <button
            key={s.id}
            className={filters.stopId === s.id ? "on" : ""}
            onClick={() => onChange({ ...filters, stopId: s.id })}
          >
            {s.name} {s.footage}
          </button>
        ))}
      </div>
    </section>
  );
}

export default App;
