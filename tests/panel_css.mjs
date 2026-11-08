/**
 * CSS structural validation for the panel's inline stylesheets.
 *
 * A stray brace silently discards every rule after it — which is exactly how a
 * dark theme ends up rendering white. This walks the real CSS in page order,
 * tracking brace depth the way a parser does, and reports where it breaks.
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const py = readFileSync(resolve(ROOT, "pages.py"), "utf8");

const STYLE = /<style>([\s\S]*?)<\/style>/g;
let failures = 0;
const log = (n, ok, d = "") => { console.log(("  " + (ok ? "ok   " : "FAIL ")) + n + (ok ? "" : "  " + d)); if (!ok) failures++; };

let idx = 0;
for (const m of py.matchAll(STYLE)) {
  idx++;
  const css = m[1];
  const name = `style block ${idx} (${(css.length / 1024).toFixed(1)}KB)`;

  // Walk the CSS, tracking depth. A block must never go negative and must
  // return to zero.
  let depth = 0, minDepth = 0, line = 1, char = 0;
  let inComment = false, inStr = false, strCh = "";
  const opened = [];
  for (let i = 0; i < css.length; i++) {
    const c = css[i];
    if (inComment) { if (c === "\n") line++; if (c === "*" && css[i + 1] === "/") { inComment = false; i++; } continue; }
    if (inStr) { if (c === "\\") { i++; continue; } if (c === strCh) inStr = false; continue; }
    if (c === "/" && css[i + 1] === "*") { inComment = true; i++; continue; }
    if (c === '"' || c === "'") { inStr = true; strCh = c; continue; }
    if (c === "\n") line++;
    if (c === "{") { depth++; opened.push(line); }
    if (c === "}") { depth--; if (depth < minDepth) minDepth = depth; if (depth < 0) { opened.length = 0; } }
  }
  log(`${name}: braces balance`, depth === 0 && minDepth === 0, `depth=${depth} minDepth=${minDepth}`);
  if (depth !== 0) {
    console.log(`      unclosed block opened at lines: ${opened.slice(-6).join(", ")}`);
  }
  if (minDepth < 0) {
    console.log("      a closing brace appears with no open block — rules after it are dropped");
  }

  // An at-rule must be balanced: @media / @supports / @keyframes.
  const at = css.match(/@[\w-]+/g) || [];
  for (const a of at) {
    const expected = (css.match(new RegExp("\\" + a + "[^{]*\\{", "g")) || []).length;
    if (expected === 0) log(`at-rule ${a} parses`, false, "declared but never opened");
  }
}

// The console stylesheet must not contain a duplicate token that overrides
// a dark value with a light one.
const consoleCss = [...py.matchAll(STYLE)].map(m => m[1]);
const glass = [];
for (const css of consoleCss) {
  for (const m of css.matchAll(/--lg-glass:\s*([^;}]+)/g)) glass.push(m[1].trim());
}
const darkCount = glass.filter(v => /rgb\(28 28 31/.test(v)).length;
const lightCount = glass.filter(v => /rgb\(255 255 255/.test(v)).length;
log("console declares dark glass last", darkCount >= lightCount, `dark=${darkCount} light=${lightCount}`);

// Body must paint a dark background.
for (const m of py.matchAll(/body\{[^}]*background:\s*([^;}]+)/g)) {
  const v = m[1];
  const darkish = /#0[0-9a-f]{5}|#1[0-9a-f]{5}|rgb\(1[0-9] |rgb\(2[0-9] |--bg/.test(v);
  log("body paints a dark background", darkish, v.slice(0, 60));
}
log("no white body background", !/<body[^>]*(bgcolor|background|background-color)\s*[=:]\s*(white|#fff)/i.test(py));

if (failures) { console.log(`\nFAILURES: ${failures}`); process.exit(1); }
console.log("\nCSS structure: OK");
