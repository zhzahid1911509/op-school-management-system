import { useCallback, useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { api, message } from "./api";
import type { Application, Hold, SchoolClass } from "./api";

import { asciiDigits, digits, errorText, label, languageKey, savedLanguage } from "./language";
import type { Label, Language } from "./language";

const storageKey = "admission.student";
const valid = (id: string) => /^[0-9]{17}$/.test(id);
function savedStudent() {
  try {
    const id = localStorage.getItem(storageKey) || "";
    return valid(id) ? id : "";
  } catch { return ""; }
}

export function App() {
  const [lang, setLang] = useState(savedLanguage);
  const t = (key: Label) => label(lang, key);
  useEffect(() => {
    document.documentElement.lang = lang;
    document.title = label(lang, "School Admission System");
    try { localStorage.setItem(languageKey, lang); } catch { /* Preference applies for this visit. */ }
  }, [lang]);
  const [draft, setDraft] = useState(savedStudent);
  const student = valid(draft) ? draft : "";
  const [notice, setNotice] = useState("");
  const [admin, setAdmin] = useState(false);
  function edit(value: string) {
    const digits = asciiDigits(value).replace(/[^0-9]/g, "").slice(0, 17);
    setDraft(digits);
    setNotice("");
    try {
      if (valid(digits)) localStorage.setItem(storageKey, digits);
      else localStorage.removeItem(storageKey);
    } catch { setNotice("Browser storage is unavailable. Re-enter the number on your next visit."); }
  }
  return <><header><div className="wrap"><strong>{t("School Admission System")}</strong>
    <nav aria-label={t("Workspace")}><button aria-pressed={!admin} onClick={() => setAdmin(false)}>{t("Admissions")}</button>
    <button aria-pressed={admin} onClick={() => setAdmin(true)}>{t("School admin")}</button></nav>
    <nav aria-label={lang === "bn" ? "ভাষা" : "Language"}>
      <button lang="bn" aria-pressed={lang === "bn"} onClick={() => setLang("bn")}>বাংলা</button>
      <button lang="en" aria-pressed={lang === "en"} onClick={() => setLang("en")}>English</button>
    </nav></div></header>
    <main className="wrap"><h1>{admin ? t("School administration") : t("Student admissions")}</h1>
    <div className="identity"><label>{t("Student birth registration number")}
      <input value={draft} onChange={e => edit(e.target.value)} inputMode="numeric" type="text"
        aria-describedby="digit-count" placeholder={t("17-digit number")} /></label>
      <small id="digit-count" aria-live="polite">{digits(lang, draft.length)}/{digits(lang, 17)} {t("digits")} · {student ? t("Complete") :
        digits(lang, 17 - draft.length) + " " + t("remaining")}</small></div>
    {notice && <p role="alert">{errorText(lang, notice)}</p>}
    <Workspace key={student} student={student} admin={admin} lang={lang} />
    </main></>;
}

function Workspace({student, admin, lang}: {student: string; admin: boolean; lang: Language}) {
  const t = (key: Label) => label(lang, key);
  const [classes, setClasses] = useState<SchoolClass[] | null>(null);
  const [history, setHistory] = useState<Application[] | null>(null);
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [feedback, setFeedback] = useState<((language: Language) => string) | null>(null);
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

  async function action(run: () => Promise<(language: Language) => string>) {
    if (locked.current) return;
    locked.current = true; setBusy(true); setActionError(""); setFeedback(null);
    try {
      const text = await run();
      if (alive.current) setFeedback(() => text);
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
      setClassName(""); setCapacity(""); return language => label(language, "Class created.");
    });
  }
  return <>
    {actionError && <p role="alert">{errorText(lang, actionError)}</p>}
    {loadError && <p role="alert">{errorText(lang, loadError)} {t("Displayed counts may be outdated.")} <button onClick={refresh}>{t("Retry")}</button></p>}
    {feedback && <p role="status" className="feedback">{feedback(lang)}</p>}
    {admin && <section><h2>{t("Create a class")}</h2><form noValidate className="create" onSubmit={create}>
      <label>{t("Class and shift")}<input required value={className} placeholder={t("Class 6 – Morning Shift")} onChange={e => setClassName(e.target.value)} /></label>
      <label>{t("Total seats")}<input required inputMode="numeric" value={capacity} onChange={e => setCapacity(asciiDigits(e.target.value))} /></label>
      <button disabled={busy}>{t("Create class")}</button></form></section>}
    <section><h2>{t("Class availability")}</h2>
    {!admin && !student && <p>{t("Enter the full 17-digit number above to apply.")}</p>}
    {classes === null ? <p>{loadError ? t("Class list unavailable.") : t("Loading classes…")}</p> :
      classes.length === 0 ? <p>{t("No classes have been created yet.")}</p> :
      <div className="grid">{classes.map(c => {
        const hasSeat = history?.some(h => h.classId === c.id && (h.status === "CONFIRMED" ||
          (h.status === "HELD" && Date.parse(h.expiresAt) > now)));
        return <article key={c.id}><h3>{c.name}</h3><small>{t("Class ID")} · {c.id}</small><dl>{Object.entries({
          Available: c.availableSeats, Held: c.heldSeats, Confirmed: c.confirmedSeats, Total: c.totalSeats
        }).map(([label, value]) => <div key={label}><dt>{t(label as Label)}</dt><dd>{digits(lang, value)}</dd></div>)}</dl>
        {!admin && <button disabled={busy || !student || !c.availableSeats || hasSeat} onClick={() => action(async () => {
          await api<Hold>("/classes/" + c.id + "/holds", "POST", student); return language => label(language, "Seat held. Your payment deadline is shown below.");
        })}>{hasSeat ? t("Already applied") : c.availableSeats ? t("Apply") : t("Class full")}</button>}
        <button className="quiet" disabled={busy} onClick={() => action(async () => {
          const row = await api<SchoolClass>("/classes/" + c.id);
          return language => row.name + " · " + digits(language, row.availableSeats) + (language === "en" ? " " : "") + label(language, "seats available.");
        })}>{t("Check availability")}</button></article>;
      })}</div>}
    </section>
    {!admin && student && <section><h2>{t("My applications")}</h2>
      {history === null ? <p>{loadError ? t("History unavailable.") : t("Loading history…")}</p> :
        history.length === 0 ? <p>{t("No applications for this student.")}</p> :
        history.map(h => {
          const seconds = Math.max(0, Math.ceil((Date.parse(h.expiresAt) - now) / 1000));
          const status = h.status === "HELD" && !seconds ? "EXPIRED" : h.status;
          return <article key={h.holdId}><h3>{h.className}</h3><p>{t("Application ID")} · {h.holdId}</p><strong className="status">{t(status)}</strong>
            {status === "HELD" && <p>{t("Time to pay")} · {digits(lang, Math.floor(seconds / 60))}:{digits(lang, String(seconds % 60).padStart(2, "0"))}</p>}
            {(status === "HELD" || status === "EXPIRED") && <div className="actions">
            <button disabled={busy || status !== "HELD"} onClick={() => action(async () => {
              await api("/holds/" + h.holdId + "/confirm", "POST", student); return language => label(language, "Fee recorded. Admission confirmed.");
            })}>{t("Pay admission fee")}</button>
            <button className="quiet" disabled={busy || status !== "HELD"} onClick={() => action(async () => {
              await api("/holds/" + h.holdId, "DELETE", student); return language => label(language, "Application cancelled.");
            })}>{t("Cancel")}</button></div>}
            <button className="quiet" disabled={busy} onClick={() => action(async () => {
              const detail = await api<Hold>("/holds/" + h.holdId);
              return language => h.className + " · " + label(language, detail.status) + " · " + label(language, "Hold deadline") + " " + new Date(detail.expiresAt).toLocaleString(language === "bn" ? "bn-BD" : "en-GB");
            })}>{t("Check application status")}</button></article>;
        })}
    </section>}
  </>;
}
