import { useCallback, useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { api, message } from "./api";
import type { Application, Hold, SchoolClass } from "./api";

const storageKey = "admission.student";
const valid = (id: string) => /^[0-9]{17}$/.test(id);
function savedStudent() {
  try {
    const id = localStorage.getItem(storageKey) || "";
    return valid(id) ? id : "";
  } catch { return ""; }
}

export function App() {
  const [student, setStudent] = useState(savedStudent);
  const [draft, setDraft] = useState(student);
  const [notice, setNotice] = useState("");
  const [admin, setAdmin] = useState(false);
  function select(event: FormEvent) {
    event.preventDefault();
    if (!valid(draft)) { setNotice("Enter exactly 17 digits, including any leading zeros."); return; }
    setStudent(draft);
    setNotice("");
    try { localStorage.setItem(storageKey, draft); }
    catch { setNotice("Browser storage is unavailable. Re-enter the number on your next visit."); }
  }
  return <><header><div className="wrap"><strong>School Admission System</strong>
    <nav aria-label="Workspace"><button aria-pressed={!admin} onClick={() => setAdmin(false)}>Admissions</button>
    <button aria-pressed={admin} onClick={() => setAdmin(true)}>School admin</button></nav></div></header>
    <main className="wrap"><h1>{admin ? "School administration" : "Student admissions"}</h1>
    <form className="identity" onSubmit={select}><label>Student birth registration number
      <input value={draft} onChange={e => setDraft(e.target.value)} inputMode="numeric" maxLength={17}
        placeholder="17-digit number" /></label><button>Use this student</button>
      {student && <small>Selected student · {student}</small>}</form>
    {notice && <p role="alert">{notice}</p>}
    <Workspace key={student} student={student} admin={admin} />
    </main></>;
}

function Workspace({student, admin}: {student: string; admin: boolean}) {
  const [classes, setClasses] = useState<SchoolClass[] | null>(null);
  const [history, setHistory] = useState<Application[] | null>(null);
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now);
  const [className, setClassName] = useState("");
  const [capacity, setCapacity] = useState("");
  const revision = useRef(0);
  const alive = useRef(true);
  const locked = useRef(false);
  const refresh = useCallback(async () => {
    const version = ++revision.current;
    try {
      const [rows, applications] = await Promise.all([
        api<SchoolClass[]>("/classes"), student ? api<Application[]>("/me/holds", "GET", student) : Promise.resolve([])
      ]);
      if (alive.current && version === revision.current) {
        setClasses(rows); setHistory(applications); setLoadError("");
      }
    } catch (error) {
      if (alive.current && version === revision.current) setLoadError(message(error));
    }
  }, [student]);
  useEffect(() => {
    alive.current = true;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      await refresh();
      if (!stopped) timer = setTimeout(poll, 3000);
    }
    void poll();
    const tick = setInterval(() => setNow(Date.now()), 250);
    const focus = () => { setNow(Date.now()); void refresh(); };
    window.addEventListener("focus", focus);
    return () => { stopped = true; alive.current = false; ++revision.current;
      clearTimeout(timer); clearInterval(tick); window.removeEventListener("focus", focus); };
  }, [refresh]);

  async function action(run: () => Promise<string>) {
    if (locked.current) return;
    locked.current = true; setBusy(true); setActionError(""); setFeedback("");
    try {
      const text = await run();
      if (alive.current) setFeedback(text);
    } catch (error) { if (alive.current) setActionError(message(error)); }
    finally {
      if (alive.current) {
        await refresh();
        if (alive.current) setBusy(false);
      }
      locked.current = false;
    }
  }
  function create(event: FormEvent) {
    event.preventDefault();
    void action(async () => {
      const seats = Number(capacity);
      if (!className.trim() || !Number.isInteger(seats) || seats < 1 || seats > 2147483647)
        throw new Error("Enter the class and shift name and a positive whole-number capacity.");
      await api("/classes", "POST", "", {name: className.trim(), totalSeats: seats});
      setClassName(""); setCapacity(""); return "Class created.";
    });
  }
  return <>
    {actionError && <p role="alert">{actionError}</p>}
    {loadError && <p role="alert">{loadError} Displayed counts may be outdated. <button onClick={refresh}>Retry</button></p>}
    {feedback && <p role="status" className="feedback">{feedback}</p>}
    {admin && <section><h2>Create a class</h2><form className="create" onSubmit={create}>
      <label>Class and shift<input required value={className} placeholder="Class 6 – Morning Shift" onChange={e => setClassName(e.target.value)} /></label>
      <label>Total seats<input required type="number" min="1" max="2147483647" value={capacity} onChange={e => setCapacity(e.target.value)} /></label>
      <button disabled={busy}>Create class</button></form></section>}
    <section><h2>Class availability</h2>
    {!admin && !student && <p>Select a student above to apply.</p>}
    {classes === null ? <p>{loadError ? "Class list unavailable." : "Loading classes…"}</p> :
      classes.length === 0 ? <p>No classes have been created yet.</p> :
      <div className="grid">{classes.map(c => {
        const hasSeat = history?.some(h => h.classId === c.id && (h.status === "CONFIRMED" ||
          (h.status === "HELD" && Date.parse(h.expiresAt) > now)));
        return <article key={c.id}><h3>{c.name}</h3><dl>{Object.entries({
          Available: c.availableSeats, Held: c.heldSeats, Confirmed: c.confirmedSeats, Total: c.totalSeats
        }).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
        {!admin && <button disabled={busy || !student || !c.availableSeats || hasSeat} onClick={() => action(async () => {
          await api<Hold>("/classes/" + c.id + "/holds", "POST", student); return "Seat held. Your payment deadline is shown below.";
        })}>{hasSeat ? "Already applied" : c.availableSeats ? "Apply" : "Class full"}</button>}
        <button className="quiet" disabled={busy} onClick={() => action(async () => {
          const row = await api<SchoolClass>("/classes/" + c.id);
          return row.name + " · " + row.availableSeats + " seats available.";
        })}>Check availability</button></article>;
      })}</div>}
    </section>
    {!admin && student && <section><h2>My applications</h2>
      {history === null ? <p>{loadError ? "History unavailable." : "Loading history…"}</p> :
        history.length === 0 ? <p>No applications for this student.</p> :
        history.map(h => {
          const seconds = Math.max(0, Math.ceil((Date.parse(h.expiresAt) - now) / 1000));
          const status = h.status === "HELD" && !seconds ? "EXPIRED" : h.status;
          return <article key={h.holdId}><h3>{h.className}</h3><strong className="status">{status}</strong>
            {status === "HELD" && <p>Time to pay · {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}</p>}
            {(status === "HELD" || status === "EXPIRED") && <div className="actions">
            <button disabled={busy || status !== "HELD"} onClick={() => action(async () => {
              await api("/holds/" + h.holdId + "/confirm", "POST", student); return "Fee recorded. Admission confirmed.";
            })}>Pay admission fee</button>
            <button className="quiet" disabled={busy || status !== "HELD"} onClick={() => action(async () => {
              await api("/holds/" + h.holdId, "DELETE", student); return "Application cancelled.";
            })}>Cancel</button></div>}
            <button className="quiet" disabled={busy} onClick={() => action(async () => {
              const detail = await api<Hold>("/holds/" + h.holdId);
              return h.className + " · " + detail.status + " · Hold deadline " + new Date(detail.expiresAt).toLocaleString();
            })}>Check application status</button></article>;
        })}
    </section>}
  </>;
}
