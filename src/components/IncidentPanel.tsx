import { useState } from "react";
import type { AppData, Stop } from "../types";
import { resolveIncident } from "../storage";
import { formatCents, formatDateTime } from "../format";

interface Props {
  data: AppData;
  stopsById: Map<string, Stop>;
  commit: <T>(fn: (d: AppData) => T) => T;
  notify: (msg: string, kind?: "ok" | "warn" | "err") => void;
}

export default function IncidentPanel({
  data,
  stopsById,
  commit,
  notify,
}: Props) {
  const [conclusions, setConclusions] = useState<Record<string, string>>({});

  const sorted = [...data.incidents].sort(
    (a, b) =>
      Number(a.resolved !== null) - Number(b.resolved !== null) ||
      b.triggeredAt - a.triggeredAt
  );
  const activeCount = data.incidents.filter((i) => !i.resolved).length;

  function pipeLabel(key: string): { venue: string; name: string; no: string } {
    const [sid, no] = key.split("::");
    const s: Stop | undefined = stopsById.get(sid);
    return { venue: s?.venue ?? "未知场馆", name: s ? `${s.name} ${s.footage}` : "未知音栓", no };
  }

  function handleUnfreeze(incidentId: string) {
    const text = conclusions[incidentId] ?? "";
    try {
      commit((d) => resolveIncident(d, incidentId, text));
      notify("已凭现场复核结论解除冻结，异常历史保留", "ok");
      setConclusions((prev) => ({ ...prev, [incidentId]: "" }));
    } catch (err) {
      notify(err instanceof Error ? err.message : "解除失败", "err");
    }
  }

  return (
    <section className="panel">
      <div className="heading">
        <div>
          <p>异常音管</p>
          <h2>
            异常与冻结 <small>{activeCount} 个冻结中 / {sorted.length} 条历史</small>
          </h2>
        </div>
      </div>

      {sorted.length === 0 ? (
        <p className="empty">
          暂无异常。同一音管连续两次偏差同向且绝对值扩大时，会自动出现在这里。
        </p>
      ) : (
        <div className="incident-list">
          {sorted.map((inc) => {
            const lab = pipeLabel(inc.pipeKey);
            const report = data.reports.find((r) => r.id === inc.reportId);
            return (
              <article
                key={inc.id}
                className={
                  "incident-card " +
                  (inc.resolved ? "is-resolved" : "is-frozen")
                }
              >
                <header>
                  <div>
                    <h3>
                      <span className="tag tag-muted">{lab.venue}</span>{" "}
                      {lab.name} · 音管 {lab.no}
                    </h3>
                    <p className="incident-meta">
                      触发于 {formatDateTime(inc.triggeredAt)}
                      {report && <> · 报告 {report.date}（{report.maintainer}）</>}
                    </p>
                  </div>
                  {inc.resolved ? (
                    <span className="tag tag-ok">✓ 已复核解冻</span>
                  ) : (
                    <span className="tag tag-frozen">🔒 冻结中</span>
                  )}
                </header>

                <div className="incident-delta">
                  <span>{formatCents(inc.prevCents)} cent</span>
                  <b>→</b>
                  <span className="delta-hot">{formatCents(inc.cents)} cent</span>
                  <small>连续两次同向、绝对值扩大，后续调音已自动冻结</small>
                </div>

                {inc.resolved ? (
                  <div className="conclusion">
                    <b>现场复核结论：</b>
                    <p>{inc.resolved.conclusion}</p>
                    <small>
                      复核时间：{formatDateTime(inc.resolved.at)}
                      ，异常记录归档保留
                    </small>
                  </div>
                ) : (
                  <div className="unfreeze-box">
                    <label>
                      <span>
                        现场复核结论（必填，需写明具体检查与处理结果，≥ 10
                        字；只写“已处理/正常”无法解冻）
                      </span>
                      <textarea
                        rows={2}
                        value={conclusions[inc.id] ?? ""}
                        onChange={(e) =>
                          setConclusions((prev) => ({
                            ...prev,
                            [inc.id]: e.target.value,
                          }))
                        }
                        placeholder="如：9月19日现场拆检 F2，确认调音钢丝固定螺丝松动，已紧固并复测 +1 cent，温湿度 22.5℃/51%，连续三次稳定。"
                      />
                    </label>
                    <button
                      type="button"
                      className="danger"
                      onClick={() => handleUnfreeze(inc.id)}
                    >
                      凭复核结论解除冻结
                    </button>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
