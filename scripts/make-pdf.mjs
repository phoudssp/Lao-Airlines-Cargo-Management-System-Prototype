// Builds the A4 landscape PDF walkthrough from the real screens.
import { chromium } from "playwright";
import { createServer } from "vite";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { MODULES } from "./pdf-pages.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const outDir = path.join(here, "out");
const pdfPath = path.resolve(root, "..", "ຕົ້ນແບບລະບົບ - Lao Airlines Cargo.pdf");
mkdirSync(outDir, { recursive: true });

const server = await createServer({ root, server: { port: 5199, strictPort: true }, logLevel: "error" });
await server.listen();
const base = "http://localhost:5199/";
const browser = await chromium.launch({ channel: "chrome" });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 860 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const problems = [];
page.on("pageerror", (e) => problems.push(`${page.url()}: ${e.message}`));

await page.goto(base + "#/login"); await page.waitForTimeout(1200);
const login = async (userId) => {
  await page.evaluate((u) => { const k = "qv-cargo-prototype"; const d = JSON.parse(localStorage.getItem(k) || "null"); if (d) { d.session.userId = u; d.session.station = "VTE"; d.session.lang = "lo"; localStorage.setItem(k, JSON.stringify(d)); } }, userId);
};
// The store writes to localStorage only after its first change, so force one by toggling language.
await page.getByRole("button", { name: "EN", exact: true }).click(); await page.getByRole("button", { name: "ລາວ", exact: true }).click();

const y = new Date(); const todayFlight = `F-QV101-${y.getFullYear()}-${String(y.getMonth() + 1).padStart(2, "0")}-${String(y.getDate()).padStart(2, "0")}`;
let n = 0; const shots = [];
for (const mod of MODULES) for (const p of mod.pages) {
  n += 1; const file = path.join(outDir, `p${String(n).padStart(2, "0")}.jpg`);
  await login(p.role); await page.goto("about:blank");
  await page.setViewportSize(p.viewport ?? { width: 1440, height: 860 });
  await page.goto(base + "#" + p.route.replace("F-QV101-TODAY", todayFlight)); await page.waitForTimeout(900);
  if (p.steps) { try { await p.steps(page); await page.waitForTimeout(450); } catch (e) { problems.push(`steps ${p.route}: ${e.message.split("\n")[0]}`); } }
  await page.screenshot({ path: file, type: "jpeg", quality: 88 });
  shots.push({ mod, p, file });
}
const b64 = (f, mime) => `data:${mime};base64,${readFileSync(f).toString("base64")}`;
const logo = b64(path.join(root, "public/logo.png"), "image/png");
const fontCss = ["400", "600", "700"].map((w) => { const f = path.join(root, `node_modules/@fontsource/noto-sans-lao/files/noto-sans-lao-lao-${w}-normal.woff2`); return existsSync(f) ? `@font-face{font-family:NSL;font-weight:${w};src:url(${b64(f, "font/woff2")})}` : ""; }).join("");
const latin = ["400", "600", "700"].map((w) => { const f = path.join(root, `node_modules/@fontsource/noto-sans/files/noto-sans-latin-${w}-normal.woff2`); return existsSync(f) ? `@font-face{font-family:NS;font-weight:${w};src:url(${b64(f, "font/woff2")})}` : ""; }).join("");
const pageCount = shots.length + MODULES.length + 1;
let pageNo = 1; let shotIdx = 0; const sections = [];
sections.push(`<section class="cover"><img src="${logo}" alt="Lao Airlines" width="260"/><div><h1>ຕົ້ນແບບລະບົບຄຸ້ມຄອງການຂົນສົ່ງສິນຄ້າທາງອາກາດ</h1><h2>Air Cargo Management System: Interface Prototype</h2></div><div class="meta"><p>ສະເໜີຕໍ່: ພະແນກບໍລິການຂົນສົ່ງສິນຄ້າ, ລັດວິສາຫະກິດການບິນລາວ</p><p>ສະເໜີໂດຍ: ບໍລິສັດ ລຸບແວ ເຕັກໂນໂລຊີ ແລະ ຄອນຊາວຕິງ ຈໍາກັດຜູ້ດຽວ</p><p class="note">ເອກະສານນີ້ແມ່ນພາກຜະໜວກຂອງບົດສະເໜີໂຄງການ. ຂໍ້ມູນທັງໝົດໃນໜ້າຈໍເປັນຂໍ້ມູນຈໍາລອງ ເພື່ອການພິຈາລະນາເທົ່ານັ້ນ.</p></div></section>`);
MODULES.forEach((mod) => {
  pageNo += 1;
  const list = mod.pages.map((p) => `<li><span>${p.name}</span><em>${p.ref}</em></li>`).join("");
  sections.push(`<section class="divider"><div><h1>${mod.title}</h1><h2>${mod.en}</h2><ul>${list}</ul></div><footer><span>ຕົ້ນແບບລະບົບ Lao Airlines Cargo</span><span>${pageNo} / ${pageCount}</span></footer></section>`);
  mod.pages.forEach((p) => {
    pageNo += 1; const s = shots[shotIdx++];
    sections.push(`<section class="shot"><header><div><h3>${p.name}</h3><p>${p.caption}</p></div><em>${p.ref}</em></header><div class="frame${p.phone ? " phone" : ""}"><img src="${b64(s.file, "image/jpeg")}"/></div><footer><span>ຕົ້ນແບບລະບົບ Lao Airlines Cargo</span><span>${pageNo} / ${pageCount}</span></footer></section>`);
  });
});
const html = `<!doctype html><html lang="lo"><head><meta charset="utf-8"><style>${fontCss}${latin}
@page{size:297mm 210mm;margin:0}*{box-sizing:border-box}html,body{margin:0;font-family:NS,NSL,sans-serif;color:#0f2233;-webkit-print-color-adjust:exact;print-color-adjust:exact}
section{width:297mm;height:210mm;page-break-after:always;overflow:hidden;position:relative;background:#fff}
.cover{background:#0b2a4a;color:#fff;padding:24mm 26mm;display:flex;flex-direction:column;justify-content:space-between}.cover h1{font-size:30px;line-height:1.5;margin:0;font-weight:600}.cover h2{font-size:17px;font-weight:400;margin:6px 0 0;color:#c6d6e6}.cover .meta p{margin:2px 0;font-size:14px;line-height:1.7}.cover .note{margin-top:12px!important;color:#9db4ca;font-size:12.5px!important}
.divider{padding:26mm;display:flex;align-items:center;background:#eff2f6}.divider h1{font-size:28px;line-height:1.5;margin:0;font-weight:600;color:#0b2a4a}.divider h2{font-size:15px;font-weight:400;margin:2px 0 18px;color:#47596b}.divider ul{list-style:none;padding:0;margin:0;columns:2;column-gap:14mm}.divider li{break-inside:avoid;padding:5px 0;border-top:1px solid #b9c5d1;font-size:13px;line-height:1.6}.divider li span{display:block}.divider li em{font-style:normal;color:#47596b;font-size:11.5px}.divider>div{width:100%}
.shot{padding:7mm 10mm 0}.shot header{display:flex;justify-content:space-between;gap:10mm;align-items:flex-start;height:17mm}.shot h3{margin:0;font-size:15.5px;font-weight:600;line-height:1.45;color:#0b2a4a}.shot p{margin:1px 0 0;font-size:11.5px;line-height:1.55;color:#47596b;max-width:190mm}.shot header em{font-style:normal;font-size:10.5px;color:#0f5596;white-space:nowrap;line-height:1.6;background:#e6eff8;padding:1px 7px;border-radius:3px}
.frame{height:170mm;display:flex;justify-content:center;align-items:flex-start}.frame img{max-width:100%;max-height:100%;display:block;border:1px solid #b9c5d1;border-radius:3px}
footer{position:absolute;left:10mm;right:10mm;bottom:4.5mm;display:flex;justify-content:space-between;font-size:9.5px;color:#6a7a8a}
</style></head><body>${sections.join("")}</body></html>`;
const htmlPath = path.join(outDir, "walkthrough.html"); writeFileSync(htmlPath, html);
const pdfPage = await browser.newPage();
await pdfPage.goto("file://" + htmlPath); await pdfPage.waitForTimeout(800);
await pdfPage.pdf({ path: pdfPath, width: "297mm", height: "210mm", printBackground: true });
await browser.close(); await server.close();
console.log(`PDF: ${pdfPath}, ${pageCount} pages`);
if (problems.length) { console.log("Problems:"); problems.forEach((x) => console.log(" -", x)); process.exitCode = 1; }
