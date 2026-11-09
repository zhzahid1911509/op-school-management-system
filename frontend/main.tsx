import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "./style.css";

const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:8080";

function App() {
  const [status, setStatus] = useState("Checking database connection…");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 8000);
    let active = true;
    setStatus("Checking database connection…");
    async function checkConnection() {
      try {
        const response = await fetch(apiUrl + "/health", { signal: controller.signal });
        if (!response.ok) throw new Error("Service unavailable");
        const health = await response.json();
        if (health.status !== "ready") throw new Error("Service unavailable");
        if (active) setStatus("API and PostgreSQL connected. Default reservation time: " + health.holdDurationSeconds + " seconds.");
      } catch {
        if (active) setStatus("Cannot reach the admission service. Check that Docker is running and try again.");
      } finally {
        window.clearTimeout(timeout);
      }
    }
    void checkConnection();
    return () => { active = false; window.clearTimeout(timeout); controller.abort(); };
  }, [attempt]);
  return <main><h1>School Admission System</h1><section>
    <h2>Service status</h2><p role="status">{status}</p>
    <button onClick={() => setAttempt(value => value + 1)}>Check connection</button>
  </section></main>;
}
createRoot(document.getElementById("root")!).render(<App />);
