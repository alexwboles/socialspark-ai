'use strict';
/* SocialSpark AI — UI logic. Pure static app; all state in localStorage. */
(function () {
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  const LS_WEEK = 'socialspark.week.v1';
  const LS_BANK = 'socialspark.bank.v1';
  const TONES = ['professional', 'friendly', 'funny'];
  const TONE_LABEL = { professional: 'Professional', friendly: 'Friendly', funny: 'Funny' };

  let week = null; // { businessName, trade, tradeLabel, posts: [...] }
  let tone = 'friendly';
  let postedDays = {}; // dayIndex -> true
  let photoDataUrl = null;

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
    $('#results').scrollIntoView({ behavior: 'smooth' });
    toast('Your week of posts is ready! 🎉');
  }

  // -------------------------------------------------------------- render
  function renderWeek() {
    if (!week) return;
    $('#weekTitle').textContent = `${week.businessName} — this week's posts`;
    $('#weekSub').textContent =
      `${week.tradeLabel} · ${week.posts.length} posts · best times included`;
    const grid = $('#weekGrid');
    grid.innerHTML = '';
    week.posts.forEach((post) => {
      grid.appendChild(postCard(post));
    });
    renderBank();
  }

  function postCard(post) {
    const card = document.createElement('article');
    card.className = 'post-card' + (postedDays[post.dayIndex] ? ' posted' : '');
    card.dataset.day = post.dayIndex;

    const tags = post.hashtags.map((h) => `<span class="htag">${esc(h)}</span>`).join(' ');

    card.innerHTML = `
      <div class="post-head">
        <div>
          <div class="post-day">${esc(post.day)}</div>
          <div class="post-theme">${esc(post.theme)}</div>
        </div>
        <button class="icon-btn posted-btn" title="Mark as posted" aria-label="Mark as posted">${postedDays[post.dayIndex] ? '✅' : '⭕'}</button>
      </div>
      ${photoDataUrl ? `<img class="post-photo" src="${photoDataUrl}" alt="Job photo">` : ''}
      <div class="tone-tabs" role="tablist">
        ${TONES.map((t) => `<button class="tone-tab${t === tone ? ' active' : ''}" data-tone="${t}">${TONE_LABEL[t]}</button>`).join('')}
      </div>
      <p class="caption"></p>
      <div class="htags">${tags}</div>
      <div class="best-time">⏰ Best time: <strong>${esc(post.bestTime)}</strong><span class="why">${esc(post.bestTimeReason)}</span></div>
      <div class="post-actions">
        <button class="btn small copy-btn">📋 Copy</button>
        <button class="btn small ghost bank-btn">⭐ Save</button>
      </div>
    `;

    const updateCaption = () => {
      card.querySelector('.caption').textContent = post.captions[card._tone || tone];
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
        { captions: post.captions, hashtags: post.hashtags }, card._tone || tone
      );
      try {
        await navigator.clipboard.writeText(text);
        toast('Copied — paste it into your social app! 📋');
      } catch (_) {
        // Fallback for non-secure contexts
        const ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        try {
          document.execCommand('copy');
          toast('Copied — paste it into your social app! 📋');
        } catch (__) {
          toast('Copy failed — select the text manually.');
        }
        ta.remove();
      }
    });

    card.querySelector('.bank-btn').addEventListener('click', () => {
      saveToBank(post, card._tone || tone);
    });

    card.querySelector('.posted-btn').addEventListener('click', () => {
      const i = post.dayIndex;
      postedDays[i] = !postedDays[i];
      saveJson(LS_WEEK, { week, postedDays });
      card.classList.toggle('posted', !!postedDays[i]);
      card.querySelector('.posted-btn').textContent = postedDays[i] ? '✅' : '⭕';
      toast(postedDays[i] ? `${post.day} marked as posted! 🎉` : `${post.day} unmarked.`);
    });

    return card;
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
        { captions: post.captions, hashtags: post.hashtags }, toneUsed
      ),
    });
    saveJson(LS_BANK, bank.slice(0, 100));
    renderBank();
    toast('Saved to your content bank ⭐');
  }

  function renderBank() {
    const bank = getBank();
    const wrap = $('#bankList');
    $('#bankEmpty').hidden = bank.length > 0;
    wrap.innerHTML = '';
    bank.forEach((item) => {
      const el = document.createElement('div');
      el.className = 'bank-item';
      el.innerHTML = `
        <div class="bank-meta">${esc(item.day)} · ${esc(item.theme)} · ${esc(TONE_LABEL[item.tone] || item.tone)}</div>
        <p class="bank-text"></p>
        <div class="bank-actions">
          <button class="btn small copy-btn">📋 Copy</button>
          <button class="btn small ghost del-btn">🗑 Delete</button>
        </div>
      `;
      el.querySelector('.bank-text').textContent = item.text;
      el.querySelector('.copy-btn').addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(item.text);
          toast('Copied! 📋');
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
    toast('Sample job loaded — hit Generate! ✨');
  }

  // ----------------------------------------------------------------- init
  function init() {
    buildTradeOptions();
    $('#generateBtn').addEventListener('click', onGenerate);
    $('#regenBtn').addEventListener('click', onRegenerate);
    $('#surpriseBtn').addEventListener('click', onSurprise);
    $('#photo').addEventListener('change', onPhotoChange);
    $$('.global-tone .tone-tab').forEach((btn) => {
      btn.addEventListener('click', () => {
        $$('.global-tone .tone-tab').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        tone = btn.dataset.tone;
        if (week) renderWeek();
      });
    });

    const saved = loadJson(LS_WEEK, null);
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
