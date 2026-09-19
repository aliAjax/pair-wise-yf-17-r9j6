import { useMemo } from "react";
import type { AppData, Filters } from "../types";
import { pipeKey } from "../storage";

interface Props {
  data: AppData;
  filters: Filters;
  onChange: (f: Filters) => void;
}

interface Row {
  id: string;
  label: string;
  sub: string;
  kind: string;
  count: number;
  frozen: number;
  over: number;
}

export default function Sidebar({ data, filters, onChange }: Props) {
  const frozenKeys = new Set(
    data.incidents.filter((i) => !i.resolved).map((i) => i.pipeKey)
  );

  const rows: Row[] = useMemo(() => {
    return data.stops.map((s) => {
      const ms = data.measurements.filter((m) => m.stopId === s.id);
      return {
        id: s.id,
        label: `${s.name} ${s.footage}`,
        sub: s.venue,
        kind: s.kind,
        count: ms.length,
        frozen: ms.filter((m) =>
          frozenKeys.has(pipeKey(m.stopId, m.pipeNo))
        ).length,
        over: ms.filter(
          (m) =>
            Math.abs(m.cents) >= 10 &&
            !frozenKeys.has(pipeKey(m.stopId, m.pipeNo))
        ).length,
      };
    });
  }, [data, frozenKeys]);

  const totalFrozen = frozenKeys.size;

  return (
    <aside className="panel sidebar">
      <h2>音栓筛选</h2>
      <input
        className="search"
        placeholder="搜索场馆 / 音栓 / 音管 / 音高…"
        value={filters.query}
        onChange={(e) => onChange({ ...filters, query: e.target.value })}
      />

      <button
        className={"stop-row stop-all " + (filters.stopId === "all" ? "on" : "")}
        onClick={() => onChange({ ...filters, stopId: "all" })}
      >
        <b>全部音栓</b>
        <span className="stop-stats">
          {data.measurements.length} 条
          {totalFrozen > 0 && <em className="dot dot-frozen">{totalFrozen} 冻结</em>}
        </span>
      </button>

      <div className="stop-list">
        {rows.map((r) => (
          <button
            key={r.id}
            className={"stop-row " + (filters.stopId === r.id ? "on" : "")}
            onClick={() => onChange({ ...filters, stopId: r.id })}
          >
            <span className="stop-kind">{r.kind}</span>
            <b>{r.label}</b>
            <small>{r.sub}</small>
            <span className="stop-stats">
              {r.count} 条
              {r.frozen > 0 && (
                <em className="dot dot-frozen">🔒 {r.frozen}</em>
              )}
              {r.over > 0 && <em className="dot dot-over">⚠ {r.over}</em>}
            </span>
          </button>
        ))}
        {rows.length === 0 && (
          <p className="empty">还没有音栓，请在录入表单中新增。</p>
        )}
      </div>
    </aside>
  );
}
