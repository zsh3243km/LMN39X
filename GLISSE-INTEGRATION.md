# Glisse integration inventory

Measured from the official site (https://glisse.kelvinzhang.com/) in Chromium 158,
scrolling the whole page and driving every component. Upstream: glisse@0.5.0,
MIT © Kelvin Zhang.

## Component inventory observed on the site

| Component | Instances | Lumen equivalent | Status |
|---|---|---|---|
| `Glass` | 14 | panel surfaces | Integrated |
| `Button` (glass) | 5 | `.btn`, `.chip` | Integrated |
| `Button` (filled) | 0 (rendered in the Button demo as *Filled*) | `.btn-p` | Integrated |
| `Button` (tinted / destructive) | 2 | `.logout-btn` (destructive) | Integrated |
| `TabBar` (with icons) | 2 | sidebar nav, mobile dock | Integrated |
| `SegmentedControl` | 1 | period/range selectors | Integrated |
| `Input` | 2 | `.fi`, `.cp-input-full` | Integrated |
| `SearchField` (with clear button) | 2 | `.subs-search`, config search | Integrated |
| `Switch` | 2 (one on, one off) | `.ml-switch` | Integrated |
| `Slider` | 7 (`0–100`, `0–36`, `1–1` etc.) | traffic quota, speed limit | Integrated |
| `Menu` | 1 | row action menus | Integrated |
| `.lg-tab-lens` (lifted thumb) | 3 | — | Integrated |
| rim painted (`[data-rim]`) | 11 | 124 surfaces | Integrated |
| SVG lens filters | 11 | 124 surfaces | Integrated |

## Effects inventory

| Effect | Upstream source | Lumen | Status |
|---|---|---|---|
| Lens over marked `data-glisse-backdrop` content | `internal/lens.ts` | `.gl-backdrop` + every glass surface | Integrated, browser-verified |
| Live-backdrop displacement (Chromium only) | `internal/refraction.ts` `fitBackdropLens` | same port | Integrated, browser-verified |
| Painted rim light + edge line | `internal/refraction.ts` `rimMap` | byte-identical port | Integrated, browser-verified |
| Per-shape rim repaint on resize/theme | `ResizeObserver` + `MutationObserver` on `data-theme` | same | Integrated |
| Spring motion (`createSpring`, analytic damped solution) | `internal/spring.ts` | ported | Integrated |
| Lift-into-lens on hold (tab bar, segmented, switch, slider) | `internal/segments.tsx`, `switch.tsx`, `slider.tsx` | ported | Integrated |
| Press feedback (grow + rubber-band stretch) | `internal/press.ts` | ported; applied to buttons | Integrated |
| Hold-vs-scroll arbitration | `internal/hold.ts` | ported | Integrated |
| Tab bar selection lens with ink refraction | `internal/segments.tsx` | ported | Integrated |
| Dark/light via `--lg-*` tokens | `styles.css` | dark-only variant | Integrated |
| `prefers-reduced-motion` | `styles.css` | honoured | Integrated |

## Glass material values (measured, not guessed)

```
--lg-glass         rgb(255 255 255 / .6) light  |  rgb(28 28 31 / .62) dark
--lg-glass-active  rgb(236 236 240 / .85)       |  rgb(46 46 50 / .78)
--lg-edge          rgb(0 0 0 / .08)             |  rgb(255 255 255 / .09)
--lg-rim-shine     .3                           |  .13
--lg-fill          #0091ff
--lg-ease          cubic-bezier(.25,.1,.25,1)
control blur       blur(3px) saturate(1.5)
```

## Lumen-only additions

Lumen adds nothing upstream lacks: the panel's sizing scale reuses the same four
intensities (control 3px, card 14px, panel 22px, dock 26px) so a dock, a
dropdown, a thumb and a sheet are physically the same material at different
thickness — which is what Glisse's own `Glass` demo shows when its *Frost*
slider moves from 0px to 12px.
