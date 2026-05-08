/* ═══════════════════════════════════════════════════════════
   SZAFER PANEL v13.4 — ADDONS
   Command palette · Theme · Compact · Upcoming
   Avatar v2 (image/emoji/letter, photo upload, robust paint)
═══════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  function ready(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }
  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // ═════════ AVATAR PAINTER ═════════
  const EMOJI_RE = /[\p{Emoji_Presentation}\p{Extended_Pictographic}]/u;
  const AV_SELECTOR = '.tb-avatar-circle, .prof-avatar-preview, .pb-header-avatar, .tp-person-avatar, .chat-msg-avatar, .chat-dm-avatar';
  function isImageVal(v) {
    return typeof v === 'string' && (v.startsWith('data:image') || /^https?:\/\//.test(v));
  }

  // Read the "intended" avatar value from element. Prefer dataset.avSrc, then textContent.
  function readAvVal(el) {
    if (el.dataset && el.dataset.avSrc) return el.dataset.avSrc;
    // If we already painted as image, keep current
    const img = el.querySelector('img.av-img');
    if (img && img.src) return img.src;
    return (el.textContent || '').trim();
  }

  function paintAvatar(el) {
    if (!el) return;
    const val = readAvVal(el);
    if (!val) {
      el.setAttribute('data-avatar-mode', 'letter');
      return;
    }
    if (isImageVal(val)) {
      // Cache the value so re-paints don't lose it when textContent gets cleared
      el.dataset.avSrc = val;
      const existingImg = el.querySelector('img.av-img');
      if (existingImg) {
        if (existingImg.getAttribute('src') !== val) existingImg.setAttribute('src', val);
      } else {
        el.innerHTML = '<img class="av-img" alt="" />';
        el.querySelector('img.av-img').setAttribute('src', val);
      }
      el.setAttribute('data-avatar-mode', 'image');
      return;
    }
    // Not an image — clear cached src
    delete el.dataset.avSrc;
    // If element has img.av-img but value is not image, remove img and set text
    if (el.querySelector('img.av-img')) {
      el.innerHTML = '';
      el.textContent = val;
    }
    if (EMOJI_RE.test(val)) {
      el.setAttribute('data-avatar-mode', 'emoji');
    } else {
      el.setAttribute('data-avatar-mode', 'letter');
    }
  }

  function paintAllAvatars(root) {
    (root || document).querySelectorAll(AV_SELECTOR).forEach(paintAvatar);
  }

  // Robust observation strategy:
  // 1. MutationObserver — catches direct DOM mutations
  // 2. Periodic repaint — fallback for missed changes
  // 3. Click listener on .prof-av-btn → repaint after handler
  function watchAvatars() {
    const obs = new MutationObserver(muts => {
      const seen = new Set();
      muts.forEach(m => {
        if (!m.target) return;
        const targets = [];
        if (m.target.nodeType === 1 && m.target.matches?.(AV_SELECTOR)) targets.push(m.target);
        const closest = m.target.nodeType === 1 ? m.target.closest?.(AV_SELECTOR)
                       : (m.target.parentElement && m.target.parentElement.closest?.(AV_SELECTOR));
        if (closest) targets.push(closest);
        targets.forEach(t => { if (!seen.has(t)) { seen.add(t); paintAvatar(t); } });
      });
    });
    obs.observe(document.body, { subtree: true, childList: true, characterData: true });
    // Periodic safety net — cheap, idempotent
    setInterval(() => paintAllAvatars(), 600);
  }

  // ═════════ CUSTOM PHOTO UPLOAD ═════════
  let __avFileInput = null;
  function ensureFileInput() {
    if (__avFileInput) return __avFileInput;
    __avFileInput = document.createElement('input');
    __avFileInput.type = 'file';
    __avFileInput.accept = 'image/*';
    __avFileInput.style.display = 'none';
    document.body.appendChild(__avFileInput);
    __avFileInput.addEventListener('change', async () => {
      const file = __avFileInput.files && __avFileInput.files[0];
      __avFileInput.value = '';
      if (!file) return;
      if (!file.type.startsWith('image/')) { alert('Wybierz plik graficzny'); return; }
      if (file.size > 4 * 1024 * 1024) { alert('Max 4 MB'); return; }
      try {
        const dataUrl = await fileToDataUrl(file);
        const resized = await resizeImage(dataUrl, 240);
        applyCustomAvatar(resized);
      } catch (e) {
        alert('Błąd: ' + e.message);
      }
    });
    return __avFileInput;
  }
  function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = reject;
      r.readAsDataURL(file);
    });
  }
  function resizeImage(dataUrl, max) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;
        if (width > height) {
          if (width > max) { height = Math.round(height * (max / width)); width = max; }
        } else {
          if (height > max) { width = Math.round(width * (max / height)); height = max; }
        }
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.86));
      };
      img.onerror = reject;
      img.src = dataUrl;
    });
  }

  function applyCustomAvatar(value) {
    // Mark all picker buttons unselected
    document.querySelectorAll('#profAvatarPicker .prof-av-btn').forEach(b => b.classList.remove('selected'));
    // Paint preview immediately (image mode)
    const preview = document.getElementById('profAvatarPreview');
    if (preview) {
      preview.dataset.avSrc = value;
      paintAvatar(preview);
    }
    // Sync internal state via synthetic .prof-av-btn[data-av]
    let synth = document.querySelector('[data-av-synth]');
    if (!synth) {
      synth = document.createElement('button');
      synth.setAttribute('data-av-synth', '1');
      synth.className = 'prof-av-btn';
      synth.style.display = 'none';
      const picker = document.getElementById('profAvatarPicker');
      if (picker) picker.appendChild(synth);
    }
    synth.setAttribute('data-av', value);
    synth.click();
    // After native click, app.js sets preview.textContent = value (long string).
    // Repaint forces image mode.
    setTimeout(() => paintAllAvatars(), 30);
  }

  function clearAvatar() {
    document.querySelectorAll('#profAvatarPicker .prof-av-btn').forEach(b => b.classList.remove('selected'));
    let synth = document.querySelector('[data-av-synth]');
    if (!synth) {
      synth = document.createElement('button');
      synth.setAttribute('data-av-synth', '1');
      synth.className = 'prof-av-btn';
      synth.style.display = 'none';
      const picker = document.getElementById('profAvatarPicker');
      if (picker) picker.appendChild(synth);
    }
    synth.setAttribute('data-av', '');
    synth.click();
    const preview = document.getElementById('profAvatarPreview');
    if (preview) {
      delete preview.dataset.avSrc;
      paintAvatar(preview);
    }
  }

  function bindAvatarTriggers() {
    document.addEventListener('click', e => {
      // Custom avatar upload trigger
      if (e.target.closest('[data-av-upload-trigger]')) {
        e.preventDefault();
        ensureFileInput().click();
        return;
      }
      // Clear avatar
      if (e.target.closest('[data-av-clear-trigger]')) {
        e.preventDefault();
        clearAvatar();
        return;
      }
      // After picking emoji, repaint
      if (e.target.closest('.prof-av-btn')) {
        setTimeout(() => paintAllAvatars(), 20);
      }
      // After save, repaint
      if (e.target.closest('#profSaveBtn')) {
        setTimeout(() => paintAllAvatars(), 200);
        setTimeout(() => paintAllAvatars(), 800);
      }
    });
  }

  // ═════════ THEME TOGGLE ═════════
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
    matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => {
      const cur = document.documentElement.getAttribute('data-theme-pref') || 'dark';
      if (cur === 'auto') applyTheme('auto');
    });
  }

  // ═════════ COMPACT ═════════
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

  // ═════════ UPCOMING WIDGET ═════════
  function refreshUpcoming() {
    const list = document.getElementById('sidebarUpcomingList');
    if (!list) return;
    const rows = document.querySelectorAll('#itemList .il-row:not(.il-done)');
    const items = [];
    rows.forEach(row => {
      const day  = row.querySelector('.il-day')?.textContent?.trim() || '';
      const mon  = row.querySelector('.il-mon')?.textContent?.trim() || '';
      const title= row.querySelector('.il-title')?.textContent?.trim() || '';
      const accent = (row.style.getPropertyValue('--il-color') || '#fbbf24').trim();
      const typeChip = row.querySelector('.il-chip-type');
      const type = typeChip ? typeChip.textContent.trim().split(/\s+/).slice(1).join(' ') : '';
      if (day && title) items.push({ day, mon, title, accent, type });
    });
    const top = items.slice(0, 3);
    if (!top.length) {
      list.innerHTML = '<div class="su-empty">Brak nadchodzących wpisów</div>';
      return;
    }
    list.innerHTML = top.map(it => `
      <div class="su-item" style="--su-color:${escapeHtml(it.accent)}">
        <div class="su-date"><span class="su-day">${escapeHtml(it.day)}</span><span class="su-mon">${escapeHtml(it.mon)}</span></div>
        <div class="su-body">
          <div class="su-title">${escapeHtml(it.title)}</div>
          ${it.type ? `<div class="su-type">${escapeHtml(it.type)}</div>` : ''}
        </div>
      </div>
    `).join('');
    list.querySelectorAll('.su-item').forEach(el => {
      el.addEventListener('click', () => jumpToTab('calendar'));
    });
  }
  function initUpcoming() {
    refreshUpcoming();
    setInterval(refreshUpcoming, 6000);
    const it = document.getElementById('itemList');
    if (it) {
      const obs = new MutationObserver(() => refreshUpcoming());
      obs.observe(it, { childList: true, subtree: true });
    }
    document.querySelectorAll('[data-tab-jump]').forEach(el => {
      el.addEventListener('click', e => {
        const tab = el.getAttribute('data-tab-jump');
        if (tab) { e.stopPropagation(); jumpToTab(tab); }
      });
    });
  }

  // ═════════ CMD-K ═════════
  const TAB_INDEX = [
    { id: 'tab:calendar',   label: 'Panel · Kalendarz',  tab: 'calendar',    icon: '◧', kw: 'panel kalendarz wpisy' },
    { id: 'tab:tasks',      label: 'Zadania',            tab: 'tasks',       icon: '✓', kw: 'zadania todo task' },
    { id: 'tab:planning',   label: 'Planowanie',         tab: 'planning',    icon: '◫', kw: 'planowanie boards person' },
    { id: 'tab:chat',       label: 'Chat',               tab: 'chat',        icon: '✉', kw: 'chat wiadomości' },
    { id: 'tab:upload',     label: 'Upload · Pliki',     tab: 'upload',      icon: '⇧', kw: 'upload pliki media' },
    { id: 'tab:harmonogram',label: 'Harmonogram',        tab: 'harmonogram', icon: '◴', kw: 'harmonogram tygodniowy plan' },
  ];
  const ACTION_INDEX = [
    { id: 'act:profile', label: 'Edytuj profil', action: () => window.openProfileModal && window.openProfileModal(), icon: '◉', kw: 'profil avatar konto' },
    { id: 'act:changelog', label: 'Lista zmian', action: () => { const b=document.getElementById('changelogOpenBtn'); b && b.click(); }, icon: '✦', kw: 'zmiany changelog history' },
    { id: 'act:logout', label: 'Wyloguj', action: () => { const b=document.getElementById('logoutBtn'); b && b.click(); }, icon: '⏻', kw: 'wyloguj logout' },
    { id: 'act:theme', label: 'Przełącz motyw', action: () => { const b=document.getElementById('sfThemeBtn'); b && b.click(); }, icon: '◐', kw: 'theme motyw' },
    { id: 'act:compact', label: 'Tryb kompaktowy', action: () => { const b=document.getElementById('sfCompactBtn'); b && b.click(); }, icon: '⊟', kw: 'compact sidebar' },
  ];
  function collectDynamicResults() {
    const results = [];
    document.querySelectorAll('[data-tab-panel="tasks"] .task-card').forEach((el, i) => {
      const text = (el.querySelector('.task-title')?.textContent || el.textContent || '').trim().slice(0, 80);
      if (text && text.length > 2) results.push({ id: 'task:' + i, label: text, tab: 'tasks', icon: '✓', kw: 'zadanie ' + text.toLowerCase(), type: 'Zadanie' });
    });
    document.querySelectorAll('#itemList .il-row').forEach((el, i) => {
      const title = el.querySelector('.il-title')?.textContent.trim() || '';
      if (title && title.length > 2) results.push({ id: 'cal:' + i, label: title, tab: 'calendar', icon: '◧', kw: 'wpis ' + title.toLowerCase(), type: 'Wpis' });
    });
    document.querySelectorAll('[data-tab-panel="planning"] .pb-item-text').forEach((el, i) => {
      const text = el.textContent.trim().slice(0, 80);
      if (text && text.length > 2) results.push({ id: 'plan:' + i, label: text, tab: 'planning', icon: '◫', kw: 'planowanie ' + text.toLowerCase(), type: 'Plan' });
    });
    Array.from(document.querySelectorAll('[data-tab-panel="chat"] .chat-bubble')).slice(-30).forEach((el, i) => {
      const text = el.textContent.trim().slice(0, 80);
      if (text && text.length > 2) results.push({ id: 'chat:' + i, label: text, tab: 'chat', icon: '✉', kw: 'wiadomość ' + text.toLowerCase(), type: 'Chat' });
    });
    return results;
  }
  function fuzzyScore(query, item) {
    if (!query) return 1;
    const q = query.toLowerCase().trim();
    const hay = (item.label + ' ' + (item.kw || '')).toLowerCase();
    if (hay.includes(q)) return 100 - Math.abs(hay.indexOf(q));
    let qi = 0;
    for (let i = 0; i < hay.length && qi < q.length; i++) if (hay[i] === q[qi]) qi++;
    return qi === q.length ? 50 : 0;
  }
  let cmdkOpen = false, cmdkSelected = 0, cmdkResults = [];
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
    const groups = {};
    cmdkResults.forEach(r => {
      const t = r.action ? 'Akcje' : (r.type || (r.id.startsWith('tab:') ? 'Zakładki' : 'Inne'));
      groups[t] = groups[t] || [];
      groups[t].push(r);
    });
    let html = '', idx = 0;
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
      btn.addEventListener('click', () => runCmdK(parseInt(btn.getAttribute('data-idx'),10) || 0));
      btn.addEventListener('mouseenter', () => { cmdkSelected = parseInt(btn.getAttribute('data-idx'),10) || 0; updateCmdKHighlight(); });
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
    if (cur) { cur.classList.add('selected'); cur.scrollIntoView({ block: 'nearest' }); }
  }
  function runCmdK(i) {
    const r = cmdkResults[i];
    if (!r) return;
    closeCmdK();
    if (r.action) { try { r.action(); } catch(e){ console.warn(e); } return; }
    if (r.tab) jumpToTab(r.tab);
  }
  function jumpToTab(tab) {
    const btn = document.querySelector('.nav-btn.tab[data-tab="' + tab + '"]');
    if (btn) btn.click();
  }
  function initCmdK() {
    const trigBtn = document.getElementById('cmdkBtn');
    if (trigBtn) trigBtn.addEventListener('click', openCmdK);
    document.addEventListener('keydown', e => {
      const isCmdK = (e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K');
      if (isCmdK) { e.preventDefault(); cmdkOpen ? closeCmdK() : openCmdK(); return; }
      if (!cmdkOpen) return;
      if (e.key === 'Escape')    { e.preventDefault(); closeCmdK(); return; }
      if (e.key === 'ArrowDown') { e.preventDefault(); cmdkSelected = Math.min(cmdkSelected + 1, cmdkResults.length - 1); updateCmdKHighlight(); return; }
      if (e.key === 'ArrowUp')   { e.preventDefault(); cmdkSelected = Math.max(cmdkSelected - 1, 0); updateCmdKHighlight(); return; }
      if (e.key === 'Enter')     { e.preventDefault(); runCmdK(cmdkSelected); return; }
    });
    const inp = document.getElementById('cmdkInput');
    if (inp) inp.addEventListener('input', e => renderCmdK(e.target.value));
    const ov = document.getElementById('cmdkOverlay');
    if (ov) ov.addEventListener('click', e => { if (e.target === ov) closeCmdK(); });
  }

  // ═════════ INIT ═════════
  ready(() => {
    initTheme();
    initCompact();
    initUpcoming();
    initCmdK();
    bindAvatarTriggers();
    setTimeout(() => { paintAllAvatars(); watchAvatars(); }, 200);
    // Repaint when profile modal opens
    const tbBtn = document.getElementById('topbarAvatarBtn');
    if (tbBtn) tbBtn.addEventListener('click', () => setTimeout(paintAllAvatars, 120));
  });
})();
