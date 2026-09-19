import { useMemo } from "react";
import type { AppData, Filters, Stop } from "../types";
import { formatDateTime } from "../format";

interface Props {
  data: AppData;
  filters: Filters;
  stopsById: Map<string, Stop>;
}

export default function ClimateLog({
  data,
  filters,
  stopsById,
}: Props) {
  const rows = useMemo(() => {
    return data.measurements
      .filter((m) =>
        filters.stopId === "all" ? true : m.stopId === filters.stopId
      )
      .sort((a, b) => b.createdAt - a.createdAt);
  }, [data, filters]);

  const temps = rows.map((r) => r.temp);
  const hums = rows.map((r) => r.humidity);
  const tMin = Math.min(10, ...temps);
  const tMax = Math.max(30, ...temps);
  const avg = (xs: number[]) =>
    xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;

  return (
    <section className="panel">
      <div className="heading">
        <div>
          <p>环境记录</p>
          <h2>
            温湿度记录 <small>{rows.length} 条</small>
          </h2>
        </div>
        {rows.length > 0 && (
          <div className="climate-summary">
            <span>
              平均温度 <b>{avg(temps).toFixed(1)} ℃</b>
            </span>
            <span>
              平均湿度 <b>{avg(hums).toFixed(0)} %</b>
            </span>
          </div>
        )}
      </div>

      {rows.length === 0 ? (
        <p className="empty">当前筛选下暂无温湿度记录</p>
      ) : (
        <div className="climate-list">
          {rows.map((m) => {
            const s: Stop | undefined = stopsById.get(m.stopId);
            const tPct =
              tMax === tMin ? 50 : ((m.temp - tMin) / (tMax - tMin)) * 100;
            const hPct = m.humidity;
            return (
              <article key={m.id} className="climate-row">
                <div className="climate-meta">
                  <b>
                    {s?.name} {s?.footage} · {m.pipeNo}
                  </b>
                  <span>
                    {s?.venue} · {formatDateTime(m.createdAt)}
                  </span>
                </div>
                <div className="climate-bars">
                  <div className="bar-line">
                    <em className="bar-label">温</em>
                    <div className="bar">
                      <i
                        className="bar-temp"
                        style={{ width: `${Math.max(2, tPct)}%` }}
                      />
                    </div>
                    <span className="bar-val">{m.temp.toFixed(1)} ℃</span>
                  </div>
                  <div className="bar-line">
                    <em className="bar-label">湿</em>
                    <div className="bar">
                      <i
                        className="bar-hum"
                        style={{ width: `${Math.max(2, hPct)}%` }}
                      />
                    </div>
                    <span className="bar-val">{m.humidity} %</span>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
