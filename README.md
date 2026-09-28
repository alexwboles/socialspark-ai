# ⚡ SocialSpark AI

**Turn one job photo into a week of social posts.**

Small businesses know they should post on social media — but after a 10-hour day on the tools, nobody has the energy to write captions. SocialSpark fixes that: describe the job you just finished, and get **7 days of ready-to-post content** — captions in 3 tones, hashtags, and the best time to post each day.

## The problem

- 70%+ of small trade businesses post on social media less than once a month
- Hiring a social media manager costs $500–$2,000/month — out of reach for a 2-person shop
- Generic AI tools write bland captions with no trade knowledge, no local hashtags, no posting strategy

## The solution

One input → a full week content calendar:

1. **Describe the job** in plain English, pick your trade, optionally attach a photo
2. **Get 7 themed posts** — The Reveal, Behind the Scenes, Pro Tip, Customer Love, Weekend Offer, Team Spotlight, Before & After
3. **Each post includes:**
   - Caption in 3 tones (Professional / Friendly / Funny)
   - Trade-specific + keyword hashtags
   - Best time to post that day (with the *why*)
4. **Copy → post → check off.** Save favorites to your content bank for reuse.

Everything runs **100% in the browser**. No account, no server, no uploads — your business info never leaves the device. Works offline by just opening `index.html`.

## Pricing idea

- **Free:** 1 week of posts per month
- **Pro — $19/month:** unlimited weeks, content bank sync, multi-business profiles, reminder nudges

At $19/mo, 500 paying shops = ~$114k/year recurring. The target market (US trade & home-service SMBs) is in the millions.

## How to run

No build step. No dependencies.

```bash
# Option 1: just open it
open index.html        # macOS
xdg-open index.html    # linux
start index.html       # windows

# Option 2: tiny static server
npx serve .            # or: python3 -m http.server 8080
```

## Optional AI enhancement

Out of the box, captions are generated from local trade-specific templates — no API key needed, ever. If you set an `OPENAI_API_KEY` (env var, or `window.OPENAI_API_KEY` in the browser console), a future version can use it to polish captions. The app never requires it.

## Project layout

```
index.html          — app shell
css/style.css       — styling
js/generator.js     — content engine (works in browser AND node; no DOM)
js/app.js           — UI wiring, localStorage week + content bank
test/smoke.sh       — fast sanity checks
test/e2e.sh         — end-to-end generation flows
```

## Tests

```bash
bash test/smoke.sh
bash test/e2e.sh
```

## Roadmap

- [ ] Photo-aware captions (describe what's in the uploaded photo)
- [ ] One-click share intents for Facebook / Instagram / Nextdoor
- [ ] Posting reminders via the content bank
- [ ] Multi-location profiles for franchises
- [ ] Optional OpenAI polish pass when a key is provided

Built free, no paid services — per the standing rule.
