# ReceivingX — Design System (AM/PM brand)

Source: `ampm-brand-personality.md`.

## 0. The core tension, resolved

The brand guide says "avoid dark SaaS dashboard aesthetics." ReceivingX is exactly the
kind of app that defaults to that. Resolution:

- **Light-first, always.** White/light-gray canvas, navy chrome. Dark mode ships but is
  opt-in and is a navy-tinted dark, never neutral black.
- **Dropped:** neutral-gray shadcn default palette, dense zebra tables with no
  hierarchy, purple/violet accents, glassmorphism, animated gradients,
  illustration-heavy empty states, emoji, exclamation marks.
- **Kept:** navy + cyan, alternating full-width bands, the stat-band motif, real
  photography, stamp/badge shapes, gold used sparingly.

## 1. Tokens (`packages/ui/src/styles/globals.css`)

Placeholder hex values — replace with real brand kit values when available:

```
Navy 900   #0A2340   page chrome, headers, primary buttons, email band
Navy 700   #123A63   hover/pressed
Navy 500   #1E5A96   links, focus ring base
Cyan 500   #00B5D8   accent: active state, matched badge, primary CTA on navy
Cyan 100   #D7F4FA   selected row, info surface
Gold 500   #FFC220   attention only: needs-review, unmatched, ETA overdue
Black 950  #0B0B0D   stat band
Gray 50/100/200      section bands, borders, table rules
Success    #15803D   checked in
Danger     #B42318   voided / failed send
```

`--radius` = `0.5rem`. Rounded, not bubbly.

## 2. Typography

- **Headings:** Figtree (rounded geometric, soft terminals).
- **Body/UI:** Inter (already in scaffold).
- **Numeric/data (serials, PNs, POs):** JetBrains Mono, tabular nums — functional
  override for transcription-critical strings (0/O, 1/l confusion).

## 3. Layout language

- Full-width alternating bands: navy header -> white content -> gray-50 section ->
  black stat band.
- Dashboard stat band: Received today / Open POs / Awaiting review / Boxes this month.
- Status badges as navy-pill "stamps": MATCHED (cyan), NEEDS REVIEW (gold), CHECKED IN
  (green), UNMATCHED (gold outline), VOIDED (gray). Always paired with a word, never
  color alone.
- Empty states use real photos, one plain sentence. No illustrations/mascots.

## 4. Voice and copy rules

Reassurance-first, plainspoken, zero hype, no exclamation marks, no emoji.

| Do | Don't |
|---|---|
| "Check in package" | "Let's get this checked in!" |
| "2 packages need review" | "Oops! Something needs your attention" |
| "Sent to 4 recipients" | "Boom, delivered" |
| "Couldn't reach InvenTree. The package is saved and will sync automatically." | "Uh oh! Sync failed." |
| "Finish session and notify" | "Ship it" |

## 5. Brand-critical surfaces

- **Notification email:** navy header band + logo, gold hairline divider, white table
  matching the spreadsheet columns, black stat strip, navy footer. Table-based HTML,
  inline styles, Outlook-safe (React Email).
- **QR labels:** thermal = pure black on white, max legibility. Color PDF variant =
  navy header + gold rule.
- **PWA identity:** theme color navy `#0A2340`.
- **Login page:** navy full-bleed, real photo, logo pill, white card.

## 6. Accessibility

Navy-on-white and white-on-navy clear AA. Cyan is fill/border/focus only, never body
text on white (~2.9:1). Gold is fill only, always paired with near-black text
(~1.6:1 on white). Status never conveyed by color alone.

## 7. Open items

1. Exact hex values for AM/PM navy, cyan, gold (brand kit).
2. Logo assets: SVG horizontal lockup + square mark for PWA icon/favicon.
3. Product name in UI (currently "ReceivingX").
4. Confirm headline font (Figtree used as free stand-in) or provide licensed brand font.
5. Real photos of the receiving area for login/empty states.
6. Confirm dark mode stays opt-in.
