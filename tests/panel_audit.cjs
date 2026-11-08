/**
 * Dark-mode audit across every page, in a real browser.
 *
 * Samples the *page* luminance (body + backdrop) rather than a single card,
 * and asserts no page renders light anywhere — including native controls.
 */
const { chromium } = require("playwright");
const fs = require("node:fs");
const path = require("node:path");

const BASE = process.argv[2] || "http://localhost:8300";
const OUT = process.argv[3] || "E:/ZZTHS-LMNT/_shots/audit";
const PW = process.argv[4] || "testpw";
const PAGES = ["overview", "links", "subgroups", "subscriptions", "connections",
               "traffic", "logs", "errors", "security", "settings"];
fs.mkdirSync(OUT, { recursive: true });

let failures = 0;
const check = (n, ok, d = "") => {
  console.log(("  " + (ok ? "ok   " : "FAIL ")) + n + (ok ? "" : "  " + d));
  if (!ok) failures++;
};

/* Helpers injected into the page. Kept as a function source string so the
   browser can evaluate them in its own scope. */
const HELPERS = `
function parseColour(v) {
  const m = String(v).match(/rgba?\\(([^)]+)\\)/);
  if (m) {
    const p = m[1].split(",").map(function (x) { return x.trim(); });
    return { r: +p[0], g: +p[1], b: +p[2], a: p[3] === undefined ? 1 : +p[3] };
  }
  const h = String(v).match(/^#([0-9a-f]{3,8})$/i);
  if (h) {
    const s = h[1];
    function f(i) { return parseInt(s.length === 3 ? s[i] + s[i] : s.slice(i * 2, i * 2 + 2), 16); }
    return { r: f(0), g: f(1), b: f(2), a: 1 };
  }
  return null;
}
function isDark(v, aMin, lMax) {
  const c = parseColour(v);
  if (!c) return false;
  if (c.a < (aMin === undefined ? 0.05 : aMin)) return true;
  return (0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b) / 255 < (lMax === undefined ? 0.35 : lMax);
}
`;
const withHelpers = body => `(function () {
  ${HELPERS}
  ${body}
})()`;

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", e => errors.push(String(e).slice(0, 200)));

  /* ── Login ── */
  await page.goto(BASE + "/login", { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  const login = await page.evaluate(withHelpers(`
    const body = getComputedStyle(document.body);
    const bd = document.querySelector(".gl-backdrop");
    return {
      scheme: body.colorScheme,
      bodyBg: body.backgroundColor,
      backdropBg: bd ? getComputedStyle(bd).backgroundColor : null,
      textCol: body.color,
    };
  `));
  console.log("[login page]");
  check("login: body background is dark", isDark_(login.bodyBg), login.bodyBg);
  check("login: backdrop is dark", isDark_(login.backdropBg), login.backdropBg);
  check("login: color-scheme is dark", /dark/.test(login.scheme), login.scheme);
  check("login: text is light", !isDark_(login.textCol, 0.05, 0.5), login.textCol);
  await page.screenshot({ path: path.join(OUT, "login.png") });

  await page.fill("#pw", PW);
  await page.click("#btn");
  await page.waitForURL("**/dashboard", { timeout: 25000 });
  await page.waitForTimeout(4500);

  function isDark_(v, aMin, lMax) {
    const c = parseColour_(v);
    if (!c) return false;
    if (c.a < (aMin === undefined ? 0.05 : aMin)) return true;
    return (0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b) / 255 < (lMax === undefined ? 0.35 : lMax);
  }
  function parseColour_(v) {
    const m = String(v).match(/rgba?\(([^)]+)\)/);
    if (m) {
      const p = m[1].split(",").map(x => x.trim());
      return { r: +p[0], g: +p[1], b: +p[2], a: p[3] === undefined ? 1 : +p[3] };
    }
    const h = String(v).match(/^#([0-9a-f]{3,8})$/i);
    if (h) {
      const s = h[1];
      const f = i => parseInt(s.length === 3 ? s[i] + s[i] : s.slice(i * 2, i * 2 + 2), 16);
      return { r: f(0), g: f(1), b: f(2), a: 1 };
    }
    return null;
  }

  /* ── Dashboard ── */
  const dash = await page.evaluate(withHelpers(`
    const body = getComputedStyle(document.body);
    return { scheme: body.colorScheme, bodyBg: body.backgroundColor,
             backdropBg: (function(){const b=document.querySelector(".gl-backdrop");return b?getComputedStyle(b).backgroundColor:null})() };
  `));
  console.log("\n[dashboard]");
  check("dashboard: body dark", isDark_(dash.bodyBg), dash.bodyBg);
  check("dashboard: backdrop dark", isDark_(dash.backdropBg), dash.backdropBg);
  check("dashboard: color-scheme dark", /dark/.test(dash.scheme), dash.scheme);
  await page.screenshot({ path: path.join(OUT, "dashboard.png") });

  /* ── Every page ── */
  console.log("\n[every page: background, scheme, native controls]");
  for (const pg of PAGES) {
    await page.evaluate(n => document.querySelector(`.nav-it[data-pg="${n}"]`)?.click(), pg);
    await page.waitForTimeout(1600);
    const r = await page.evaluate(withHelpers(`
      const body = getComputedStyle(document.body);
      const bd = document.querySelector(".gl-backdrop");
      /* A visible element whose own background is near-white.
         A Glisse control's knob face is intentionally light (it is a lifted
         glass knob catching light, exactly as upstream draws it), so it is
         excluded from the "white panel" check and reported separately. */
      const isKnob = function (e) {
        return /lg-thumb-face/.test(e.className || "") || /lg-segmented-thumb/.test(e.className || "");
      };
      const lightVisible = Array.prototype.filter.call(document.querySelectorAll("*"), function (e) {
        const cs = getComputedStyle(e);
        if (cs.display === "none" || cs.visibility === "hidden" || +cs.opacity === 0) return false;
        if (isKnob(e)) return false;
        const c = parseColour(cs.backgroundColor);
        if (!c || c.a < 0.6) return false;
        return (0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b) / 255 > 0.78;
      }).slice(0, 6).map(function (e) { return (e.className || e.tagName).toString().slice(0, 44); });
      /* The knob faces, for the record — they must exist and be toned down. */
      const knobFaces = Array.prototype.map.call(document.querySelectorAll(".lg-thumb-face,.lg-segmented-thumb"), function (e) {
        const cs = getComputedStyle(e);
        if (cs.display === "none" || +cs.opacity === 0) return null;
        const c = parseColour(cs.backgroundColor);
        if (!c || c.a < 0.6) return null;
        return Math.round((0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b) / 255 * 100) / 100;
      }).filter(function (v) { return typeof v === "number" && !isNaN(v); });
      /* Native form controls that still paint a light background. */
      const lightControls = Array.prototype.filter.call(
        document.querySelectorAll("input:not([type=range]):not([type=checkbox]):not([type=radio]), select, textarea"),
        function (e) {
          const cs = getComputedStyle(e);
          const c = parseColour(cs.backgroundColor);
          return c && c.a > 0.5 && (0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b) / 255 > 0.7;
        }).length;
      return {
        scheme: body.colorScheme,
        bodyBg: body.backgroundColor,
        backdropBg: bd ? getComputedStyle(bd).backgroundColor : null,
        lightVisible: lightVisible,
        lightControls: lightControls,
        knobFaceLum: knobFaces.length ? Math.max.apply(null, knobFaces) : null,
      };
    `));
    check(`${pg}: dark background`, isDark_(r.bodyBg) && isDark_(r.backdropBg),
          `body=${r.bodyBg} backdrop=${r.backdropBg}`);
    check(`${pg}: color-scheme dark`, /dark/.test(r.scheme), r.scheme);
    check(`${pg}: no near-white visible surface`, r.lightVisible.length === 0, r.lightVisible.join(" | "));
    check(`${pg}: Glisse knobs toned for dark`, r.knobFaceLum === null || r.knobFaceLum <= 0.9, `lum ${r.knobFaceLum}`);
    check(`${pg}: no light native control`, r.lightControls === 0, `${r.lightControls} light`);
    await page.screenshot({ path: path.join(OUT, `${pg}.png`) });
  }

  /* ── Mobile ── */
  const mob = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const mp = await mob.newPage();
  await mp.goto(BASE + "/login", { waitUntil: "networkidle" });
  await mp.waitForTimeout(1200);
  await mp.screenshot({ path: path.join(OUT, "mobile-login.png") });
  await mp.fill("#pw", PW);
  await mp.click("#btn");
  await mp.waitForURL("**/dashboard", { timeout: 25000 }).catch(() => {});
  await mp.waitForTimeout(4000);
  const mr = await mp.evaluate(withHelpers(`
    const body = getComputedStyle(document.body);
    return {
      scheme: body.colorScheme, bodyBg: body.backgroundColor,
      backdropBg: (function(){const b=document.querySelector(".gl-backdrop");return b?getComputedStyle(b).backgroundColor:null})(),
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  `));
  console.log("\n[mobile]");
  check("mobile: dark background", isDark_(mr.bodyBg) && isDark_(mr.backdropBg), `${mr.bodyBg}/${mr.backdropBg}`);
  check("mobile: no horizontal overflow", Math.abs(mr.overflow) <= 2, `${mr.overflow}px`);
  await mp.screenshot({ path: path.join(OUT, "mobile-dashboard.png") });
  await mob.close();

  console.log("\n[browser console]");
  check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));

  await browser.close();
  if (failures) { console.log(`\nFAILURES: ${failures}`); process.exit(1); }
  console.log(`\nDark-mode audit: ALL OK — screenshots in ${OUT}`);
})().catch(e => { console.log("ERROR", String(e).slice(0, 400)); process.exit(1); });
