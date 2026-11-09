"""Drive the shipped frontend through Chromium against the real API."""
import uuid
from playwright.sync_api import sync_playwright, expect
from http_contract import BASE, wait_ready

wait_ready(BASE)
name = "Morning shift " + uuid.uuid4().hex[:8]
with sync_playwright() as playwright:
    browser = playwright.chromium.launch()
    page = browser.new_page()
    page.goto("http://frontend")
    page.get_by_role("button", name="School admin").click()
    page.get_by_label("Class and shift").fill(name)
    page.get_by_label("Total seats").fill("1")
    page.get_by_role("button", name="Create class").click()
    page.get_by_role("button", name="Admissions", exact=True).click()
    page.get_by_label("Student birth registration number").fill("00000000000000042")
    page.get_by_role("button", name="Use this student").click()
    section = page.locator("section").filter(has=page.get_by_role("heading", name="Class availability"))
    card = section.locator("article").filter(has_text=name)
    card.get_by_role("button", name="Apply", exact=True).click()
    history = page.locator("section").filter(has=page.get_by_role("heading", name="My applications"))
    application = history.locator("article").filter(has_text=name)
    expect(application.get_by_text("HELD", exact=True)).to_be_visible()
    page.reload()
    expect(application.get_by_text("HELD", exact=True)).to_be_visible()
    application.get_by_role("button", name="Pay admission fee").click()
    expect(application.get_by_text("CONFIRMED", exact=True)).to_be_visible()
    expect(card.locator("dl div").filter(has_text="Confirmed").locator("dd")).to_have_text("1")
    browser.close()
print("PASS: create, apply, reload, pay and confirm through the browser.")
