/* ═══════════════════════════════════════════════════════════
   SZAFER PANEL v13.2 — ADDONS
   Command palette · Pinned/Recent · Theme toggle · Compact mode
   Mini widget · Presence dots · Avatar emoji detection
═══════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  // Wait for DOM
  function ready(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }

  // ═════════ EMOJI DETECTOR (mark avatars as emoji vs letter) ═════════
  const EMOJI_RE = /[\p{Emoji_Presentation}\p{Extended_Pictographic}]/u;
  function markEmojiAvatars(root) {
    (root || document).querySelectorAll(
      '.tb-avatar-circle, .prof-avatar-preview, .pb-header-avatar, .tp-person-avatar, .chat-msg-avatar'
    ).forEach(el => {
      const txt = (el.textContent || '').trim();
      if (txt && EMOJI_RE.test(txt)) {
        el.setAttribute('data-emoji', '1');
        el.setAttribute('data-has-emoji', '1');
      } else {
        el.removeAttribute('data-emoji');
        el.removeAttribute('data-has-emoji');
      }
    });
  }

  // Watch for dynamic avatar changes
  function watchAvatars() {
    const obs = new MutationObserver(muts => {
      let needsCheck = false;
      muts.forEach(m => {
        if (m.type === 'characterData' || m.type === 'childList') needsCheck = true;
      });
      if (needsCheck) markEmojiAvatars();
    });
    obs.observe(document.body, { subtree: true, childList: true, characterData: true });
  }

  // ═════════ THEME TOGGLE (dark / light / auto) ═════════
  const THEME_KEY = 'szafer-theme-v13';
  function applyTheme(theme) {
    const html = document.documentElement;
    let resolved = theme;
    if (theme === 'auto') {
      resolved = matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    }
    html.setAttribute('data-theme', resolved);
    html.setAttribute('data-theme-pref', theme);
    const lbl = document.getElementById('sfThemeLabel');
    if (lbl) lbl.textContent = theme === 'auto' ? 'Auto' : (theme === 'light' ? 'Jasny' : 'Ciemny');
    const btn = document.getElementById('sfThemeBtn');
    if (btn) btn.setAttribute('data-theme-state', theme);
  }
  function initTheme() {
    let theme = 'dark';
    try { theme = localStorage.getItem(THEME_KEY) || 'dark'; } catch(e){}
    applyTheme(theme);
    const btn = document.getElementById('sfThemeBtn');
    if (!btn) return;
    btn.addEventListener('click', () => {
      const cur = document.documentElement.getAttribute('data-theme-pref') || 'dark';
      const next = cur === 'dark' ? 'light' : (cur === 'light' ? 'auto' : 'dark');
      try { localStorage.setItem(THEME_KEY, next); } catch(e){}
      applyTheme(next);
    });
    // React to OS scheme change in auto
    matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => {
      const cur = document.documentElement.getAttribute('data-theme-pref') || 'dark';
      if (cur === 'auto') applyTheme('auto');
    });
  }

  // ═════════ COMPACT MODE ═════════
  const COMPACT_KEY = 'szafer-compact-v13';
  function applyCompact(on) {
    document.documentElement.setAttribute('data-compact', on ? '1' : '0');
  }
  function initCompact() {
    let on = false;
    try { on = localStorage.getItem(COMPACT_KEY) === '1'; } catch(e){}
    applyCompact(on);
    const btn = document.getElementById('sfCompactBtn');
    if (!btn) return;
    btn.addEventListener('click', () => {
      const cur = document.documentElement.getAttribute('data-compact') === '1';
      const next = !cur;
      try { localStorage.setItem(COMPACT_KEY, next ? '1' : '0'); } catch(e){}
      applyCompact(next);
    });
  }

  // ═════════ PINNED / RECENT (sidebar) ═════════
  const RECENT_KEY = 'szafer-recent-v13';
  const MAX_RECENT = 5;
  function getRecent() {
    try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); } catch(e) { return []; }
  }
  function setRecent(arr) {
    try { localStorage.setItem(RECENT_KEY, JSON.stringify(arr.slice(0, MAX_RECENT))); } catch(e){}
  }
  function addRecent(item) {
    if (!item || !item.label) return;
    let list = getRecent();
    list = list.filter(x => x.id !== item.id);
    list.unshift({ id: item.id, label: item.label, tab: item.tab, icon: item.icon || '✦', ts: Date.now() });
    setRecent(list);
    renderRecent();
  }
  function renderRecent() {
    const wrap = document.getElementById('sidebarRecentList');
    if (!wrap) return;
    const list = getRecent();
    if (!list.length) {
      wrap.innerHTML = '<div class="sidebar-recent-empty">Klikaj wpisy by się tu pojawiały</div>';
      return;
    }
    wrap.innerHTML = list.map(r =>
      `<button class="sidebar-recent-item" data-recent-tab="${r.tab||''}" data-recent-id="${escapeAttr(r.id)}" title="${escapeAttr(r.label)}">
         <span class="sri-icon">${escapeHtml(r.icon)}</span>
         <span class="sri-label">${escapeHtml(r.label)}</span>
       </button>`
    ).join('');
    wrap.querySelectorAll('.sidebar-recent-item').forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.getAttribute('data-recent-tab');
        if (tab) jumpToTab(tab);
      });
    });
  }
  // Expose for app integration
  window.szPanelAddRecent = addRecent;

  // ═════════ MINI WIDGET — today's tasks ═════════
  function refreshMiniWidget() {
    const countEl = document.getElementById('swTodayCount');
    const fillEl  = document.getElementById('swTodayFill');
    const metaEl  = document.getElementById('swTodayMeta');
    if (!countEl) return;
    // Try multiple sources: visible task cards
    const cards = document.querySelectorAll('[data-tab-panel="tasks"] .task-card, [data-tab-panel="planning"] .person-board-item');
    const il = document.querySelectorAll('#itemList .il-row');
    const today = new Date();
    const tStr = today.toISOString().slice(0,10);
    let total = 0, done = 0;
    cards.forEach(c => {
      total++;
      if (c.classList.contains('done') || c.classList.contains('completed') || c.querySelector('.task-checkbox.checked')) done++;
    });
    // Calendar items today
    let todayItems = 0;
    il.forEach(r => {
      const txt = r.textContent || '';
      if (txt.includes(tStr) || txt.includes(formatPL(today))) todayItems++;
    });
    const tot = total + todayItems;
    countEl.textContent = tot || '0';
    const pct = tot ? Math.min(100, Math.round((done / Math.max(tot,1)) * 100)) : 0;
    if (fillEl) fillEl.style.width = pct + '%';
    if (metaEl) metaEl.textContent = tot ? (done + ' / ' + tot + ' zrobione · ' + pct + '%') : 'Brak zadań na dziś';
  }
  function formatPL(d) {
    return [String(d.getDate()).padStart(2,'0'), String(d.getMonth()+1).padStart(2,'0'), d.getFullYear()].join('.');
  }
  function initMiniWidget() {
    const w = document.getElementById('sidebarWidget');
    if (!w) return;
    w.addEventListener('click', () => jumpToTab('calendar'));
    refreshMiniWidget();
    setInterval(refreshMiniWidget, 8000);
    // also refresh after tab switches
    document.addEventListener('click', e => {
      if (e.target.closest('.nav-btn.tab')) setTimeout(refreshMiniWidget, 300);
    });
  }

  // ═════════ COMMAND PALETTE (Cmd+K) ═════════
  const TAB_INDEX = [
    { id: 'tab:calendar',   label: 'Panel · Kalendarz',  tab: 'calendar',    icon: '◧', kw: 'panel kalendarz wpisy' },
    { id: 'tab:tasks',      label: 'Zadania',            tab: 'tasks',       icon: '✓', kw: 'zadania todo task' },
    { id: 'tab:planning',   label: 'Planowanie',         tab: 'planning',    icon: '◫', kw: 'planowanie boards person' },
    { id: 'tab:chat',       label: 'Chat',               tab: 'chat',        icon: '✉', kw: 'chat wiadomości komunikacja' },
    { id: 'tab:upload',     label: 'Upload · Pliki',     tab: 'upload',      icon: '⇧', kw: 'upload pliki media' },
    { id: 'tab:harmonogram',label: 'Harmonogram',        tab: 'harmonogram', icon: '◴', kw: 'harmonogram tygodniowy plan' },
  ];
  const ACTION_INDEX = [
    { id: 'act:profile', label: 'Edytuj profil',         action: () => window.openProfileModal && window.openProfileModal(), icon: '◉', kw: 'profil avatar konto' },
    { id: 'act:changelog', label: 'Lista zmian',          action: () => { const b=document.getElementById('changelogOpenBtn'); b && b.click(); }, icon: '✦', kw: 'zmiany changelog history' },
    { id: 'act:logout',  label: 'Wyloguj',                action: () => { const b=document.getElementById('logoutBtn'); b && b.click(); }, icon: '⏻', kw: 'wyloguj logout' },
    { id: 'act:theme',   label: 'Przełącz motyw',         action: () => { const b=document.getElementById('sfThemeBtn'); b && b.click(); }, icon: '◐', kw: 'theme dark light motyw' },
    { id: 'act:compact', label: 'Tryb kompaktowy',        action: () => { const b=document.getElementById('sfCompactBtn'); b && b.click(); }, icon: '⊟', kw: 'compact zwartny sidebar' },
  ];

  function collectDynamicResults() {
    const results = [];
    // Tasks
    document.querySelectorAll('[data-tab-panel="tasks"] .task-card .task-title, [data-tab-panel="tasks"] .task-card').forEach((el, i) => {
      const text = (el.querySelector('.task-title')?.textContent || el.textContent || '').trim().slice(0, 80);
      if (text && text.length > 2) results.push({
        id: 'task:' + i, label: text, tab: 'tasks', icon: '✓', kw: 'zadanie ' + text.toLowerCase(),
        type: 'Zadanie'
      });
    });
    // Calendar items
    document.querySelectorAll('#itemList .il-row').forEach((el, i) => {
      const title = (el.querySelector('.il-text, .il-title') || el).textContent.trim().slice(0, 80);
      if (title && title.length > 2) results.push({
        id: 'cal:' + i, label: title, tab: 'calendar', icon: '◧', kw: 'wpis ' + title.toLowerCase(),
        type: 'Wpis'
      });
    });
    // Person board items (planning)
    document.querySelectorAll('[data-tab-panel="planning"] .pb-item-text').forEach((el, i) => {
      const text = el.textContent.trim().slice(0, 80);
      if (text && text.length > 2) results.push({
        id: 'plan:' + i, label: text, tab: 'planning', icon: '◫', kw: 'planowanie ' + text.toLowerCase(),
        type: 'Plan'
      });
    });
    // Chat last 30 messages
    const chatMsgs = document.querySelectorAll('[data-tab-panel="chat"] .chat-bubble');
    Array.from(chatMsgs).slice(-30).forEach((el, i) => {
      const text = el.textContent.trim().slice(0, 80);
      if (text && text.length > 2) results.push({
        id: 'chat:' + i, label: text, tab: 'chat', icon: '✉', kw: 'wiadomość ' + text.toLowerCase(),
        type: 'Chat'
      });
    });
    return results;
  }

  function fuzzyScore(query, item) {
    if (!query) return 1;
    const q = query.toLowerCase().trim();
    const hay = (item.label + ' ' + (item.kw || '')).toLowerCase();
    if (hay.includes(q)) return 100 - Math.abs(hay.indexOf(q));
    // letter sequence match
    let qi = 0;
    for (let i = 0; i < hay.length && qi < q.length; i++) {
      if (hay[i] === q[qi]) qi++;
    }
    return qi === q.length ? 50 : 0;
  }

  let cmdkOpen = false;
  let cmdkSelected = 0;
  let cmdkResults = [];

  function openCmdK() {
    if (cmdkOpen) return;
    cmdkOpen = true;
    const ov = document.getElementById('cmdkOverlay');
    const inp = document.getElementById('cmdkInput');
    if (!ov || !inp) return;
    ov.classList.remove('hidden');
    inp.value = '';
    setTimeout(() => inp.focus(), 30);
    cmdkSelected = 0;
    renderCmdK('');
  }
  function closeCmdK() {
    if (!cmdkOpen) return;
    cmdkOpen = false;
    const ov = document.getElementById('cmdkOverlay');
    if (ov) ov.classList.add('hidden');
  }
  function renderCmdK(query) {
    const all = [...TAB_INDEX, ...ACTION_INDEX, ...collectDynamicResults()];
    cmdkResults = all
      .map(it => ({ ...it, _s: fuzzyScore(query, it) }))
      .filter(it => it._s > 0)
      .sort((a, b) => b._s - a._s)
      .slice(0, 30);
    cmdkSelected = 0;
    const out = document.getElementById('cmdkResults');
    if (!out) return;
    if (!cmdkResults.length) {
      out.innerHTML = '<div class="cmdk-empty">Brak wyników. Spróbuj innej frazy.</div>';
      return;
    }
    // Group by type
    const groups = {};
    cmdkResults.forEach(r => {
      const t = r.action ? 'Akcje' : (r.type || (r.id.startsWith('tab:') ? 'Zakładki' : 'Inne'));
      groups[t] = groups[t] || [];
      groups[t].push(r);
    });
    let html = '';
    let idx = 0;
    Object.keys(groups).forEach(g => {
      html += `<div class="cmdk-group">${escapeHtml(g)}</div>`;
      groups[g].forEach(r => {
        html += `<button class="cmdk-result" data-idx="${idx}" role="option">
          <span class="cmdk-result-icon">${escapeHtml(r.icon || '·')}</span>
          <span class="cmdk-result-label">${escapeHtml(r.label)}</span>
          <span class="cmdk-result-meta">${r.tab ? '→ ' + escapeHtml(tabPolish(r.tab)) : 'akcja'}</span>
        </button>`;
        idx++;
      });
    });
    out.innerHTML = html;
    out.querySelectorAll('.cmdk-result').forEach(btn => {
      btn.addEventListener('click', () => {
        const i = parseInt(btn.getAttribute('data-idx'), 10) || 0;
        runCmdK(i);
      });
      btn.addEventListener('mouseenter', () => {
        cmdkSelected = parseInt(btn.getAttribute('data-idx'), 10) || 0;
        updateCmdKHighlight();
      });
    });
    updateCmdKHighlight();
  }
  function tabPolish(t) {
    return ({calendar:'Panel', tasks:'Zadania', planning:'Planowanie', chat:'Chat', upload:'Upload', harmonogram:'Harmonogram'})[t] || t;
  }
  function updateCmdKHighlight() {
    const btns = document.querySelectorAll('#cmdkResults .cmdk-result');
    btns.forEach(b => b.classList.remove('selected'));
    const cur = btns[cmdkSelected];
    if (cur) {
      cur.classList.add('selected');
      cur.scrollIntoView({ block: 'nearest' });
    }
  }
  function runCmdK(i) {
    const r = cmdkResults[i];
    if (!r) return;
    closeCmdK();
    if (r.action) { try { r.action(); } catch(e){ console.warn(e); } return; }
    if (r.tab) {
      jumpToTab(r.tab);
      addRecent({ id: r.id, label: r.label, tab: r.tab, icon: r.icon || '✦' });
    }
  }
  function jumpToTab(tab) {
    const btn = document.querySelector('.nav-btn.tab[data-tab="' + tab + '"]');
    if (btn) btn.click();
  }

  function initCmdK() {
    const trigBtn = document.getElementById('cmdkBtn');
    if (trigBtn) trigBtn.addEventListener('click', openCmdK);
    // Click jump for sidebar widget
    document.querySelectorAll('[data-tab-jump]').forEach(el => {
      el.addEventListener('click', () => jumpToTab(el.getAttribute('data-tab-jump')));
    });
    document.addEventListener('keydown', e => {
      const isCmdK = (e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K');
      if (isCmdK) { e.preventDefault(); cmdkOpen ? closeCmdK() : openCmdK(); return; }
      if (!cmdkOpen) return;
      if (e.key === 'Escape') { e.preventDefault(); closeCmdK(); return; }
      if (e.key === 'ArrowDown') { e.preventDefault(); cmdkSelected = Math.min(cmdkSelected + 1, cmdkResults.length - 1); updateCmdKHighlight(); return; }
      if (e.key === 'ArrowUp')   { e.preventDefault(); cmdkSelected = Math.max(cmdkSelected - 1, 0); updateCmdKHighlight(); return; }
      if (e.key === 'Enter')     { e.preventDefault(); runCmdK(cmdkSelected); return; }
    });
    const inp = document.getElementById('cmdkInput');
    if (inp) inp.addEventListener('input', e => renderCmdK(e.target.value));
    const ov = document.getElementById('cmdkOverlay');
    if (ov) ov.addEventListener('click', e => { if (e.target === ov) closeCmdK(); });
  }

  // ═════════ HELPERS ═════════
  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function escapeAttr(s) { return escapeHtml(s).replace(/"/g, '&quot;'); }

  // ═════════ INIT ═════════
  ready(() => {
    initTheme();
    initCompact();
    renderRecent();
    initMiniWidget();
    initCmdK();
    setTimeout(() => { markEmojiAvatars(); watchAvatars(); }, 200);
    // Track tab switches for recent
    document.querySelectorAll('.nav-btn.tab').forEach(btn => {
      btn.addEventListener('click', () => {
        const t = btn.getAttribute('data-tab');
        const lbl = btn.querySelector('.nav-label')?.textContent?.trim();
        if (t && lbl) addRecent({ id: 'tab:' + t, label: lbl, tab: t, icon: '◌' });
      });
    });
  });
})();
