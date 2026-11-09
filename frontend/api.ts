export interface SchoolClass {
  id: string; name: string; totalSeats: number; heldSeats: number; confirmedSeats: number; availableSeats: number;
}
export interface Hold {
  holdId: string; classId: string; status: "HELD" | "CONFIRMED" | "CANCELLED" | "EXPIRED"; expiresAt: string;
}
export interface Application extends Hold { className: string }

const base = (import.meta.env.VITE_API_URL || "http://localhost:8080").replace(/\/$/, "");
export async function api<T>(path: string, method = "GET", student = "", body?: unknown): Promise<T> {
  const headers: Record<string, string> = {};
  if (student) headers["X-Student-Id"] = student;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  let response: Response;
  try {
    response = await fetch(base + path, {
      method, headers, body: JSON.stringify(body), cache: "no-store", signal: AbortSignal.timeout(10000)
    });
  } catch {
    throw new Error("Cannot reach the admission service. Check your connection and try again.");
  }
  if (!response.ok) {
    const problem = await response.json().catch(() => null);
    throw new Error(problem?.error || "The request failed. Refresh and try again.");
  }
  return response.status === 204 ? undefined as T : response.json();
}
export function message(error: unknown) {
  return error instanceof Error ? error.message : "Please try again.";
}
