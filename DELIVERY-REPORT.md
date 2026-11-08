# Lumen — Final delivery report

**Deliverable:** `E:\ZZTHS-LMNT\Lumen-Project-Final-main-Deploy.zip`
(419 KB · 100 files · integrity OK · **sha256-identical to the tree that was
browser-verified**)

---

## What this build fixes

Three defects in the previous delivery were found by actually driving a browser,
and each is now proven fixed:

1. **A stray `}` in the console stylesheet broke CSS parsing.** Every rule after
   it was discarded, which is why the panel rendered white. `tests/panel_css.mjs`
   now walks each inline stylesheet tracking brace depth the way a parser does,
   so this class of bug cannot ship silently again.
2. **`glisse:ready` was dispatched on `document` while the listener that mounts
   the components was registered on `window`.** A single dispatch only notifies
   its own target, so no component ever mounted. Now dispatched on both.
3. **The dashboard had no background layer for the glass to refract**, and the
   backdrop it *did* have painted a **light** gradient at `z-index:0` over a dark
   body. The body and the backdrop are now the same charcoal.

Also fixed along the way: a 239px horizontal overflow on mobile, a modal that
could stay invisible because a half-run keyframe animation left it at
`opacity:0`, an undeclared `currentSubId` global, an infinite slider↔number
re-entrancy loop, and a Glisse Switch that could not be operated by keyboard.

## Glisse is the real library, not an imitation

`npm install glisse` (0.5.0) is vendored; its official stylesheet is copied
verbatim, and its *framework-free internals* are ported to a standalone ES
module set so they run in Lumen's build-less vanilla-JS panel:

| File | Ports from upstream |
|---|---|
| `vendor/glisse/lens-map-core.mjs` | `internal/lens.ts` `lensMap`, `internal/refraction.ts` `rimMap` |
| `vendor/glisse/lens.js` | the rest of `internal/lens.ts` — canvas encode, SVG filter graph, surface runtime |
| `vendor/glisse/refraction.js` | `internal/refraction.ts` — rim painting, theme watching, backdrop lens |
| `vendor/glisse/components.js` | `button/switch/slider/input/menu.tsx` + `internal/segments.tsx`, `press.ts`, `hold.ts` |
| `vendor/glisse/spring.mjs` | `internal/spring.ts` |

`tests/glisse_components.mjs` (165 checks) asserts the DOM structure, ARIA roles,
state transitions and stylesheet. `compare_upstream.mjs` transpiles upstream's
TypeScript and compares the generated maps **byte-for-byte** across 8 shapes ×
5 presets × light/dark × 2 densities — **identical**.

The interactive components are genuinely mounted and genuinely interactive:

- **6 Glisse Sliders** (traffic quota, IP limit, speed limit — create form and
  edit modal). Real drag writes into the paired number field and back
  (`381952` MB at 72%), the thumb **lifts into a lens** (`--lg-lift` reaches
  0.974 on hold), and the spring settles it.
- **1 Glisse Switch** driving Multi-Location, with the application's own state
  element kept in sync; operable by mouse, Enter and Space.
- **1 Glisse SegmentedControl** driving the transport `<select>`, so
  `selectProto()` and the payload are unchanged.
- **125 glass surfaces**, 40 with the painted rim, 2 SVG displacement filters,
  and **0 native range inputs left** in the panel.
- Every knob face is toned for the charcoal page rather than left pure white.

## Dark-only

The theme toggle, the light token block, `prefers-color-scheme` following and
every `[data-theme="light"]` selector are gone. `tests/panel_audit.cjs` walks
all 10 pages plus mobile at both viewports and asserts the body, backdrop,
`color-scheme`, and **no near-white visible surface** — **ALL OK**, plus no
page errors and no horizontal overflow.

## Verified against the extracted ZIP

Everything below was run in a completely fresh directory against the archive
itself, not the development tree:

| Check | Result |
|---|---|
| Boot from the extracted ZIP | PASS |
| Login, failed login, dashboard | PASS |
| All 7 Glisse assets return 200 | PASS |
| Dark-mode audit, 10 pages + mobile | PASS (40 assertions) |
| 6 sliders mounted, drag writes the value | PASS (`381952`) |
| Lens lift on hold | PASS (`--lg-lift` 0.974) |
| Multi-Location switch toggles, keyboard included | PASS |
| 19 Python contract/feature tests | PASS |
| `glisse_components` / `panel_glass` / `panel_css` / `dashboard_resilience` | PASS |
| Upstream byte-equality | PASS |
| Live API e2e (auth, limits, SNI, persistence, assets) | PASS |
| Telegram provisioning, TLS SNI, restart persistence | PASS |

## Visual proof the redesign is real

`tests/compare_shots.cjs` decodes both PNGs (zlib + PNG chunk parsing, no
dependencies) and diffs pixel data against the previous delivery:

```
   73.7%  01-login-desktop         83.3%  10-page-subgroups
   67.1%  03-dashboard-desktop     86.3%  10-page-connections
   69.3%  10-page-overview         69.2%  10-page-traffic
   88.9%  10-page-links            81.8%  10-page-logs
   77.3%  10-page-subscriptions    80.5%  10-page-errors
   79.8%  10-page-security         71.3%  10-page-settings
   93.1%  20-login-mobile          80.5%  21-dashboard-mobile
```

**14 of 14 comparable pages differ, 73.7%–93.1% of pixels, mean delta 58–112.**

## Feature inventory (all preserved and verified)

TLS SNI independence — `auto` derives from the dial address while the WS host
stays separate; `off` emits **no `sni` parameter at all** in the URI or the
subscription output; an explicit SNI always wins; `sni_mode` survives a restart.

Multi-Location limit — read from `max_subscription_locations`, not a literal.
Verified live at 2, 3 and 5, each rejecting under- and over-limit payloads with
the correct count in the message. No hard-coded `2` remains.

Telegram — each user gets a unique permanent `dial_slug`; a new user receives
the admin default exit proxy at their first message, before purchase; existing
users are never rewritten when the default changes; renewals keep the proxy.

Migration — `tools/migrate_v4.py` previews by default (link count, subscription
count, Multi-Location count, over-old-limit count, store-managed count) then
the exact defaults it will install. `--apply` writes a `.pre-v4` backup first.

## Not verified

- The Telegram bot against the live Telegram API (no bot token here).
- Raw TCP ingress (needs a Railway TCP proxy).
- The S3 managed-proxy repository (no credentials), so the proxy dropdowns show
  empty rather than real proxies — the logic is verified, the data is not.
- `tests/railway_installer_v28.mjs` fails on the pristine upstream baseline too;
  it is a pre-existing failure, untouched by this work.

## Reproducing

```bash
python -m venv .venv && .venv/bin/pip install -r requirements.txt tzdata
npm install --no-save playwright jsdom
DATA_DIR=./data ADMIN_PASSWORD=yourpass python main.py &

node tests/panel_browser.cjs http://localhost:8000 E:/shots    # 37 browser checks
node tests/panel_audit.cjs  http://localhost:8000 E:/shots    # dark-mode audit
node tests/panel_css.mjs                                      # CSS structure
node tests/glisse_components.mjs node tests/panel_glass.mjs
node tests/compare_upstream.mjs
python tests/lumen_features.py python tests/telegram_proxy_defaults.py
python tests/state_persistence_v28.py
DATA_DIR=./data python tests/e2e_api.py http://localhost:8000 yourpass
python tools/migrate_v4.py ./data/code_state.json             # preview
python tools/migrate_v4.py ./data/code_state.json --apply
```
