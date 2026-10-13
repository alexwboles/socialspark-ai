'use strict';
/* SocialSpark AI — UI logic. Pure static app; all state in localStorage. */
(function () {
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  const LS_WEEK = 'socialspark.week.v1';
  const LS_BANK = 'socialspark.bank.v1';
  const LS_PROFILE = 'socialspark.profile.v1';
  const LS_LOG = 'socialspark.log.v1';
  const TONES = ['professional', 'friendly', 'funny'];
  const TONE_LABEL = { professional: 'Professional', friendly: 'Friendly', funny: 'Funny' };

  let week = null; // { businessName, trade, tradeLabel, posts: [...] }
  let tone = 'friendly';
  let postedDays = {}; // dayIndex -> true
  let postedLog = []; // [{dayIndex, dateISO}] — posting history for stats
  let photoDataUrl = null;

  function getProfile() {
    return SocialSpark.sanitizeProfile(loadJson(LS_PROFILE, {}));
  }

  function readProfileFromForm() {
    return SocialSpark.sanitizeProfile({
      handle: $('#bizHandle').value,
      phone: $('#bizPhone').value,
      cta: $('#bizCta').value,
    });
  }

  /* Record a posted day in the history log (dedupe: one entry per
   * dayIndex per calendar day). */
  function logPosted(dayIndex) {
    const today = new Date().toISOString().slice(0, 10);
    postedLog = postedLog.filter((e) => !(e.dayIndex === dayIndex && String(e.dateISO).slice(0, 10) === today));
    postedLog.push({ dayIndex, dateISO: new Date().toISOString() });
    saveJson(LS_LOG, postedLog.slice(-365));
  }

  function unlogPosted(dayIndex) {
    postedLog = postedLog.filter((e) => e.dayIndex !== dayIndex);
    saveJson(LS_LOG, postedLog.slice(-365));
  }

  // ------------------------------------------------------------ helpers
  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  function loadJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (_) {
      return fallback;
    }
  }

  function saveJson(key, val) {
    try {
      localStorage.setItem(key, JSON.stringify(val));
    } catch (_) {
      /* storage full or unavailable — non-fatal */
    }
  }

  function toast(msg) {
    const el = $('#toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.remove('show'), 2200);
  }

  // ---------------------------------------------------------------- form
  function buildTradeOptions() {
    const sel = $('#trade');
    SocialSpark.TRADE_IDS.forEach((id) => {
      const opt = document.createElement('option');
      opt.value = id;
      opt.textContent = SocialSpark.TRADES[id].label;
      sel.appendChild(opt);
    });
  }

  function onPhotoChange(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast('Please choose an image file.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      photoDataUrl = reader.result;
      const img = $('#photoPreview');
      img.src = photoDataUrl;
      img.hidden = false;
      toast('Photo attached — it will appear on your post cards.');
    };
    reader.readAsDataURL(file);
  }

  function onGenerate() {
    const profile = readProfileFromForm();
    saveJson(LS_PROFILE, profile);
    const input = {
      businessName: $('#bizName').value,
      trade: $('#trade').value,
      jobDescription: $('#jobDesc').value,
    };
    try {
      week = SocialSpark.generateWeek(input);
    } catch (err) {
      toast(err.message);
      return;
    }
    postedDays = {};
    saveJson(LS_WEEK, { week, postedDays });
    renderWeek();
    $('#results').hidden = false;
    setComposerCollapsed(true);
    $('#plannerView').scrollIntoView({ behavior: 'smooth' });
    toast('Your week of posts is ready!');
  }

  function setComposerCollapsed(collapsed) {
    const card = $('#inputCard');
    if (!card) return;
    card.classList.toggle('collapsed', collapsed);
    const t = $('#composerToggle');
    if (t) t.textContent = collapsed ? 'Expand' : 'Collapse';
  }

  // -------------------------------------------------------------- render
  function renderUpNext() {
    const box = $('#upNext');
    if (!week || !week.posts || !week.posts.length) { box.hidden = true; return; }
    try {
      const n = SocialSpark.nextPostAt(
        week.posts, undefined,
        Object.keys(postedDays).filter((k) => postedDays[k]).map(Number)
      );
      if (!n) { box.hidden = true; return; }
      const when = n.inHours < 24
        ? `in about ${n.inHours} hour${n.inHours === 1 ? '' : 's'}`
        : `in about ${Math.round(n.inHours / 24)} day${Math.round(n.inHours / 24) === 1 ? '' : 's'}`;
      const st = SocialSpark.postingStats(postedLog);
      const stats = st.total
        ? ` <span class="muted">· ${st.streak}-day streak · ${st.thisMonth} posted this month</span>`
        : '';
      box.innerHTML = `<strong>Up next:</strong> ${esc(n.day)} ${esc(n.time)} — ${esc(n.theme)} <span class="muted">(${when})</span>${stats}`;
      box.hidden = false;
    } catch (_) { box.hidden = true; }
  }

  function renderWeek() {
    if (!week) return;
    $('#weekTitle').textContent = `${week.businessName} — this week's posts`;
    $('#weekSub').textContent =
      `${week.tradeLabel} · ${week.posts.length} posts · best times included`;
    const empty = $('#weekEmpty');
    if (empty) empty.hidden = true;
    const grid = $('#weekGrid');
    grid.hidden = false;
    const wa = $('#weekActions');
    if (wa) wa.hidden = false;
    grid.innerHTML = '';
    // 7 day columns, Buffer week-view pattern: one post per day at its best time.
    const byDay = {};
    week.posts.forEach((post) => { byDay[post.dayIndex] = post; });
    for (let d = 0; d < 7; d++) {
      const post = byDay[d];
      const col = document.createElement('div');
      col.className = 'day-col';
      const head = document.createElement('div');
      head.className = 'day-head';
      head.innerHTML = `<span class="day-name">${esc(post ? post.day : 'Day ' + (d + 1))}</span>` +
        (post ? `<span class="day-time">${esc(post.bestTime)}</span>` : '');
      col.appendChild(head);
      if (post) {
        const card = postCard(post, true);
        card.addEventListener('click', (e) => {
          if (e.target.closest('button')) return; // tone tabs stay inline
          openDrawer(post);
        });
        col.appendChild(card);
      } else {
        col.innerHTML += '<div class="day-off"><span>No post</span></div>';
      }
      grid.appendChild(col);
    }
    renderList();
    applyView();
    renderUpNext();
    renderTagWarning();
    renderBank();
  }

  /* List view: the queue, sorted by day — Buffer's Calendar/List toggle. */
  function renderList() {
    const list = $('#listView');
    if (!list) return;
    list.innerHTML = '';
    week.posts.forEach((post) => {
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'list-row' + (postedDays[post.dayIndex] ? ' posted' : '');
      const cap = post.captions[tone] || '';
      row.innerHTML =
        `<span class="lr-day">${esc(post.day)}</span>` +
        `<span class="lr-time">${esc(post.bestTime)}</span>` +
        `<span class="lr-theme">${esc(post.theme)}</span>` +
        `<span class="lr-cap">${esc(cap.slice(0, 90))}${cap.length > 90 ? '…' : ''}</span>` +
        `<span class="status-pill${postedDays[post.dayIndex] ? ' done' : ''}">${postedDays[post.dayIndex] ? 'Posted' : 'Scheduled'}</span>`;
      row.addEventListener('click', () => openDrawer(post));
      list.appendChild(row);
    });
  }

  let plannerView = 'calendar';
  function applyView() {
    const grid = $('#weekGrid'), list = $('#listView');
    const cal = plannerView === 'calendar';
    if (grid) grid.hidden = !cal || !week;
    if (list) list.hidden = cal || !week;
    const vc = $('#viewCal'), vl = $('#viewList');
    if (vc) vc.classList.toggle('active', cal);
    if (vl) vl.classList.toggle('active', !cal);
  }

  /* Warn when the same hashtags repeat across most of the week — it reads as spammy. */
  function renderTagWarning() {
    let warn = $('#tagWarn');
    if (!warn) {
      warn = document.createElement('div');
      warn.id = 'tagWarn';
      warn.className = 'tag-warn';
      const grid = $('#weekGrid');
      grid.parentNode.insertBefore(warn, grid);
    }
    if (!week) { warn.hidden = true; return; }
    const rep = SocialSpark.hashtagReport(week);
    if (!rep.overused.length) { warn.hidden = true; return; }
    warn.hidden = false;
    warn.innerHTML = '<strong>Hashtag check:</strong> ' +
      rep.overused.map((o) => `${esc(o.tag)} appears in ${o.days} of 7 posts`).join(' · ') +
      ' — repeating the same tags daily reads as spammy. Consider dropping a few on some days.';
  }

  function postCard(post, compact) {
    const card = document.createElement('article');
    card.className = 'post-card' + (postedDays[post.dayIndex] ? ' posted' : '') + (compact ? ' compact' : '');
    card.dataset.day = post.dayIndex;

    if (compact) {
      // Week-grid card: time, theme, caption snippet, tags, status — click opens the composer drawer.
      const cap = post.captions[tone] || '';
      const shownTags = post.hashtags.slice(0, 3).map((h) => `<span class="htag">${esc(h)}</span>`).join(' ');
      const extra = post.hashtags.length > 3 ? ` <span class="htag more">+${post.hashtags.length - 3}</span>` : '';
      card.innerHTML = `
        <div class="pc-top"><span class="pc-time">${esc(post.bestTime)}</span>
          <span class="status-pill${postedDays[post.dayIndex] ? ' done' : ''}">${postedDays[post.dayIndex] ? 'Posted' : 'Scheduled'}</span></div>
        <div class="pc-theme">${esc(post.theme)}</div>
        ${photoDataUrl ? `<img class="post-photo" src="${photoDataUrl}" alt="Job photo">` : ''}
        <p class="pc-snippet">${esc(cap.slice(0, 110))}${cap.length > 110 ? '…' : ''}</p>
        <div class="htags">${shownTags}${extra}</div>
        <div class="pc-why" title="${esc(post.bestTimeReason)}">Best time · ${esc(post.bestTimeReason.split('.')[0])}</div>
      `;
      return card;
    }

    const tags = post.hashtags.map((h) => `<span class="htag">${esc(h)}</span>`).join(' ');

    card.innerHTML = `
      <div class="post-head">
        <div>
          <div class="post-day">${esc(post.day)}</div>
          <div class="post-theme">${esc(post.theme)}</div>
        </div>
        <button class="icon-btn posted-btn" title="Mark as posted" aria-label="Mark as posted">${postedDays[post.dayIndex] ? '✓ Posted' : 'Mark posted'}</button>
      </div>
      ${photoDataUrl ? `<img class="post-photo" src="${photoDataUrl}" alt="Job photo">` : ''}
      <div class="tone-tabs" role="tablist">
        ${TONES.map((t) => `<button class="tone-tab${t === tone ? ' active' : ''}" data-tone="${t}">${TONE_LABEL[t]}</button>`).join('')}
      </div>
      <p class="caption"></p>
      <div class="char-count"></div>
      <div class="htags">${tags}</div>
      <div class="best-time">Best time: <strong>${esc(post.bestTime)}</strong><span class="why">${esc(post.bestTimeReason)}</span></div>
      <div class="post-actions">
        <button class="btn small copy-btn">Copy</button>
        <button class="btn small ghost xcopy-btn" title="Trim to 280 characters and copy">Copy for X</button>
        <button class="btn small ghost share-btn">Share</button>
        <button class="btn small ghost bank-btn">Save</button>
      </div>
    `;

    const updateCaption = () => {
      const cap = post.captions[card._tone || tone];
      card.querySelector('.caption').textContent = cap;
      const cc = card.querySelector('.char-count');
      const chk = SocialSpark.platformCheck(cap);
      cc.textContent = `${chk.chars} characters` +
        (chk.over.length ? ` — too long for ${chk.over.join(', ')}` : '');
      cc.classList.toggle('warn', chk.over.length > 0);
    };
    card._tone = tone;
    updateCaption();

    card.querySelectorAll('.tone-tab').forEach((btn) => {
      btn.addEventListener('click', () => {
        card.querySelectorAll('.tone-tab').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        card._tone = btn.dataset.tone;
        updateCaption();
      });
    });

    card.querySelector('.copy-btn').addEventListener('click', async () => {
      const text = SocialSpark.formatPost(
        { captions: post.captions, hashtags: post.hashtags }, card._tone || tone,
        getProfile()
      );
      try {
        await navigator.clipboard.writeText(text);
        toast('Copied — paste it into your social app!');
      } catch (_) {
        // Fallback for non-secure contexts
        const ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        try {
          document.execCommand('copy');
          toast('Copied — paste it into your social app!');
        } catch (__) {
          toast('Copy failed — select the text manually.');
        }
        ta.remove();
      }
    });

    card.querySelector('.bank-btn').addEventListener('click', () => {
      saveToBank(post, card._tone || tone);
    });

    card.querySelector('.xcopy-btn').addEventListener('click', () => {
      const r = SocialSpark.trimForX(
        { captions: post.captions, hashtags: post.hashtags }, card._tone || tone,
        getProfile()
      );
      copyText(r.text, r.trimmed ? 'Trimmed to 280 characters — copied!' : 'Copied (already fits X).');
    });

    card.querySelector('.share-btn').addEventListener('click', async () => {
      const text = SocialSpark.formatPost(
        { captions: post.captions, hashtags: post.hashtags }, card._tone || tone,
        getProfile()
      );
      // Native share sheet when available (mobile: Instagram, Nextdoor,
      // Facebook…), X web intent as the desktop fallback.
      if (navigator.share) {
        try {
          await navigator.share({ title: `${week.businessName} — ${post.day}`, text });
          return;
        } catch (_) { /* cancelled — fall through to X */ }
      }
      window.open(SocialSpark.shareLinks(text).x, '_blank', 'noopener');
    });

    card.querySelector('.posted-btn').addEventListener('click', () => {
      const i = post.dayIndex;
      postedDays[i] = !postedDays[i];
      if (postedDays[i]) logPosted(i); else unlogPosted(i);
      saveJson(LS_WEEK, { week, postedDays });
      card.classList.toggle('posted', !!postedDays[i]);
      card.querySelector('.posted-btn').textContent = postedDays[i] ? '✓ Posted' : 'Mark posted';
      renderUpNext();
      toast(postedDays[i] ? `${post.day} marked as posted.` : `${post.day} unmarked.`);
    });

    return card;
  }

  // ---------------------------------------------------------- composer drawer
  let drawerPost = null;
  let drawerNet = 'instagram';

  function openDrawer(post) {
    drawerPost = post;
    $('#drawerTitle').textContent = `${post.day} — ${post.theme}`;
    $('#drawerSub').textContent = `Best time ${post.bestTime} · ${post.bestTimeReason}`;
    const body = $('#drawerBody');
    body.innerHTML = '';
    const full = postCard(post, false);
    // Keep the drawer's tone tabs in sync with the network preview.
    full.querySelectorAll('.tone-tab').forEach((btn) => {
      btn.addEventListener('click', () => {
        setTimeout(() => renderNetPreview(drawerPost, full._tone || tone), 0);
      });
    });
    body.appendChild(full);
    renderNetPreview(post, full._tone || tone);
    $('#drawer').hidden = false;
    $('#drawerVeil').hidden = false;
    document.body.classList.add('drawer-open');
  }

  function closeDrawer() {
    $('#drawer').hidden = true;
    $('#drawerVeil').hidden = true;
    document.body.classList.remove('drawer-open');
    drawerPost = null;
    if (week) { renderWeek(); } // reflect posted/saved changes made in the drawer
  }

  /* Buffer-composer pattern: see the caption as a real post per network. */
  function renderNetPreview(post, toneUsed) {
    const box = $('#netPreview');
    if (!box || !post) return;
    const cap = post.captions[toneUsed] || post.captions[tone] || '';
    const tags = post.hashtags.join(' ');
    const profile = getProfile();
    const name = week ? week.businessName : 'Your business';
    const handle = profile.handle || '@yourbusiness';
    const initial = (name.trim()[0] || 'S').toUpperCase();
    const img = photoDataUrl
      ? `<img class="np-img" src="${photoDataUrl}" alt="Job photo">`
      : `<div class="np-img np-ph" aria-hidden="true"><span>${esc(initial)}</span></div>`;

    if (drawerNet === 'x') {
      const chk = SocialSpark.platformCheck(cap + '\n' + tags);
      box.innerHTML = `
        <div class="np-x">
          <div class="np-row"><span class="np-avatar">${esc(initial)}</span>
            <div><div class="np-name">${esc(name)}</div><div class="np-handle">${esc(handle)}</div></div></div>
          <p class="np-cap">${esc(cap)}</p>
          <p class="np-tags">${esc(tags)}</p>
          <div class="np-count${chk.over.includes('X') ? ' warn' : ''}">${chk.chars} / 280 characters</div>
        </div>`;
    } else if (drawerNet === 'facebook') {
      box.innerHTML = `
        <div class="np-fb">
          <div class="np-row"><span class="np-avatar">${esc(initial)}</span>
            <div><div class="np-name">${esc(name)}</div><div class="np-handle">Sponsored</div></div></div>
          <p class="np-cap">${esc(cap)}</p>
          ${img}
          <p class="np-tags">${esc(tags)}</p>
        </div>`;
    } else {
      box.innerHTML = `
        <div class="np-ig">
          <div class="np-row"><span class="np-avatar">${esc(initial)}</span>
            <div class="np-name">${esc(name)}</div></div>
          ${img}
          <p class="np-cap"><strong>${esc(handle.replace(/^@/, ''))}</strong> ${esc(cap)}</p>
          <p class="np-tags">${esc(tags)}</p>
        </div>`;
    }
  }

  // ---------------------------------------------------------- content bank
  function getBank() {
    return loadJson(LS_BANK, []);
  }

  function saveToBank(post, toneUsed) {
    const bank = getBank();
    bank.unshift({
      id: Date.now(),
      day: post.day,
      theme: post.theme,
      tone: toneUsed,
      text: SocialSpark.formatPost(
        { captions: post.captions, hashtags: post.hashtags }, toneUsed,
        getProfile()
      ),
    });
    saveJson(LS_BANK, bank.slice(0, 100));
    renderBank();
    toast('Saved to your content bank.');
  }

  function renderBank() {
    const bank = getBank();
    const q = ($('#bankSearch') && $('#bankSearch').value || '').trim().toLowerCase();
    const shown = q
      ? bank.filter((b) => (b.text + ' ' + b.day + ' ' + b.theme + ' ' + b.tone).toLowerCase().includes(q))
      : bank;
    const wrap = $('#bankList');
    $('#bankEmpty').hidden = bank.length > 0;
    wrap.innerHTML = '';
    if (q && !shown.length && bank.length) {
      wrap.innerHTML = '<p class="muted">No saved posts match your search.</p>';
      return;
    }
    shown.forEach((item) => {
      const el = document.createElement('div');
      el.className = 'bank-item';
      el.innerHTML = `
        <div class="bank-meta">${esc(item.day)} · ${esc(item.theme)} · ${esc(TONE_LABEL[item.tone] || item.tone)}</div>
        <p class="bank-text"></p>
        <div class="bank-actions">
          <button class="btn small copy-btn">Copy</button>
          <button class="btn small ghost del-btn">Delete</button>
        </div>
      `;
      el.querySelector('.bank-text').textContent = item.text;
      el.querySelector('.copy-btn').addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(item.text);
          toast('Copied!');
        } catch (_) {
          toast('Copy failed — select the text manually.');
        }
      });
      el.querySelector('.del-btn').addEventListener('click', () => {
        saveJson(LS_BANK, getBank().filter((b) => b.id !== item.id));
        renderBank();
      });
      wrap.appendChild(el);
    });
  }

  function onRegenerate() {
    if (!week) return;
    onGenerate();
  }

  function onSurprise() {
    const samples = [
      'Replaced a rusted water heater with a high-efficiency tankless unit and repiped the utility closet',
      'Full exterior repaint of a two-story craftsman, siding plus trim, in a modern coastal palette',
      'Tore out an overgrown backyard and installed sod, stone edging, and native plant beds',
      'Rewired a 1970s kitchen, added under-cabinet lighting and a dedicated circuit for the new range',
      'Deep-cleaned a 3-bed rental top to bottom including carpets, grout, and inside all appliances',
    ];
    $('#jobDesc').value = samples[Math.floor(Math.random() * samples.length)];
    toast('Sample job loaded — hit Generate!');
  }

  function downloadText(filename, text, mime) {
    const blob = new Blob([text], { type: mime || 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }

  function onDownloadWeek() {
    if (!week) { toast('Generate a week first.'); return; }
    downloadText(
      `${(week.businessName || 'socialspark').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-week.md`,
      SocialSpark.weekToMarkdown(week, tone),
      'text/markdown;charset=utf-8'
    );
    toast('Week downloaded as Markdown.');
  }

  async function copyText(text, okMsg) {
    try {
      await navigator.clipboard.writeText(text);
      toast(okMsg);
    } catch (_) {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); toast(okMsg); }
      catch (__) { toast('Copy failed — select the text manually.'); }
      ta.remove();
    }
  }

  function onCopyAll() {
    if (!week) { toast('Generate a week first.'); return; }
    copyText(SocialSpark.weekToPlainText(week, tone, getProfile()), 'Whole week copied — paste it anywhere!');
  }

  function onDownloadICS() {
    if (!week) { toast('Generate a week first.'); return; }
    downloadText(
      `${(week.businessName || 'socialspark').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-schedule.ics`,
      SocialSpark.weekToICS(week, tone, getProfile()),
      'text/calendar;charset=utf-8'
    );
    toast('Posting schedule downloaded as .ics.');
  }

  function onBankExport() {
    const bank = getBank();
    if (!bank.length) { toast('Nothing in the bank to export.'); return; }
    downloadText('socialspark-bank.json', JSON.stringify(bank, null, 2), 'application/json');
    toast('Content bank exported.');
  }

  function onBankImportFile(e) {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const items = SocialSpark.parseBankImport(String(reader.result));
        const merged = items.concat(getBank()).slice(0, 100);
        saveJson(LS_BANK, merged);
        renderBank();
        toast(`Imported ${items.length} post${items.length === 1 ? '' : 's'}.`);
      } catch (err) {
        toast('Import failed: ' + err.message);
      }
    };
    reader.readAsText(file);
  }

  // ----------------------------------------------------------------- init
  function init() {
    buildTradeOptions();
    $('#generateBtn').addEventListener('click', onGenerate);
    $('#regenBtn').addEventListener('click', onRegenerate);
    $('#copyAllBtn').addEventListener('click', onCopyAll);
    $('#dlWeekBtn').addEventListener('click', onDownloadWeek);
    $('#dlIcsBtn').addEventListener('click', onDownloadICS);
    $('#surpriseBtn').addEventListener('click', onSurprise);
    $('#photo').addEventListener('change', onPhotoChange);
    $('#bankSearch').addEventListener('input', renderBank);
    $('#bankExportBtn').addEventListener('click', onBankExport);
    $('#bankImportBtn').addEventListener('click', () => $('#bankImportFile').click());
    $('#bankImportFile').addEventListener('change', onBankImportFile);
    $$('.global-tone .tone-tab').forEach((btn) => {
      btn.addEventListener('click', () => {
        $$('.global-tone .tone-tab').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        tone = btn.dataset.tone;
        if (week) renderWeek();
      });
    });

    // Planner chrome: view toggle, rail nav, drawer, composer collapse.
    const vc = $('#viewCal'), vl = $('#viewList');
    if (vc) vc.addEventListener('click', () => { plannerView = 'calendar'; applyView(); });
    if (vl) vl.addEventListener('click', () => { plannerView = 'list'; applyView(); });

    $$('.rail-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        $$('.rail-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        const t = document.getElementById(btn.dataset.target);
        if (t) t.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });

    const goBrief = () => {
      setComposerCollapsed(false);
      $('#inputCard').scrollIntoView({ behavior: 'smooth', block: 'start' });
      $$('.rail-btn').forEach((b) => b.classList.toggle('active', b.dataset.target === 'inputCard'));
    };
    const nwb = $('#newWeekBtn');
    if (nwb) nwb.addEventListener('click', goBrief);
    const ebb = $('#emptyBriefBtn');
    if (ebb) ebb.addEventListener('click', goBrief);
    const ct = $('#composerToggle');
    if (ct) ct.addEventListener('click', () => setComposerCollapsed(!$('#inputCard').classList.contains('collapsed')));

    const dc = $('#drawerClose'), dv = $('#drawerVeil');
    if (dc) dc.addEventListener('click', closeDrawer);
    if (dv) dv.addEventListener('click', closeDrawer);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && drawerPost) closeDrawer();
    });
    $$('.net-tabs button').forEach((btn) => {
      btn.addEventListener('click', () => {
        $$('.net-tabs button').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        drawerNet = btn.dataset.net;
        if (drawerPost) {
          const full = $('#drawerBody .post-card');
          renderNetPreview(drawerPost, (full && full._tone) || tone);
        }
      });
    });

    const saved = loadJson(LS_WEEK, null);
    postedLog = loadJson(LS_LOG, []);
    const prof = getProfile();
    if ($('#bizHandle')) $('#bizHandle').value = prof.handle || '';
    if ($('#bizPhone')) $('#bizPhone').value = prof.phone || '';
    if ($('#bizCta')) $('#bizCta').value = prof.cta || '';
    if (saved && saved.week && saved.week.posts && saved.week.posts.length === 7) {
      week = saved.week;
      postedDays = saved.postedDays || {};
      $('#bizName').value = week.businessName || '';
      $('#trade').value = week.trade || 'other';
      renderWeek();
      $('#results').hidden = false;
    } else {
      renderBank();
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
