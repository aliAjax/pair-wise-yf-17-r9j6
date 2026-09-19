import { useMemo, useState } from "react";
import type { AppData, MaintenanceRecord } from "../types";
import { pipeKey } from "../store";
import { fmtDate, fmtDateTime, fmtCents } from "../format";

interface Props {
  data: AppData;
  rows: MaintenanceRecord[];
}

interface Session {
  key: string;
  venue: string;
  date: string;
  rows: MaintenanceRecord[];
}

function sessionsOf(rows: MaintenanceRecord[]): Session[] {
  const map = new Map<string, Session>();
  for (const r of [...rows].sort((a, b) => a.ts - b.ts)) {
    const date = fmtDate(r.ts);
    const key = `${r.venue}@@${date}`;
    const s = map.get(key);
    if (s) s.rows.push(r);
    else map.set(key, { key, venue: r.venue, date, rows: [r] });
  }
  return Array.from(map.values()).sort((a, b) =>
    b.date === a.date ? b.venue.localeCompare(a.venue) : b.date.localeCompare(a.date),
  );
}

export default function MaintenanceReport({ data, rows }: Props) {
  const sessions = useMemo(() => sessionsOf(rows), [rows]);
  const [selected, setSelected] = useState<string | null>(null);

  const current =
    sessions.find((s) => s.key === selected) ?? sessions[0] ?? null;

  const print = () => window.print();

  if (!current) {
    return (
      <section className="panel">
        <div className="heading">
          <div>
            <p>单次维护报告</p>
            <h2>按场馆 + 日期生成</h2>
          </div>
        </div>
        <p className="empty">当前筛选下没有可生成报告的维护记录。</p>
      </section>
    );
  }

  const anomalies = data.anomalies.filter((a) =>
    current.rows.some(
      (r) => r.id === a.triggeredRecordId || r.id === a.previousRecordId,
    ),
  );
  const frozenKeys = new Set(
    current.rows
      .map((r) => pipeKey(r.venue, r.stop, r.pipeNo))
      .filter((k) => data.pipes[k]?.frozen),
  );
  const stops = Array.from(new Set(current.rows.map((r) => r.stop))).sort();
  const avgT = current.rows.reduce((s, r) => s + r.temp, 0) / current.rows.length;
  const avgH = current.rows.reduce((s, r) => s + r.humidity, 0) / current.rows.length;
  const maxAbs = current.rows.reduce((m, r) => Math.max(m, Math.abs(r.cents)), 0);
  const from = current.rows[0].ts;
  const to = current.rows[current.rows.length - 1].ts;

  return (
    <section className="panel report-panel">
      <div className="heading no-print">
        <div>
          <p>单次维护报告</p>
          <h2>按场馆 + 日期生成</h2>
        </div>
        <div className="report-actions">
          <select value={current.key} onChange={(e) => setSelected(e.target.value)}>
            {sessions.map((s) => (
              <option key={s.key} value={s.key}>
                {s.date} · {s.venue}（{s.rows.length} 管次）
              </option>
            ))}
          </select>
          <button className="primary" onClick={print}>打印 / 存为 PDF</button>
        </div>
      </div>

      <div className="report-sheet">
        <header className="report-head">
          <h2>管风琴单次维护报告</h2>
          <p>{current.venue} · {current.date}</p>
        </header>

        <div className="report-grid">
          <div><span>场馆</span><b>{current.venue}</b></div>
          <div><span>维护日期</span><b>{current.date}</b></div>
          <div><span>作业时段</span><b>{fmtDateTime(from)} — {fmtDateTime(to).slice(11)}</b></div>
          <div><span>涉及音栓</span><b>{stops.join("、")}</b></div>
          <div><span>调音管次</span><b>{current.rows.length}</b></div>
          <div><span>平均温度 / 湿度</span><b>{avgT.toFixed(1)}℃ / {avgH.toFixed(0)}%</b></div>
          <div><span>最大偏差</span><b>{fmtCents(current.rows.reduce((m, r) => Math.abs(r.cents) > Math.abs(m) ? r.cents : m, current.rows[0].cents))} cent（绝对值 {maxAbs}）</b></div>
          <div><span>本次冻结音管</span><b className={frozenKeys.size ? "neg" : ""}>{frozenKeys.size ? `${frozenKeys.size} 根` : "无"}</b></div>
        </div>

        <h3 className="subhead">调音明细</h3>
        <table className="data-table">
          <thead>
            <tr>
              <th>音栓</th><th>音管</th><th>音高</th>
              <th className="num">偏差(cent)</th><th>簧片状态</th><th>温/湿</th><th>备注</th>
            </tr>
          </thead>
          <tbody>
            {current.rows.map((r) => {
              const key = pipeKey(r.venue, r.stop, r.pipeNo);
              return (
                <tr key={r.id} className={frozenKeys.has(key) ? "row-frozen" : ""}>
                  <td>{r.stop}</td>
                  <td className="nowrap"><b>{r.pipeNo}</b></td>
                  <td>{r.pitch}</td>
                  <td className={`num cents ${r.cents > 0 ? "pos" : r.cents < 0 ? "neg" : "zero"}`}>{fmtCents(r.cents)}</td>
                  <td>{r.reed}</td>
                  <td className="nowrap">{r.temp.toFixed(1)}℃ / {r.humidity.toFixed(0)}%</td>
                  <td>{r.note ?? ""}{frozenKeys.has(key) ? "（该音管已冻结，待现场复核）" : ""}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <h3 className="subhead">异常与处置</h3>
        {anomalies.length === 0 ? (
          <p className="empty">本次维护未触发异常。</p>
        ) : (
          <div className="report-anomalies">
            {anomalies.map((a) => (
              <div key={a.id} className="anomaly-line">
                <span className={a.resolved ? "tag tag-ok" : "tag tag-frozen"}>
                  {a.resolved ? "已解除" : "冻结中"}
                </span>
                <b>{a.stop} · 音管 {a.pipeNo}</b>
                <span>偏差 {fmtCents(a.prevCents)} → {fmtCents(a.cents)} cent（同向扩大）</span>
                {a.resolved && <span className="conclusion-text">复核：{a.conclusion}</span>}
              </div>
            ))}
          </div>
        )}

        <div className="report-sign">
          <span>维护人签字：________________</span>
          <span>场馆确认：________________</span>
        </div>
      </div>
    </section>
  );
}
