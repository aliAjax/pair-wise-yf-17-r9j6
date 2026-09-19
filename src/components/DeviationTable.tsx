import type { AppData, MaintenanceRecord } from "../types";
import { pipeKey } from "../store";
import { fmtDateTime, fmtCents } from "../format";

interface Props {
  data: AppData;
  rows: MaintenanceRecord[];
  onDelete: (id: string) => void;
}

export default function DeviationTable({ data, rows, onDelete }: Props) {
  const sorted = [...rows].sort((a, b) => b.ts - a.ts);

  return (
    <section className="panel">
      <div className="heading">
        <div>
          <p>调音偏差表</p>
          <h2>音分偏差记录（{sorted.length} 条）</h2>
        </div>
      </div>
      {sorted.length === 0 ? (
        <p className="empty">当前筛选下暂无调音记录。</p>
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
                <th className="num">偏差(cent)</th>
                <th>簧片</th>
                <th>状态 / 备注</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => {
                const key = pipeKey(r.venue, r.stop, r.pipeNo);
                const pipe = data.pipes[key];
                const frozen = pipe?.frozen;
                const referenced = data.anomalies.some(
                  (a) =>
                    a.triggeredRecordId === r.id || a.previousRecordId === r.id,
                );
                const cls = r.cents > 0 ? "pos" : r.cents < 0 ? "neg" : "zero";
                return (
                  <tr key={r.id} className={frozen ? "row-frozen" : referenced ? "row-anomaly" : ""}>
                    <td className="nowrap">{fmtDateTime(r.ts)}</td>
                    <td>{r.venue}</td>
                    <td>{r.stop}</td>
                    <td className="nowrap"><b>{r.pipeNo}</b></td>
                    <td>{r.pitch}</td>
                    <td className={`num cents ${cls}`}>{fmtCents(r.cents)}</td>
                    <td>{r.reed}</td>
                    <td className="note-cell">
                      {frozen && <span className="tag tag-frozen">已冻结</span>}
                      {referenced && <span className="tag tag-anomaly">异常链</span>}
                      {r.note ?? ""}
                    </td>
                    <td className="nowrap">
                      <button
                        className="mini"
                        disabled={referenced}
                        title={referenced ? "异常判定链引用的记录不可删除" : "删除此记录"}
                        onClick={() => onDelete(r.id)}
                      >
                        删除
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
