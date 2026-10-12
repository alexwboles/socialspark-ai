'use strict';
/**
 * SocialSpark AI — local-first content generation engine.
 *
 * Generates a 7-day social media plan from a single job description.
 * Works fully offline with local templates; if an OpenAI key is present
 * (OPENAI_API_KEY env var in node, or window.OPENAI_API_KEY in browser)
 * callers may optionally enhance captions, but it is never required.
 *
 * UMD-ish: attaches to window in browsers, module.exports in node.
 */

const SocialSpark = (() => {
  // ---------------------------------------------------------------- trades
  const TRADES = {
    plumber: {
      label: 'Plumbing',
      tags: ['#Plumber', '#PlumbingLife', '#PlumbingServices', '#FixItRight'],
      tips: [
        'Know where your main water shut-off valve is before you need it — it can save thousands in water damage.',
        'A dripping faucet can waste over 3,000 gallons a year. Small fixes matter.',
        'Never pour grease down the drain — it hardens in pipes and causes nasty clogs.',
      ],
    },
    electrician: {
      label: 'Electrical',
      tags: ['#Electrician', '#ElectricalWork', '#SparkyLife', '#HomeSafety'],
      tips: [
        'Flickering lights are not "just old bulbs" — they can signal loose wiring. Get them checked.',
        'Test your smoke detectors monthly and swap batteries twice a year.',
        'Overloaded power strips are a top cause of house fires. When in doubt, add a circuit.',
      ],
    },
    landscaper: {
      label: 'Landscaping',
      tags: ['#Landscaping', '#LawnCare', '#CurbAppeal', '#GardenGoals'],
      tips: [
        'Mow high and mow often — taller grass grows deeper roots and crowds out weeds.',
        'Water early in the morning so less evaporates and leaves dry before nightfall.',
        'Mulch 2–3 inches deep around beds to lock in moisture and stop weeds.',
      ],
    },
    painter: {
      label: 'Painting',
      tags: ['#Painter', '#PaintingContractor', '#FreshCoat', '#HomeMakeover'],
      tips: [
        'Always sample paint on the wall and check it in morning and evening light before committing.',
        'Prep is 80% of a great paint job — clean, sand, and prime first.',
        'Use painter’s tape on trim but pull it while the paint is still slightly tacky for crisp lines.',
      ],
    },
    cleaner: {
      label: 'Cleaning',
      tags: ['#CleaningService', '#CleanHome', '#SparkleClean', '#MaidService'],
      tips: [
        'Clean top to bottom, back to front — so dust falls to areas you have not cleaned yet.',
        'Microfiber cloths pick up far more dust than paper towels and they are reusable.',
        'Baking soda + vinegar handles most everyday grime without harsh chemicals.',
      ],
    },
    hvac: {
      label: 'HVAC',
      tags: ['#HVAC', '#HeatingAndCooling', '#HVACTech', '#ComfortFirst'],
      tips: [
        'Change your HVAC filter every 1–3 months — it is the cheapest way to protect your system.',
        'Keep 2 feet of clearance around your outdoor unit for proper airflow.',
        'A yearly tune-up catches small issues before they become mid-summer breakdowns.',
      ],
    },
    roofer: {
      label: 'Roofing',
      tags: ['#Roofer', '#RoofingContractor', '#NewRoof', '#RoofRepair'],
      tips: [
        'Check your attic for daylight peeking through boards — that is a leak waiting to happen.',
        'Clean gutters twice a year; clogged gutters back water up under shingles.',
        'After any big storm, do a quick ground-level check for missing or lifted shingles.',
      ],
    },
    handyman: {
      label: 'Handyman',
      tags: ['#Handyman', '#HomeRepairs', '#FixIt', '#OddJobsDone'],
      tips: [
        'Keep a running "honey-do" list and batch small repairs into one visit — it saves everyone money.',
        'Squeaky door? A drop of silicone lubricant on the hinge pin works wonders.',
        'Caulk around tubs and windows yearly to stop drafts and water damage.',
      ],
    },
    other: {
      label: 'Home Services',
      tags: ['#HomeServices', '#LocalPro', '#HomeImprovement', '#DoneRight'],
      tips: [
        'Get small maintenance done regularly — it is always cheaper than emergency repairs.',
        'Ask your local pro for seasonal checklists; prevention beats cure.',
        'Read reviews and ask for photos of past work before hiring any contractor.',
      ],
    },
  };

  const TRADE_IDS = Object.keys(TRADES);

  const GENERIC_TAGS = ['#SupportLocal', '#SmallBusiness', '#ShopLocal', '#LocalBusiness'];

  const BEST_TIMES = [
    { day: 'Monday', time: '6:30 PM', reason: 'People scroll after dinner while planning their week.' },
    { day: 'Tuesday', time: '12:00 PM', reason: 'Lunch-break scrolling — a strong engagement window.' },
    { day: 'Wednesday', time: '7:00 PM', reason: 'Midweek evening peak for local discovery.' },
    { day: 'Thursday', time: '6:00 PM', reason: 'Homeowners plan weekend projects on Thursday nights.' },
    { day: 'Friday', time: '3:00 PM', reason: 'Friday-afternoon scroll — perfect for offers and calls to action.' },
    { day: 'Saturday', time: '10:00 AM', reason: 'Weekend morning — people notice their own home projects.' },
    { day: 'Sunday', time: '11:00 AM', reason: 'Lazy Sunday scroll — before-and-afters perform especially well.' },
  ];

  // ------------------------------------------------------------- keywords
  const STOPWORDS = new Set(
    ('a,an,the,and,or,but,of,to,in,on,for,with,at,by,from,as,is,was,were,are,be,been,' +
     'it,its,this,that,these,those,my,our,your,their,his,her,we,you,they,i,he,she,me,' +
     'so,very,just,now,today,all,new,old,big,small,did,do,does,done,had,has,have,not,' +
     'no,yes,if,then,than,too,also,well,up,down,out,off,over,under,again,once,here,' +
     'there,when,where,what,which,who,how,why,because,until,while,into,onto,about,' +
     'job,work,project,done,finished,completed,great,nice,good,really').split(',')
  );

  function extractKeywords(description, max = 5) {
    const freq = new Map();
    const words = (description || '')
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, ' ')
      .split(/\s+/)
      .map((w) => w.replace(/^-+|-+$/g, ''))
      .filter((w) => w.length > 2 && !STOPWORDS.has(w));
    for (const w of words) freq.set(w, (freq.get(w) || 0) + 1);
    return [...freq.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, max)
      .map(([w]) => w);
  }

  function titleCase(s) {
    return s.replace(/\w\S*/g, (t) => t.charAt(0).toUpperCase() + t.slice(1).toLowerCase());
  }

  function keywordPhrase(keywords) {
    if (!keywords.length) return 'a great result';
    if (keywords.length === 1) return keywords[0];
    return keywords.slice(0, -1).join(', ') + ' and ' + keywords[keywords.length - 1];
  }

  // ---------------------------------------------------------------- themes
  // Each theme builds three tone variants from the shared context.
  const THEMES = [
    {
      id: 'reveal',
      name: 'The Reveal',
      build(ctx) {
        const { biz, tradeLabel, keywords, job } = ctx;
        const kw = keywordPhrase(keywords);
        return {
          professional: `Project complete. ${biz} delivered ${kw} to the highest standard. If your home needs ${tradeLabel.toLowerCase()} work done right the first time, contact us for a free quote.`,
          friendly: `We are SO proud of this one! 🛠️ Just wrapped up ${kw} and it turned out beautifully. Thanks for trusting ${biz} with your home! 💛`,
          funny: `POV: you hire ${biz} and your ${keywords[0] || 'home'} goes from "yikes" to "YIKES (in a good way)" 😂 Another ${kw} in the books!`,
        };
      },
    },
    {
      id: 'behind-scenes',
      name: 'Behind the Scenes',
      build(ctx) {
        const { biz, tradeLabel, keywords } = ctx;
        const kw = keywords[0] || 'every detail';
        return {
          professional: `Quality is in the details. Here is a look at our process on a recent ${kw} job — careful preparation, clean worksite, and thorough testing before we leave. That is the ${biz} standard.`,
          friendly: `Ever wonder what goes into the magic? ✨ A little behind-the-scenes from our latest ${kw} job — lots of care, a little sweat, and a whole lot of pride. This is why we love what we do!`,
          funny: `What the customer sees: a perfect ${kw}. What actually happened: 47 trips to the truck, one existential crisis, and a snack break 😅 All worth it!`,
        };
      },
    },
    {
      id: 'pro-tip',
      name: 'Pro Tip',
      build(ctx) {
        const { biz, tip } = ctx;
        return {
          professional: `Professional advice from ${biz}: ${tip} Small habits prevent big repair bills. Follow us for more practical home guidance.`,
          friendly: `💡 Pro tip from your friends at ${biz}: ${tip} Save this one — future you will say thanks!`,
          funny: `Free advice (worth exactly what you paid for it 😏): ${tip} You are welcome. ${biz} — saving homes and wallets since day one.`,
        };
      },
    },
    {
      id: 'customer-love',
      name: 'Customer Love',
      build(ctx) {
        const { biz, tradeLabel } = ctx;
        return {
          professional: `Our reputation is built one job at a time. If ${biz} has helped with your ${tradeLabel.toLowerCase()} needs, a Google review means the world to our small team. Thank you for your trust.`,
          friendly: `Happy customers = happy us! 🥰 If ${biz} made your day a little easier, we would LOVE a quick review — it helps our little business in a BIG way!`,
          funny: `We bribe our customers with excellent work and then beg for reviews 😇 If ${biz} earned your 5 stars, smash that review button like it owes you money!`,
        };
      },
    },
    {
      id: 'offer',
      name: 'Weekend Offer',
      build(ctx) {
        const { biz, tradeLabel, keywords } = ctx;
        const kw = keywords[0] || 'your project';
        return {
          professional: `Planning ${kw}? ${biz} is booking ${tradeLabel.toLowerCase()} appointments now. Message us today for a free, no-pressure quote — our schedule fills quickly.`,
          friendly: `Thinking about tackling ${kw}? Let us handle it! 🙌 ${biz} is taking bookings now — send us a message and we will sort you out with a free quote. Easy peasy!`,
          funny: `Your ${kw} is not going to fix itself (we checked) 🔧 ${biz} has open slots — slide into our DMs for a free quote before your "someday" becomes "oh no"!`,
        };
      },
    },
    {
      id: 'team',
      name: 'Team Spotlight',
      build(ctx) {
        const { biz, tradeLabel } = ctx;
        return {
          professional: `Behind every ${biz} job is a team that takes genuine pride in ${tradeLabel.toLowerCase()} craftsmanship. Trained, insured, and committed to leaving your home better than we found it.`,
          friendly: `Meet the crew! 💪 The friendly faces behind ${biz} — the folks who show up on time, treat your home like their own, and genuinely love a job well done.`,
          funny: `The ${biz} dream team: fueled by coffee, powered by stubbornness, finishing ${tradeLabel.toLowerCase()} jobs like superheroes (capes optional) ☕🦸`,
        };
      },
    },
    {
      id: 'before-after',
      name: 'Before & After',
      build(ctx) {
        const { biz, keywords, job } = ctx;
        const kw = keywordPhrase(keywords);
        const short = job.length > 90 ? job.slice(0, 87).trim() + '…' : job;
        return {
          professional: `Transformation: "${short}" The difference professional ${keywords[0] || 'work'} makes. ${biz} — ${kw}, done properly.`,
          friendly: `SWIPE for the glow-up! 😍 From "${short}" to WOW. This ${kw} transformation has us smiling all week — thanks for letting ${biz} work our magic! ✨`,
          funny: `Before: "${short}" After: *chef's kiss* 🤌 Somewhere a ${keywords[0] || 'problem'} is crying because ${biz} just ended its whole career 😂`,
        };
      },
    },
  ];

  // -------------------------------------------------------------- hashtags
  function buildHashtags(tradeId, keywords) {
    const trade = TRADES[tradeId] || TRADES.other;
    const tags = [...trade.tags];
    for (const kw of keywords.slice(0, 3)) {
      const tag = '#' + kw.replace(/[^a-z0-9]/gi, '');
      if (tag.length > 2 && !tags.includes(tag)) tags.push(tag);
    }
    tags.push(...GENERIC_TAGS.slice(0, 2));
    return [...new Set(tags)].slice(0, 9);
  }

  // ------------------------------------------------------------------ api
  function validateInput(input) {
    const errors = [];
    const biz = (input.businessName || '').trim();
    const job = (input.jobDescription || '').trim();
    if (!biz) errors.push('Business name is required.');
    if (job.replace(/\s/g, '').length < 10)
      errors.push('Job description must be at least 10 characters.');
    const tradeId = TRADE_IDS.includes(input.trade) ? input.trade : 'other';
    return { biz, job, tradeId, errors };
  }

  function generateWeek(input) {
    const { biz, job, tradeId, errors } = validateInput(input || {});
    if (errors.length) {
      const err = new Error('Invalid input: ' + errors.join(' '));
      err.validationErrors = errors;
      throw err;
    }
    const trade = TRADES[tradeId];
    const keywords = extractKeywords(job);
    const tip = trade.tips[Math.abs(hashCode(job)) % trade.tips.length];
    const ctx = {
      biz,
      job,
      tradeId,
      tradeLabel: trade.label,
      keywords,
      tip,
    };
    const posts = THEMES.map((theme, i) => {
      const bt = BEST_TIMES[i];
      return {
        dayIndex: i,
        day: bt.day,
        theme: theme.name,
        themeId: theme.id,
        captions: theme.build(ctx),
        hashtags: buildHashtags(tradeId, keywords),
        bestTime: bt.time,
        bestTimeReason: bt.reason,
        keywords,
      };
    });
    return { businessName: biz, trade: tradeId, tradeLabel: trade.label, posts };
  }

  function hashCode(s) {
    let h = 0;
    for (let i = 0; i < s.length; i++) {
      h = (h << 5) - h + s.charCodeAt(i);
      h |= 0;
    }
    return h;
  }

  /** Copy-ready text for one post in the chosen tone.
   *  profile (optional): {handle, phone, cta} — a call-to-action line is
   *  appended when any of them are set. */
  function formatPost(post, tone, profile) {
    const t = ['professional', 'friendly', 'funny'].includes(tone) ? tone : 'friendly';
    let text = `${post.captions[t]}\n\n${post.hashtags.join(' ')}`;
    return withCallToAction(text, profile);
  }

  /** Normalize a business profile. All fields optional. */
  function sanitizeProfile(p) {
    p = p || {};
    const clean = (s, n) => String(s || '').trim().slice(0, n);
    let handle = clean(p.handle, 40);
    if (handle && handle[0] !== '@') handle = '@' + handle;
    return {
      handle,
      phone: clean(p.phone, 30),
      cta: clean(p.cta, 120),
    };
  }

  /** Append the profile's call-to-action line to copy-ready post text. */
  function withCallToAction(text, profile) {
    const prof = sanitizeProfile(profile);
    const bits = [];
    if (prof.cta) bits.push(prof.cta);
    if (prof.phone) bits.push(prof.phone);
    if (prof.handle) bits.push(prof.handle);
    if (!bits.length) return String(text || '');
    return String(text || '') + '\n\n' + bits.join(' · ');
  }

  /** Whole-week posting schedule as an .ics calendar file.
   *  Each post's next real-world slot is resolved from its bestTime
   *  relative to `from` (default now). 30-minute events, floating local time. */
  function weekToICS(week, tone, profile, from) {
    const escICS = (s) => String(s == null ? '' : s)
      .replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,')
      .replace(/\r?\n/g, '\\n');
    const pad = (n) => (n < 10 ? '0' : '') + n;
    const stamp = (d) => d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) +
      'T' + pad(d.getHours()) + pad(d.getMinutes()) + '00';
    const lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//SocialSpark AI//Posting Schedule//EN',
    ];
    week.posts.forEach((p, i) => {
      const slot = nextPostAt([p], from);
      if (!slot) return;
      const start = new Date(slot.when);
      const end = new Date(start.getTime() + 30 * 60000);
      lines.push('BEGIN:VEVENT');
      lines.push('UID:socialspark-' +
        (week.businessName || 'week').replace(/[^a-z0-9]+/gi, '-').toLowerCase() +
        '-' + i + '@local');
      lines.push('DTSTAMP:' + stamp(new Date()));
      lines.push('DTSTART:' + stamp(start));
      lines.push('DTEND:' + stamp(end));
      lines.push('SUMMARY:' + escICS((week.businessName || 'SocialSpark') + ': ' + p.day + ' — ' + p.theme));
      lines.push('DESCRIPTION:' + escICS(
        formatPost(p, tone, profile) + '\n\nBest time: ' + p.bestTime + ' — ' + p.bestTimeReason));
      lines.push('END:VEVENT');
    });
    lines.push('END:VCALENDAR');
    return lines.join('\r\n') + '\r\n';
  }

  /** Posting stats from a log of {dayIndex, dateISO} entries.
   *  Returns {total, thisMonth, streak}: streak = consecutive calendar days
   *  ending today (or yesterday, when today has no post yet). */
  function postingStats(log, now) {
    const base = now ? new Date(now) : new Date();
    if (isNaN(base.getTime())) throw new Error('Invalid now date');
    const daySet = new Set();
    (log || []).forEach((e) => {
      const dt = new Date(e && e.dateISO);
      if (!isNaN(dt.getTime())) daySet.add(dt.toISOString().slice(0, 10));
    });
    const days = Array.from(daySet).sort();
    const monthKey = base.toISOString().slice(0, 7);
    const thisMonth = days.filter((d) => d.slice(0, 7) === monthKey).length;
    let streak = 0;
    const cursor = new Date(base);
    cursor.setHours(0, 0, 0, 0);
    const key = (d) => d.toISOString().slice(0, 10);
    if (!daySet.has(key(cursor))) cursor.setDate(cursor.getDate() - 1);
    while (daySet.has(key(cursor))) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    }
    return { total: days.length, thisMonth, streak };
  }

  /** Whole week as a Markdown document (for download / backup). */
  function weekToMarkdown(week, tone) {
    const t = ['professional', 'friendly', 'funny'].includes(tone) ? tone : 'friendly';
    const lines = [`# ${week.businessName} — week of posts`, `_${week.tradeLabel}_`, ''];
    week.posts.forEach((p) => {
      lines.push(`## ${p.day} — ${p.theme}`);
      lines.push(`Best time: **${p.bestTime}** — ${p.bestTimeReason}`);
      lines.push('');
      lines.push(p.captions[t]);
      lines.push('');
      lines.push(p.hashtags.join(' '));
      lines.push('');
    });
    return lines.join('\n');
  }

  /** Plain-text whole-week copy (day headers + copy-ready posts). */
  function weekToPlainText(week, tone, profile) {
    return week.posts
      .map((p) => `${p.day} — ${p.theme} (best: ${p.bestTime})\n${formatPost(p, tone, profile)}`)
      .join('\n\n---\n\n');
  }

  // Platform caption limits (characters). Over the limit = flagged.
  const PLATFORM_LIMITS = { X: 280, Instagram: 2200, LinkedIn: 3000, Facebook: 63206 };

  /** Character count + per-platform over-limit flags for a caption. */
  function platformCheck(text) {
    const chars = [...String(text || '')].length; // code points, not UTF-16 units
    const over = Object.keys(PLATFORM_LIMITS).filter((p) => chars > PLATFORM_LIMITS[p]);
    return { chars, over, limits: PLATFORM_LIMITS };
  }

  /** Next upcoming post slot at/after `from` (Date or ISO string; default now).
   *  Parses each post's bestTime ("6:30 PM") into the next weekly occurrence.
   *  `skip` (optional): array of dayIndex values already posted — they are skipped. */
  function nextPostAt(posts, from, skip) {
    const base = from ? new Date(from) : new Date();
    if (isNaN(base.getTime())) throw new Error('Invalid from date');
    const skipSet = new Set(skip || []);
    const dayIndex = { Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6 };
    const parseTime = (t) => {
      const m = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(String(t).trim());
      if (!m) return null;
      let h = Number(m[1]) % 12;
      if (/pm/i.test(m[3])) h += 12;
      return { h, min: Number(m[2]) };
    };
    let best = null;
    posts.forEach((p) => {
      if (skipSet.has(p.dayIndex)) return;
      const tm = parseTime(p.bestTime);
      const dow = dayIndex[p.day];
      if (!tm || dow == null) return;
      const cand = new Date(base);
      let delta = (dow - base.getDay() + 7) % 7;
      cand.setDate(cand.getDate() + delta);
      cand.setHours(tm.h, tm.min, 0, 0);
      if (cand < base) cand.setDate(cand.getDate() + 7);
      if (!best || cand < best.when) {
        best = {
          day: p.day, theme: p.theme, time: p.bestTime, themeId: p.themeId,
          when: cand, iso: cand.toISOString(),
          inHours: Math.round((cand - base) / 3600000)
        };
      }
    });
    return best;
  }

  /** Validate an imported content-bank JSON string. Returns the items or throws. */
  function parseBankImport(text) {
    let arr;
    try { arr = JSON.parse(text); } catch (_) { throw new Error('Not valid JSON.'); }
    if (!Array.isArray(arr)) throw new Error('Import must be a JSON array of saved posts.');
    const items = arr.map((it, i) => {
      if (!it || typeof it.text !== 'string' || !it.text.trim())
        throw new Error(`Item ${i + 1} is missing its post text.`);
      return {
        id: Date.now() + i,
        day: String(it.day || ''),
        theme: String(it.theme || ''),
        tone: ['professional', 'friendly', 'funny'].includes(it.tone) ? it.tone : 'friendly',
        text: it.text
      };
    });
    if (!items.length) throw new Error('Nothing to import.');
    if (items.length > 100) throw new Error('Too many items (max 100).');
    return items;
  }

  /** Placeholder for optional OpenAI enhancement — never required. */
  function openAiAvailable() {
    try {
      if (typeof process !== 'undefined' && process.env && process.env.OPENAI_API_KEY) return true;
      if (typeof window !== 'undefined' && window.OPENAI_API_KEY) return true;
    } catch (_) {
      /* ignore */
    }
    return false;
  }

  return {
    TRADES,
    TRADE_IDS,
    THEMES: THEMES.map((t) => ({ id: t.id, name: t.name })),
    BEST_TIMES,
    PLATFORM_LIMITS,
    extractKeywords,
    buildHashtags,
    generateWeek,
    formatPost,
    sanitizeProfile,
    withCallToAction,
    weekToICS,
    postingStats,
    weekToMarkdown,
    weekToPlainText,
    platformCheck,
    nextPostAt,
    parseBankImport,
    openAiAvailable,
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = SocialSpark;
} else if (typeof window !== 'undefined') {
  window.SocialSpark = SocialSpark;
}
