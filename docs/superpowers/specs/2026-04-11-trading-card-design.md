# Trading Card Design — NBA Tips PickCard

**Date:** 2026-04-11  
**Status:** Approved

## Summary

Replace the existing `PickCard` component in `Home.jsx` with a premium NBA trading card design. All displayed picks have `value_rating: "excellent"` so the new design applies to all cards.

## Design Decisions

- **Shimmer:** Aurora — animated border shifting between green (#00e5a0), blue (#60a5fa), purple (#a78bfa). Subtle overlay inside that drifts. No rainbow.
- **Layout:** Trading card — top header with player name + jersey number ghost, middle stats, bottom recommendation.
- **Interaction:** Click DETALJI button → 3D CSS flip → back face with stats/reasoning/odds. No scroll needed.
- **Stat boxes:** Three distinct colored boxes — GRANICA (orange), AVG L10 (green), CONF (purple). Each with colored top accent line.
- **DETALJI button:** Aurora gradient background, rotating ↻ icon, blue text — prominently visible.
- **Back face:** Solid `#0c1220` background — NO aurora overlay on content. Only thin aurora border. High contrast text `#cbd5e1`. Sections: Statistike, AI Razlozi, Kvote.

## Component Structure

`PickCard` in `Home.jsx` — same component, same props, full internal rewrite.

### Front face
```
[aurora rainbow line 3px]
[header: position tag / PLAYER NAME (Bebas Neue 32px) / team vs opponent]
  └─ jersey number ghost (96px, opacity 0.04) top-right
[stats row: GRANICA box | AVG L10 box | CONF box]
[bar: UNDER ◄──┼──► OVER]
[footer: rec arrow + OVER/POENI | DETALJI button (aurora gradient)]
```

### Back face
```
[aurora rainbow line 3px]
[header: player·prop | ODLIČNO badge]
[section: Statistike — 4 stat boxes (Sez PTS / L10 PTS / L10 AST / L10 REB)]
[section: AI Razlozi — key_factors list, blue › bullets, #cbd5e1 text]
[section: Kvote — odds chips]
[footer: ↑ OVER 29.5 | ↻ NAZAD button]
```

## CSS Implementation Notes

- Flip: `transform-style: preserve-3d` on wrapper, `rotateY(180deg)` on click, `backface-visibility: hidden` on both faces.
- Aurora glow: `box-shadow` animation cycling through green/blue/purple tints (`auroraGlow` keyframe).
- Aurora border overlay: `::before` pseudo with radial gradients, `z-index: -1`.
- Aurora drift: `::after` pseudo with linear gradient `background-size: 400%`, animated position.
- No mouse-tracking tilt (too complex, not requested).
- Save button stays on front face footer (replaces current save button position).

## Scheduler Fix

**Bug:** When backend starts after 16:00, scheduler sees `now >= target`, adds 1 day, waits until tomorrow — no picks today.  
**Fix:** On first loop iteration, if `now >= target` (past 16:00 today), generate picks immediately, then wait for tomorrow's slot.
