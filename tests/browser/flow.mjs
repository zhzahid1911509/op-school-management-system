import { chromium } from 'playwright-core';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';

async function waitForApi() {
  const deadline = Date.now() + 90000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch('http://backend:8080/health', {signal: AbortSignal.timeout(3000)});
      if (response.ok) return;
    } catch { /* The API may still be initializing PostgreSQL. */ }
    await delay(1000);
  }
  throw new Error('Admission API did not become ready within 90 seconds.');
}

await waitForApi();
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  page.setDefaultTimeout(15000);
  const name = 'Morning shift ' + randomUUID().slice(0, 8);
  await page.goto('http://frontend');
  await page.getByRole("heading", {name:"শিক্ষার্থী ভর্তি"}).waitFor();
  await page.getByRole("button", {name:"English"}).click();
  await page.getByRole('button', {name:'School admin'}).click();
  await page.getByLabel('Class and shift').fill(name);
  await page.getByLabel('Total seats').fill('1');
  await page.getByRole('button', {name:'Create class'}).click();
  await page.getByText('Class created.', {exact:true}).waitFor();
  await page.getByRole('button', {name:'Admissions', exact:true}).click();
  await page.getByLabel('Student birth registration number').fill('00000000000000042');
  const card = page.locator('section').filter({has:page.getByRole('heading', {name:'Class availability'})})
    .locator('article').filter({hasText:name});
  await card.getByRole('button', {name:'Apply', exact:true}).click();
  const application = page.locator('section').filter({has:page.getByRole('heading', {name:'My applications'})})
    .locator('article').filter({hasText:name});
  await application.getByText('HELD', {exact:true}).waitFor();
  await page.reload();
  await application.getByText('HELD', {exact:true}).waitFor();
  await application.getByRole('button', {name:'Pay admission fee'}).click();
  await application.getByText('CONFIRMED', {exact:true}).waitFor();
  await card.locator('dl div').filter({hasText:'Confirmed'}).locator('dd').filter({hasText:/^1$/}).waitFor();
  console.log('PASS: create, apply, reload, pay and confirm through the browser.');
} finally {
  await browser.close();
}
