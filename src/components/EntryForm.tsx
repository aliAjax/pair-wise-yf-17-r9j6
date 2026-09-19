import { useMemo, useState } from "react";
import type {
  AppData,
  ReedStatus,
  StopKind,
} from "../types";
import {
  addMeasurement,
  addReport,
  addStop,
  detectEscalation,
  isFrozenPipe,
  pipeKey,
  pipeStatuses,
} from "../storage";
import { formatCents, today } from "../format";

const REEDS: ReedStatus[] = ["正常", "需微调", "已修整", "需更换"];
const KINDS: StopKind[] = ["主音栓", "簧片音栓", "混合音栓", "低音管"];

interface Props {
  data: AppData;
  initialStopId: string;
  commit: <T>(fn: (d: AppData) => T) => T;
  notify: (msg: string, kind?: "ok" | "warn" | "err") => void;
}

const fieldCls = "fld";

export default function EntryForm({
  data,
  initialStopId,
  commit,
  notify,
}: Props) {
  const [reportMode, setReportMode] = useState<"existing" | "new">(
    data.reports.length ? "existing" : "new"
  );
  const [reportId, setReportId] = useState(
    data.reports[data.reports.length - 1]?.id ?? ""
  );
  const [newVenue, setNewVenue] = useState("");
  const [newDate, setNewDate] = useState(today());
  const [maintainer, setMaintainer] = useState("");
  const [reportNote, setReportNote] = useState("");

  const [stopId, setStopId] = useState(
    data.stops.some((s) => s.id === initialStopId)
      ? initialStopId
      : data.stops[0]?.id ?? ""
  );
  const [addingStop, setAddingStop] = useState(false);
  const [stopVenue, setStopVenue] = useState("");
  const [stopName, setStopName] = useState("");
  const [stopKind, setStopKind] = useState<StopKind>("主音栓");
  const [stopFootage, setStopFootage] = useState("8'");

  const [pipeNo, setPipeNo] = useState("");
  const [pitch, setPitch] = useState("");
  const [cents, setCents] = useState("");
  const [temp, setTemp] = useState("22");
  const [humidity, setHumidity] = useState("50");
  const [reed, setReed] = useState<ReedStatus>("正常");
  const [remark, setRemark] = useState("");

  const stop = data.stops.find((s) => s.id === stopId);
  const statuses = useMemo(() => pipeStatuses(data), [data]);
  const key = stop && pipeNo.trim() ? pipeKey(stop.id, pipeNo) : "";
  const status = key ? statuses.get(key) : undefined;
  const frozen = status ? isFrozenPipe(status) : false;
  const resolvedBefore =
    status?.incident && status.incident.resolved !== null;

  const centsNum = Number(cents);
  const centsValid = cents.trim() !== "" && Number.isFinite(centsNum);
  const willEscalate =
    centsValid &&
    !!status &&
    detectEscalation(status.latest, centsNum) &&
    !frozen;

  function resolveReportId(): string {
    if (reportMode === "existing") return reportId;
    const venue = newVenue.trim() || stop?.venue || "";
    if (!venue) throw new Error("请填写场馆名称");
    if (!maintainer.trim()) throw new Error("请填写维护人");
    const { report } = commit((d) =>
      addReport(d, {
        venue,
        date: newDate,
        maintainer: maintainer.trim(),
        note: reportNote.trim(),
      })
    );
    return report.id;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      if (!stop) throw new Error("请先选择或新增音栓");
      if (frozen)
        throw new Error(
          "该音管已冻结，请到「异常音管」页填写现场复核结论解除冻结后再调音"
        );
      if (!pipeNo.trim()) throw new Error("请填写音管编号");
      if (!pitch.trim()) throw new Error("请填写音高");
      if (!centsValid) throw new Error("请填写音分偏差（数字）");
      if (centsNum < -100 || centsNum > 100)
        throw new Error("音分偏差超出合理范围（-100 ~ +100）");
      const t = Number(temp);
      const h = Number(humidity);
      if (!Number.isFinite(t) || t < -10 || t > 50)
        throw new Error("温度超出合理范围（-10 ~ 50 ℃）");
      if (!Number.isFinite(h) || h < 0 || h > 100)
        throw new Error("湿度超出合理范围（0 ~ 100 %）");

      const rid = resolveReportId();

      let currentStopId = stopId;
      if (addingStop) {
        const venue = stopVenue.trim() || newVenue.trim();
        if (!venue) throw new Error("请填写音栓所属场馆");
        if (!stopName.trim()) throw new Error("请填写音栓名称");
        const { stop: created } = commit((d) =>
          addStop(d, {
            venue,
            name: stopName.trim(),
            kind: stopKind,
            footage: stopFootage.trim() || "—",
          })
        );
        currentStopId = created.id;
      }

      const result = commit((d) =>
        addMeasurement(d, {
          reportId: rid,
          stopId: currentStopId,
          pipeNo: pipeNo.trim(),
          pitch: pitch.trim(),
          cents: centsNum,
          temp: t,
          humidity: h,
          reed,
          remark: remark.trim(),
        })
      );

      if (result.frozen && result.incident) {
        notify(
          `⚠ ${stop?.name ?? ""} ${pipeNo.trim()} 连续两次偏差同向且绝对值扩大（${formatCents(
            result.incident.prevCents
          )} → ${formatCents(
            result.incident.cents
          )} cent），已自动标记异常并冻结后续调音`,
          "warn"
        );
      } else {
        notify("维护记录已保存", "ok");
      }
      setPipeNo("");
      setPitch("");
      setCents("");
      setReed("正常");
      setRemark("");
    } catch (err) {
      notify(err instanceof Error ? err.message : "保存失败", "err");
    }
  }

  return (
    <form className="panel entry-form" onSubmit={handleSubmit}>
      <div className="heading">
        <div>
          <p>单次维护</p>
          <h2>录入调音记录</h2>
        </div>
        <button type="submit" className="primary" disabled={frozen}>
          保存记录
        </button>
      </div>

      {/* 维护报告 */}
      <fieldset>
        <legend>维护报告</legend>
        <div className="seg">
          <button
            type="button"
            className={reportMode === "existing" ? "on" : ""}
            onClick={() => setReportMode("existing")}
          >
            归入已有报告
          </button>
          <button
            type="button"
            className={reportMode === "new" ? "on" : ""}
            onClick={() => setReportMode("new")}
          >
            新建报告
          </button>
        </div>
        {reportMode === "existing" ? (
          <label className={fieldCls}>
            <span>选择报告</span>
            <select
              value={reportId}
              onChange={(e) => setReportId(e.target.value)}
            >
              {data.reports.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.date} · {r.venue} · {r.maintainer}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <div className="field-grid">
            <label className={fieldCls}>
              <span>场馆（教堂 / 音乐厅）</span>
              <input
                value={newVenue}
                onChange={(e) => setNewVenue(e.target.value)}
                placeholder={stop?.venue ?? "如：St. Mary 大教堂"}
              />
            </label>
            <label className={fieldCls}>
              <span>维护日期</span>
              <input
                type="date"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
              />
            </label>
            <label className={fieldCls}>
              <span>维护人</span>
              <input
                value={maintainer}
                onChange={(e) => setMaintainer(e.target.value)}
                placeholder="姓名"
              />
            </label>
            <label className={fieldCls}>
              <span>本次维护概述</span>
              <input
                value={reportNote}
                onChange={(e) => setReportNote(e.target.value)}
                placeholder="如：演出前排音"
              />
            </label>
          </div>
        )}
      </fieldset>

      {/* 音栓 / 音管 */}
      <fieldset>
        <legend>音栓与音管</legend>
        {!addingStop ? (
          <div className="row-gap">
            <div className="field-grid">
              <label className={fieldCls}>
                <span>音栓</span>
                <select
                  value={stopId}
                  onChange={(e) => setStopId(e.target.value)}
                >
                  {data.stops.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.venue} · {s.name} {s.footage}（{s.kind}）
                    </option>
                  ))}
                </select>
              </label>
              <div className="stop-add">
                <button
                  type="button"
                  onClick={() => {
                    setAddingStop(true);
                    setStopVenue(stop?.venue ?? "");
                  }}
                >
                  ＋ 新增音栓
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="field-grid">
            <label className={fieldCls}>
              <span>场馆</span>
              <input
                value={stopVenue}
                onChange={(e) => setStopVenue(e.target.value)}
                placeholder="所属教堂 / 音乐厅"
              />
            </label>
            <label className={fieldCls}>
              <span>音栓名称</span>
              <input
                value={stopName}
                onChange={(e) => setStopName(e.target.value)}
                placeholder="如：Mixture"
              />
            </label>
            <label className={fieldCls}>
              <span>类型</span>
              <select
                value={stopKind}
                onChange={(e) => setStopKind(e.target.value as StopKind)}
              >
                {KINDS.map((k) => (
                  <option key={k}>{k}</option>
                ))}
              </select>
            </label>
            <label className={fieldCls}>
              <span>标称音管长度</span>
              <input
                value={stopFootage}
                onChange={(e) => setStopFootage(e.target.value)}
              />
            </label>
            <div className="stop-add">
              <button type="button" onClick={() => setAddingStop(false)}>
                取消，选择已有音栓
              </button>
            </div>
          </div>
        )}

        <div className="field-grid">
          <label className={fieldCls}>
            <span>音管编号</span>
            <input
              value={pipeNo}
              onChange={(e) => setPipeNo(e.target.value)}
              placeholder="如：F2 / No.037"
            />
          </label>
          <label className={fieldCls}>
            <span>音高</span>
            <input
              value={pitch}
              onChange={(e) => setPitch(e.target.value)}
              placeholder="如：C#4"
            />
          </label>
        </div>

        {status && (
          <div
            className={
              "pipe-hint " +
              (frozen ? "hint-frozen" : resolvedBefore ? "hint-resolved" : "")
            }
          >
            {frozen ? (
              <>
                <b>🔒 该音管已冻结</b>
                <span>
                  最近偏差 {formatCents(status.incident!.prevCents)} →{" "}
                  {formatCents(status.incident!.cents)} cent，需现场复核解冻后方可继续调音。
                </span>
              </>
            ) : (
              <>
                <span>
                  上次测量：{formatCents(status.latest.cents)} cent
                  {status.incident?.resolved && (
                    <em>
                      {" "}
                      · 曾异常，已于现场复核后解冻（历史保留）
                    </em>
                  )}
                </span>
                {willEscalate && (
                  <b className="warn-text">
                    ⚠ 同向且绝对值扩大，保存后将自动标为异常并冻结该音管
                  </b>
                )}
              </>
            )}
          </div>
        )}
      </fieldset>

      {/* 测量数据 */}
      <fieldset>
        <legend>测量数据</legend>
        <div className="field-grid">
          <label className={fieldCls}>
            <span>音分偏差（cent）</span>
            <input
              value={cents}
              onChange={(e) => setCents(e.target.value)}
              placeholder="正偏高 / 负偏低，如 -6"
              inputMode="decimal"
            />
          </label>
          <label className={fieldCls}>
            <span>温度（℃）</span>
            <input
              value={temp}
              onChange={(e) => setTemp(e.target.value)}
              inputMode="decimal"
            />
          </label>
          <label className={fieldCls}>
            <span>相对湿度（%）</span>
            <input
              value={humidity}
              onChange={(e) => setHumidity(e.target.value)}
              inputMode="decimal"
            />
          </label>
          <label className={fieldCls}>
            <span>簧片状态</span>
            <select
              value={reed}
              onChange={(e) => setReed(e.target.value as ReedStatus)}
            >
              {REEDS.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          </label>
        </div>
        <label className={`${fieldCls} full`}>
          <span>维修备注</span>
          <input
            value={remark}
            onChange={(e) => setRemark(e.target.value)}
            placeholder="如：簧舌尖偏移，已轻压调音钢丝"
          />
        </label>
      </fieldset>
    </form>
  );
}
