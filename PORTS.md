# Creepy Doll — platform & ports plan

*Decision record, 2026-08-24. Targets: Xbox, iOS/iPadOS, Android. Constraint:
we will eventually sell access to the game and/or in-game items (doll
cosmetics), so every platform choice must leave a clean path to store IAP.*

## The codebase, honestly assessed for porting

What we have is unusually portable already:

- **Zero dependencies, zero external assets.** One `game.js` (~6k lines),
  every sprite generated from pixel strings, all audio synthesized with
  WebAudio. There is nothing to bundle, convert, or license.
- **Fixed 320×176 internal canvas** with integer scaling — trivially adapts
  to any screen, including TV overscan.
- **Fixed-timestep update loop** (as of `798d6a1`) — frame-rate independent.
- **A 260-check Playwright E2E suite** that drives the real game. This is
  the single most valuable asset we'd destroy in an engine rewrite.
- The one genuine gap: **input is keyboard-only** and saves are bare
  localStorage.

## Options considered

| Option | iOS/Android | Xbox | Refactor cost | Suite survives? | IAP path |
|---|---|---|---|---|---|
| **A. Keep JS, wrap it** (Capacitor + UWP/WebView2) | Capacitor shells | UWP web app via Xbox Creators Program | Small (input + scaling) | **Yes** | Capacitor IAP plugins / Microsoft Store APIs |
| B. Godot rewrite | Good exports | **No official Xbox export** (needs a porting partner) | Total rewrite | No | Engine plugins |
| C. Unity rewrite | Good | Best-in-class (GDK) | Total rewrite in C#, weeks–months | No | Unity IAP |
| D. GameMaker rewrite | Good | Official GDK export | Total rewrite in GML + license fees | No | Engine IAP |
| E. Phaser restructure | Still needs wrappers (same as A) | Same as A | Medium, buys nothing | Partly | Same as A |

## Decision: Option A — keep the JS game, wrap it per store

The honest finding of this review is that a dramatic refactor is **not
needed** and would actively hurt: options B–D throw away a working game and
its entire test suite to buy console tooling we can reach anyway, because
Microsoft's **Xbox Creators Program** ships JS/HTML games on Xbox as UWP
apps (WebView2), with Microsoft Store paid-app and in-app-purchase support
and no concept-approval gate. Mobile gets **Capacitor** shells around the
unchanged game, with store billing via the Capacitor IAP ecosystem
(RevenueCat when we want receipts validated for us).

The refactor that IS worth doing now (this week), because every wrapper
needs it and it improves the web game today:

1. **Input abstraction: gamepad** — Gamepad API polling mapped onto the
   existing key-event path (Xbox pad on web, UWP, and Bluetooth on mobile).
2. **Input abstraction: touch** — an on-screen control overlay built by
   `game.js` itself on touch devices, dispatching the same synthetic key
   events the test suite already uses. No DOM changes to `index.html`.
3. **Fluid scaling** — integer scaling on big screens, fractional fill on
   phones; hide keyboard hints on touch devices; safe-area padding.
4. **Save/entitlement seam** — one `store` module boundary over
   localStorage now, so store receipts / purchased cosmetics later slot in
   without touching game logic. Cosmetics ride the existing sprite-overlay
   system (the decay stages already composite overlays onto the base doll —
   a dress or skin is just another pixel-string overlay + an owned-items
   list).

## Per-store shells (after the groundwork lands)

- **Android** — Capacitor project wrapping the game; Play Console account
  needed ($25 one-time). Billing: Play Billing via plugin.
- **iOS/iPadOS** — same Capacitor project, iOS target; Apple Developer
  Program needed ($99/yr, Xcode on this Mac). Billing: StoreKit via plugin.
- **Xbox** — UWP WebView2 app; Microsoft Partner Center individual account
  (~$19 one-time) + Xbox Creators Program enrollment; built with Visual
  Studio on Windows (or GitHub Actions windows runner). Gamepad + TV-safe
  scaling come from the groundwork above.

## Monetization notes (for later, so nothing here blocks it)

- Selling **access**: paid app on each store, or free demo (level 1) with a
  single "full game" IAP unlock — the entitlement seam covers both.
- Selling **cosmetics**: consumable-free unlockables (new dresses/skins for
  the doll) — pixel-string overlays keyed by an entitlement list.
- The web version at creepydoll.party can sell via Stripe + Cloudflare
  Workers later; store versions must use store billing (Apple/Google rules).
- Keep all prices/SKUs in one table in the entitlement layer so the three
  stores and web stay in sync.
