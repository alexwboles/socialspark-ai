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

  /** Copy-ready text for one post in the chosen tone. */
  function formatPost(post, tone) {
    const t = ['professional', 'friendly', 'funny'].includes(tone) ? tone : 'friendly';
    return `${post.captions[t]}\n\n${post.hashtags.join(' ')}`;
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
    extractKeywords,
    buildHashtags,
    generateWeek,
    formatPost,
    openAiAvailable,
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = SocialSpark;
} else if (typeof window !== 'undefined') {
  window.SocialSpark = SocialSpark;
}
