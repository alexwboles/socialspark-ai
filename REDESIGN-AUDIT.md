# SocialSpark AI — Redesign Audit (2026-10-13)

## Competitors researched (3–5)
1. **Buffer Publish** (screenshot: buffer.com/publish calendar view, 2025) — Left icon rail (Create/Calendar/Ideas/Analytics), channel avatars column, weekly grid Mon–Sun with post cards at time slots, color status bars (green/yellow/pink) under each card, top bar: "All Channels", Calendar/List toggle, "+ New Post", date nav (‹ › September 2025, Today, Week ▾), filters (All Posts, Tags), timezone. Minimal, one accent.
2. **Hootsuite Planner** (fs-poster.com, poster.ly 2026) — drag-and-drop monthly calendar + streams panel; bulk composer (350 via CSV); approval workflows; OwlyWriter AI in composer; per-network customization in composer.
3. **Later** (fs-poster.com 2026) — calendar doubles as Instagram grid preview; visual media library; Idea Generator; weekly batch planning as the natural workflow.
4. **CoSchedule** (adtools.org) — visual calendar integrating scheduling + project management; AI "Best Time to Publish"; ReQueue evergreen recycling.
5. **Vista Social** (vistasocial.com 2026) — visual drag-and-drop calendar with built-in media library; teams find it faster day-to-day than Hootsuite streams.

## Visual gaps vs competitors
- Current app is a single scrolling form → results page ("card stack"). Buffer/Later lead with the **week as the hero**: a 7-day column grid where every post is a card at its time slot. Our week-grid exists but is a plain vertical list below a big intro card — no time-axis, no day columns, no status color language.
- No left rail / app chrome — feels like a landing page, not a planner. Buffer's icon rail + top bar (Calendar/List, New Post) is the category signature.
- No per-network preview (Buffer composer shows per-network previews; Later shows grid preview). Our posts are text cards — a social tool should show the post *as a post*.
- Intro hero ("Never stare at a blank caption box again") is marketing copy inside the app — real tools open straight into the planner.
- Rounded corners present → square per Alex's rule.

## Functional gaps (prioritized)
1. **No true week-grid planner** — have weekGrid; rebuild as 7 day-columns with time-ordered post cards, status pills (draft/posted), best-time badges, click → detail drawer. HIGH.
2. **No post detail view** — clicking a post should open a Buffer-style composer drawer: per-tone tabs, per-network preview (Instagram/X/Facebook), char counts, copy/share/save, mark-posted. HIGH (uses existing platformCheck, trimForX, shareLinks, formatPost).
3. **No Calendar/List toggle** — Buffer's signature view switch. List = queue view sorted by time with the same actions. MEDIUM.
4. **Intro/marketing hero inside the app** — replace with a compact "New week" composer card at top (job form collapses after generation). MEDIUM.
5. **No drag-to-reorder** — Buffer allows drag/drop reordering; scope risk — defer (mark posted/unposted covers the core loop). LOW (skip).

## Concept (1 paragraph)
**"The weekly planner."** A Buffer-Publish-style planning console: slim icon rail (Planner, Content bank, Profile), top bar with Calendar/List toggle + "New week" button + week nav, and the **7-day column grid as the hero** — each day a column with its post card at the best-time slot, tone tabs, hashtag chips, status pill (scheduled/posted), best-time badge with the *why*. Clicking a card opens a **composer drawer**: per-network preview tabs (Instagram / X / Facebook) rendering the caption as a real post, tone switcher, char counts per platform, copy / trim-for-X / share / save-to-bank / mark-posted actions. Warm off-white canvas, ink text, one vivid **coral** accent (Later-energy, distinct from the other four products); squared corners; tabular times.

## Bug fixes found during audit
- TBD from app.js read.

## What to preserve (test contract)
IDs: dlWeekBtn, copyAllBtn, upNext, bankSearch, bankExportBtn, bankImportBtn, bankImportFile, bizHandle, dlIcsBtn (+ bizName, trade, bizPhone, bizCta, jobDesc, photo, photoPreview, surpriseBtn, generateBtn, tone tabs .tone-tab, results, weekTitle, weekSub, regenBtn, weekGrid, bankCard, bankEmpty, bankList, toast); app.js uses: weekToMarkdown, weekToPlainText, platformCheck, nextPostAt, parseBankImport, renderUpNext, xcopy-btn, share-btn, renderTagWarning, postedLog, getProfile, sanitizeProfile; generator exports: generateWeek, formatPost, weekToMarkdown, weekToICS, postingStats, shareLinks, trimForX, hashtagReport; CSS: .tag-warn.
