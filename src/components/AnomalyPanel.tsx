import { useState } from "react";
import type { AnomalyEvent, AppData } from "../types";
import { fmtDateTime, fmtCents } from "../format";

interface Props {
  data: AppData;
  stopFilter: string;
  venueFilter: string;
  onResolve: (anomalyId: string, conclusion: string) => void;
}

function UnfreezeBox({
  anomaly,
  onResolve,
}: {
  anomaly: AnomalyEvent;
  onResolve: (id: string, conclusion: string) => void;
}) {
  const [text, setText] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const t = text.trim();
    if (t.length < 10) {
      setErr("请写出具体的现场复核结论（不少于 10 个字），不能只写“正常 / 已修”。");
      return;
    }
    onResolve(anomaly.id, t);
  };

  return (
    <form className="unfreeze" onSubmit={submit}>
      <textarea
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setErr(null);
        }}
        placeholder="现场复核结论：写明排查到的原因、采取的处置、复测结果（例：经逐管试压发现管身接缝漏风，已补胶并稳湿 24h，连续三次复测偏差在 ±3cent 内……）"
        rows={3}
      />
      {err && <p className="form-error">{err}</p>}
      <div className="unfreeze-actions">
        <button className="primary" type="submit">写入复核结论并解除冻结</button>
        <span className="hint">解除后异常历史仍永久保留；若偏差再次同向扩大将重新冻结。</span>
      </div>
    </form>
  );
}

export default function AnomalyPanel({
  data,
  stopFilter,
  venueFilter,
  onResolve,
}: Props) {
  const events = data.anomalies
    .filter((a) => (stopFilter === "全部" ? true : a.stop === stopFilter))
    .filter((a) => (venueFilter === "全部" ? true : a.venue === venueFilter))
    .sort((a, b) => b.detectedAt - a.detectedAt);

  const frozenEvents = events.filter((a) => !a.resolved);
  const historyEvents = events.filter((a) => a.resolved);

  const renderEvent = (a: AnomalyEvent) => {
    const rec = data.records.find((r) => r.id === a.triggeredRecordId);
    return (
      <article key={a.id} className={`anomaly-card ${a.resolved ? "resolved" : "active"}`}>
        <header>
          <div>
            <h3>{a.venue} · {a.stop} · 音管 {a.pipeNo}</h3>
            <p className="anomaly-meta">
              检出时间 {fmtDateTime(a.detectedAt)}
              {rec ? `　音高 ${rec.pitch}` : ""}
            </p>
          </div>
          {a.resolved ? (
            <span className="tag tag-ok">已解除 · 历史保留</span>
          ) : (
            <span className="tag tag-frozen">冻结中</span>
          )}
        </header>
        <p className="anomaly-chain">
          连续两次偏差同向扩大：
          <b className={a.prevCents >= 0 ? "pos" : "neg"}> {fmtCents(a.prevCents)} cent</b> →
          <b className={a.cents >= 0 ? "pos" : "neg"}> {fmtCents(a.cents)} cent</b>
        </p>
        {!a.resolved ? (
          <UnfreezeBox anomaly={a} onResolve={onResolve} />
        ) : (
          <div className="conclusion">
            <p><b>现场复核结论：</b>{a.conclusion}</p>
            <p className="anomaly-meta">解除时间：{a.resolvedAt ? fmtDateTime(a.resolvedAt) : "—"}</p>
          </div>
        )}
      </article>
    );
  };

  return (
    <section className="panel anomaly-panel">
      <div className="heading">
        <div>
          <p>异常冻结</p>
          <h2>异常音管与冻结管理</h2>
        </div>
        <div className="anomaly-counts">
          <span className="tag tag-frozen">冻结中 {frozenEvents.length}</span>
          <span className="tag tag-ok">已解除 {historyEvents.length}</span>
        </div>
      </div>
      <p className="hint rule-line">
        规则：同一音管连续两次调音偏差方向相同、且绝对值扩大时自动标记异常并冻结该音管的后续调音；只有写入具体现场复核结论才能解除。
      </p>

      {frozenEvents.length > 0 && (
        <>
          <h3 className="subhead">待处理冻结</h3>
          <div className="anomaly-list">{frozenEvents.map(renderEvent)}</div>
        </>
      )}

      <h3 className="subhead">异常历史（解除后保留）</h3>
      {historyEvents.length === 0 ? (
        <p className="empty">暂无已解除的异常记录。</p>
      ) : (
        <div className="anomaly-list">{historyEvents.map(renderEvent)}</div>
      )}

      {events.length === 0 && (
        <p className="empty">当前筛选下没有异常记录。</p>
      )}
    </section>
  );
}
