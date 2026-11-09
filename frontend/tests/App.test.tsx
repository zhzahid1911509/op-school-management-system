import React from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { App } from "../App";
import { api } from "../api";
import type { Application, SchoolClass } from "../api";

vi.mock("../api", async original => ({ ...await original<typeof import("../api")>(), api: vi.fn() }));
const request = vi.mocked(api);
const student = "00000000000000001";
const room: SchoolClass = {id:"c", name:"Class 6 – Morning", totalSeats:1, heldSeats:0, confirmedSeats:0, availableSeats:1};
let rooms: SchoolClass[];
let rows: Application[];
let deadline: number;

beforeEach(() => {
  localStorage.clear();
  rooms = [{...room}]; rows = []; deadline = Date.now() + 60000;
  request.mockReset();
  request.mockImplementation(async (path, method = "GET", id = "", body) => {
    if (path === "/classes" && method === "GET") return rooms.map(c => ({...c}));
    if (path === "/me/holds") return id === student ? rows.map(h => ({...h})) : [];
    if (path === "/classes" && method === "POST") {
      rooms.push({...room, id:"new", ...(body as {name:string;totalSeats:number})}); return rooms[1];
    }
    if (path === "/classes/c/holds" && method === "POST" && id === student) {
      rows = [{holdId:"h", classId:"c", className:room.name, expiresAt:new Date(deadline).toISOString(), status:"HELD"}];
      return rows[0];
    }
    if (path === "/holds/h/confirm" && id === student) { rows[0].status="CONFIRMED"; return rows[0]; }
    if (path === "/holds/h" && method === "DELETE" && id === student) { rows[0].status="CANCELLED"; return undefined; }
    throw new Error("Unexpected request: " + path);
  });
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

function select(value: string) {
  fireEvent.change(screen.getByLabelText("Student birth registration number"), {target:{value}});
  fireEvent.click(screen.getByText("Use this student"));
}
async function apply() {
  render(<App/>); select(student);
  fireEvent.click(await screen.findByRole("button", {name:"Apply"}));
  await screen.findByText("HELD");
}

it("validates identity and confirms the selected student's hold", async () => {
  render(<App/>); select("123");
  expect(screen.getByRole("alert").textContent).toContain("17 digits");
  select(student); fireEvent.click(await screen.findByText("Apply"));
  fireEvent.click(await screen.findByText("Pay admission fee"));
  await screen.findByText("CONFIRMED");
  expect(request).toHaveBeenCalledWith("/holds/h/confirm", "POST", student);
});
it("restores history after reopening, then cancels the hold", async () => {
  await apply(); cleanup(); render(<App/>);
  expect((screen.getByLabelText("Student birth registration number") as HTMLInputElement).value).toBe(student);
  await screen.findByText("HELD"); fireEvent.click(screen.getByText("Cancel"));
  await screen.findByText("CANCELLED");
});
it("expires the countdown and disables payment before the next poll", async () => {
  deadline = Date.now() + 950; await apply();
  await screen.findByText("EXPIRED", {}, {timeout:2500});
  expect((screen.getByText("Pay admission fee") as HTMLButtonElement).disabled).toBe(true);
});
it("creates a class in the admin workspace", async () => {
  rooms = []; render(<App/>); fireEvent.click(screen.getByText("School admin"));
  fireEvent.change(screen.getByLabelText("Class and shift"), {target:{value:"Class 7 Day"}});
  fireEvent.change(screen.getByLabelText("Total seats"), {target:{value:"30"}});
  fireEvent.click(screen.getByRole("button", {name:"Create class"}));
  await screen.findByText("Class 7 Day");
  expect(request).toHaveBeenCalledWith("/classes", "POST", "", {name:"Class 7 Day", totalSeats:30});
});
it("refreshes availability automatically and shows conflicts in the UI", async () => {
  render(<App/>); select(student); const applyButton = await screen.findByText("Apply");
  request.mockRejectedValueOnce(new Error("Class is full")); rooms[0].availableSeats = 0;
  fireEvent.click(applyButton);
  await screen.findByText("Class is full");
  await screen.findByRole("button", {name:"Class full"});
  rooms[0].availableSeats = 1;
  await waitFor(() => expect(screen.getByText("Apply")).toBeTruthy(), {timeout:5000});
});
it("clears previous history when the guardian switches students", async () => {
  await apply(); select("00000000000000002");
  await screen.findByText("No applications for this student.");
  expect(screen.queryByText("HELD")).toBeNull();
  expect(localStorage.getItem("admission.student")).toBe("00000000000000002");
});
