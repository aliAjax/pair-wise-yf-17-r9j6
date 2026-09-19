import type { MaintenanceRecord } from "../types";
import { fmtDateTime } from "../format";
import { humidityLevel, tempLevel } from "../format";

interface Props {
  rows: MaintenanceRecord[];
}

function avg(xs: number[]): string {
  if (xs.length === 0) return "—";
  return (xs.reduce((s, x) => s + x, 0) / xs.length).toFixed(1);
}

export default function ClimateLog({ rows }: Props) {
  const sorted = [...rows].sort((a, b) => b.ts - a.ts);

  return (
    <section className="panel">
      <div className="heading">
        <div>
          <p>环境记录</p>
          <h2>温湿度记录（{sorted.length} 条）</h2>
        </div>
        <div className="climate-summary">
          <span>平均温度 <b>{avg(sorted.map((r) => r.temp))}℃</b></span>
          <span>平均湿度 <b>{avg(sorted.map((r) => r.humidity))}%</b></span>
        </div>
      </div>
      {sorted.length === 0 ? (
        <p className="empty">当前筛选下暂无温湿度记录。</p>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>时间</th>
                <th>场馆</th>
                <th>音栓</th>
                <th>音管</th>
                <th className="num">温度(℃)</th>
                <th className="num">湿度(%)</th>
                <th>环境评估</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => {
                const tl = tempLevel(r.temp);
                const hl = humidityLevel(r.humidity);
                const bad = tl === "bad" || hl === "bad";
                const warn = tl === "warn" || hl === "warn";
                return (
                  <tr key={r.id}>
                    <td className="nowrap">{fmtDateTime(r.ts)}</td>
                    <td>{r.venue}</td>
                    <td>{r.stop}</td>
                    <td className="nowrap">{r.pipeNo}</td>
                    <td className={`num lvl-${tl}`}>{r.temp.toFixed(1)}</td>
                    <td className={`num lvl-${hl}`}>{r.humidity.toFixed(0)}</td>
                    <td>
                      {bad ? (
                        <span className="tag tag-bad">超出维护区间，建议暂缓调音</span>
                      ) : warn ? (
                        <span className="tag tag-warn">接近限值，注意观察</span>
                      ) : (
                        <span className="tag tag-ok">适宜（15–22℃ / 45–60%）</span>
                      )}
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
