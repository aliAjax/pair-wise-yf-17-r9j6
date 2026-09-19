import { useMemo, useState } from "react";
import type { AppData, Stop } from "../types";
import { pipeKey } from "../storage";
import { formatCents, formatDateTime } from "../format";

interface Props {
  data: AppData;
  selectedReportId: string;
  onSelect: (id: string) => void;
  stopsById: Map<string, Stop>;
}

export default function ReportView({
  data,
  selectedReportId,
  onSelect,
  stopsById,
}: Props) {
  const reports = useMemo(
    () => [...data.reports].sort((a, b) => b.createdAt - a.createdAt),
    [data.reports]
  );
  const [internalId, setInternalId] = useState("");
  const activeId = selectedReportId || internalId || reports[0]?.id || "";
  const report = reports.find((r) => r.id === activeId);
  const items = report
    ? data.measurements
        .filter((m) => m.reportId === report.id)
        .sort((a, b) => a.createdAt - b.createdAt)
    : [];

  const frozenKeys = new Set(
    data.incidents
      .filter((i) => !i.resolved)
      .map((i) => i.pipeKey)
  );

  const avg = (xs: number[]) =>
    xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;

  return (
    <section className="panel report-view">
      <div className="heading">
        <div>
          <p>单次维护报告</p>
          <h2>按报告查看本次维护</h2>
        </div>
        {report && (
          <button
            type="button"
            className="no-print"
            onClick={() => window.print()}
          >
            打印 / 存为 PDF
          </button>
        )}
      </div>

      {reports.length === 0 ? (
        <p className="empty">还没有维护报告，请先在「录入」中新建。</p>
      ) : (
        <>
          <div className="report-tabs no-print">
            {reports.map((r) => (
              <button
                key={r.id}
                className={r.id === activeId ? "on" : ""}
                onClick={() => {
                  setInternalId(r.id);
                  onSelect(r.id);
                }}
              >
                {r.date} · {r.venue}
              </button>
            ))}
          </div>

          {report && (
            <div className="report-sheet">
              <header className="sheet-head">
                <h3>
                  管风琴维护报告 · {report.venue}
                </h3>
                <dl>
                  <div>
                    <dt>日期</dt>
                    <dd>{report.date}</dd>
                  </div>
                  <div>
                    <dt>维护人</dt>
                    <dd>{report.maintainer}</dd>
                  </div>
                  <div>
                    <dt>测量音管</dt>
                    <dd>{items.length} 支</dd>
                  </div>
                  <div>
                    <dt>平均温湿度</dt>
                    <dd>
                      {items.length
                        ? `${avg(items.map((i) => i.temp)).toFixed(1)} ℃ / ${avg(
                            items.map((i) => i.humidity)
                          ).toFixed(0)} %`
                        : "—"}
                    </dd>
                  </div>
                </dl>
                {report.note && <p className="report-note">{report.note}</p>}
              </header>

              {items.length === 0 ? (
                <p className="empty">该报告下暂无测量记录。</p>
              ) : (
                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>音栓</th>
                        <th>音管</th>
                        <th>音高</th>
                        <th className="num">偏差(cent)</th>
                        <th>温度</th>
                        <th>湿度</th>
                        <th>簧片</th>
                        <th>状态</th>
                        <th>备注</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((m) => {
                        const s: Stop | undefined = stopsById.get(m.stopId);
                        const frozen = frozenKeys.has(
                          pipeKey(m.stopId, m.pipeNo)
                        );
                        const over = Math.abs(m.cents) >= 10;
                        return (
                          <tr
                            key={m.id}
                            className={
                              frozen ? "row-frozen" : over ? "row-over" : ""
                            }
                          >
                            <td>
                              {s?.name} {s?.footage}
                            </td>
                            <td>{m.pipeNo}</td>
                            <td>{m.pitch}</td>
                            <td className="num">{formatCents(m.cents)}</td>
                            <td>{m.temp.toFixed(1)} ℃</td>
                            <td>{m.humidity} %</td>
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

              <footer className="sheet-foot">
                生成时间 {formatDateTime(Date.now())} · 数据保存在本浏览器本地
              </footer>
            </div>
          )}
        </>
      )}
    </section>
  );
}
