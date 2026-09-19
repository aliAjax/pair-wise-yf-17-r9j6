import { useMemo } from "react";
import type { AppData, Filters, Stop } from "../types";
import {
  isFrozenPipe,
  measurementsOfPipe,
  pipeKey,
} from "../storage";
import { formatCents, formatDateTime } from "../format";

interface Props {
  data: AppData;
  filters: Filters;
  stopsById: Map<string, Stop>;
}

export default function DeviationTable({
  data,
  filters,
  stopsById,
}: Props) {
  const rows = useMemo(() => {
    const q = filters.query.trim().toLowerCase();
    return data.measurements
      .filter((m) =>
        filters.stopId === "all" ? true : m.stopId === filters.stopId
      )
      .filter((m) => {
        if (!q) return true;
        const s = stopsById.get(m.stopId);
        return [s?.venue, s?.name, m.pipeNo, m.pitch, m.remark]
          .filter(Boolean)
          .some((v) => v!.toLowerCase().includes(q));
      })
      .sort((a, b) => b.createdAt - a.createdAt);
  }, [data, filters, stopsById]);

  function frozenOf(m: (typeof rows)[number]): boolean {
    const inc = data.incidents.find(
      (i) =>
        i.pipeKey === pipeKey(m.stopId, m.pipeNo) && i.resolved === null
    );
    return !!inc;
  }

  function trendOf(m: (typeof rows)[number]): string {
    const all = measurementsOfPipe(
      data,
      pipeKey(m.stopId, m.pipeNo)
    );
    const idx = all.findIndex((x) => x.id === m.id);
    if (idx <= 0) return "—";
    const prev = all[idx - 1];
    if (prev.cents * m.cents > 0) {
      if (Math.abs(m.cents) > Math.abs(prev.cents)) return "↗ 同向扩大";
      if (Math.abs(m.cents) < Math.abs(prev.cents)) return "↘ 同向收窄";
      return "→ 持平";
    }
    if (prev.cents === 0 || m.cents === 0) return "→ 归零/起步";
    return "⇄ 反向";
  }

  return (
    <section className="panel">
      <div className="heading">
        <div>
          <p>调音偏差表</p>
          <h2>
            偏差记录 <small>{rows.length} 条</small>
          </h2>
        </div>
      </div>
      {rows.length === 0 ? (
        <p className="empty">当前筛选下暂无偏差记录</p>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>时间</th>
                <th>场馆</th>
                <th>音栓</th>
                <th>音管</th>
                <th>音高</th>
                <th className="num">偏差</th>
                <th>趋势</th>
                <th>簧片</th>
                <th>状态</th>
                <th>备注</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((m) => {
                const s = stopsById.get(m.stopId);
                const frozen = frozenOf(m);
                const over = Math.abs(m.cents) >= 10;
                return (
                  <tr
                    key={m.id}
                    className={frozen ? "row-frozen" : over ? "row-over" : ""}
                  >
                    <td className="nowrap">{formatDateTime(m.createdAt)}</td>
                    <td>{s?.venue ?? "—"}</td>
                    <td>
                      {s?.name} {s?.footage}
                    </td>
                    <td className="nowrap">{m.pipeNo}</td>
                    <td>{m.pitch}</td>
                    <td className={`num cents ${over ? "cents-over" : ""}`}>
                      {formatCents(m.cents)}
                    </td>
                    <td className="nowrap">{trendOf(m)}</td>
                    <td>{m.reed}</td>
                    <td>
                      {frozen ? (
                        <span className="tag tag-frozen">🔒 冻结</span>
                      ) : over ? (
                        <span className="tag tag-over">超限</span>
                      ) : (
                        <span className="tag tag-ok">正常</span>
                      )}
                    </td>
                    <td className="remark-cell">{m.remark || "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="legend">
        判定规则：与上一条同管记录同向且 |偏差| 扩大 → 自动异常并冻结；|偏差|
        ≥ 10 cent 标为单次超限。
      </p>
    </section>
  );
}
