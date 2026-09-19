import { useMemo, useState } from "react";
import type { AppData, RecordInput, ReedStatus } from "../types";
import { REED_STATUSES } from "../types";
import { isPipeFrozen, pipeKey } from "../store";

const PITCHES = [
  "C2", "D2", "E2", "F2", "G2", "A2", "B2",
  "C3", "C#3", "D3", "D#3", "E3", "F3", "F#3", "G3", "G#3", "A3", "A#3", "B3",
  "C4", "C#4", "D4", "D#4", "E4", "F4", "F#4", "G4", "G#4", "A4", "A#4", "B4",
  "C5", "C#5", "D5", "E5", "F5", "G5", "A5",
];

interface Props {
  data: AppData;
  onAdd: (input: RecordInput) => void;
}

export default function RecordForm({ data, onAdd }: Props) {
  const [venue, setVenue] = useState("");
  const [stop, setStop] = useState("");
  const [pipeNo, setPipeNo] = useState("");
  const [pitch, setPitch] = useState("");
  const [cents, setCents] = useState("");
  const [temp, setTemp] = useState("");
  const [humidity, setHumidity] = useState("");
  const [reed, setReed] = useState<ReedStatus>("正常");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const venues = useMemo(
    () => Array.from(new Set(data.records.map((r) => r.venue))).sort(),
    [data],
  );
  const stops = useMemo(
    () => Array.from(new Set(data.records.map((r) => r.stop))).sort(),
    [data],
  );

  const key =
    venue.trim() && stop.trim() && pipeNo.trim()
      ? pipeKey(venue, stop, pipeNo)
      : null;
  const frozen = key ? isPipeFrozen(data, venue, stop, pipeNo) : false;
  const frozenPipe = key ? data.pipes[key] : undefined;

  const reset = () => {
    setVenue("");
    setStop("");
    setPipeNo("");
    setPitch("");
    setCents("");
    setTemp("");
    setHumidity("");
    setReed("正常");
    setNote("");
    setError(null);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!venue.trim() || !stop.trim() || !pipeNo.trim() || !pitch.trim()) {
      setError("请完整填写场馆、音栓、音管编号和音高。");
      return;
    }
    const centsV = Number(cents);
    const tempV = Number(temp);
    const humV = Number(humidity);
    if (cents.trim() === "" || Number.isNaN(centsV)) {
      setError("请输入音分偏差（可为负数）。");
      return;
    }
    if (temp.trim() === "" || Number.isNaN(tempV)) {
      setError("请输入现场温度（℃）。");
      return;
    }
    if (humidity.trim() === "" || Number.isNaN(humV)) {
      setError("请输入现场相对湿度（%）。");
      return;
    }
    if (isPipeFrozen(data, venue, stop, pipeNo)) {
      setError("该音管处于冻结状态，必须先在「异常冻结」中写入现场复核结论才能继续调音。");
      return;
    }
    onAdd({
      venue: venue.trim(),
      stop: stop.trim(),
      pipeNo: pipeNo.trim(),
      pitch: pitch.trim(),
      cents: centsV,
      temp: tempV,
      humidity: humV,
      reed,
      note: note.trim() || undefined,
    });
    reset();
  };

  return (
    <form className="panel form-panel" onSubmit={submit}>
      <div className="heading">
        <div>
          <p>单次调音录入</p>
          <h2>新增维护记录</h2>
        </div>
        <button className="primary" type="submit" disabled={frozen}>
          提交记录
        </button>
      </div>

      {frozen && (
        <div className="freeze-banner">
          <strong>⛔ 音管已冻结：{stop} · {pipeNo}</strong>
          <span>
            该音管连续两次偏差同向且绝对值扩大，系统已冻结后续调音。
            共 {frozenPipe?.anomalyIds.length ?? 0} 次异常待复核，请前往「异常冻结」页填写现场复核结论。
          </span>
        </div>
      )}
      {error && <div className="form-error">{error}</div>}

      <div className="field-grid">
        <label>
          <span>场馆（教堂 / 音乐厅）</span>
          <input list="venue-list" value={venue} onChange={(e) => setVenue(e.target.value)} placeholder="如：St. Mary 教堂" />
          <datalist id="venue-list">{venues.map((v) => <option key={v} value={v} />)}</datalist>
        </label>
        <label>
          <span>音栓</span>
          <input list="stop-list" value={stop} onChange={(e) => setStop(e.target.value)} placeholder="如：Trumpet 8'" />
          <datalist id="stop-list">{stops.map((s) => <option key={s} value={s} />)}</datalist>
        </label>
        <label>
          <span>音管编号</span>
          <input value={pipeNo} onChange={(e) => setPipeNo(e.target.value)} placeholder="如：C#4" />
        </label>
        <label>
          <span>音高</span>
          <input list="pitch-list" value={pitch} onChange={(e) => setPitch(e.target.value)} placeholder="如：C#4 / 277Hz" />
          <datalist id="pitch-list">{PITCHES.map((p) => <option key={p} value={p} />)}</datalist>
        </label>
        <label>
          <span>音分偏差（cent，偏高为正）</span>
          <input type="number" step="any" value={cents} onChange={(e) => setCents(e.target.value)} placeholder="如：9 或 -12" />
        </label>
        <label>
          <span>簧片状态</span>
          <select value={reed} onChange={(e) => setReed(e.target.value as ReedStatus)}>
            {REED_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <label>
          <span>现场温度（℃）</span>
          <input type="number" step="any" value={temp} onChange={(e) => setTemp(e.target.value)} placeholder="如：20.5" />
        </label>
        <label>
          <span>相对湿度（%）</span>
          <input type="number" step="any" value={humidity} onChange={(e) => setHumidity(e.target.value)} placeholder="如：52" />
        </label>
        <label className="wide">
          <span>维修备注</span>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="操作内容、现场判断、待跟进事项" />
        </label>
      </div>
    </form>
  );
}
