/* ═══════════════════════════════════════════════════════════
   SZAFER PANEL v13.3 — ADDONS
   Command palette · Theme toggle · Compact mode
   Upcoming widget · Avatar photo upload + image rendering
═══════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  function ready(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }

  // ═════════ HELPERS ═════════
  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // ═════════ AVATAR — image vs emoji vs letter ═════════
  const EMOJI_RE = /[\p{Emoji_Presentation}\p{Extended_Pictographic}]/u;
  function isImage(v) { return typeof v === 'string' && (v.startsWith('data:image') || v.startsWith('http://') || v.startsWith('https://')); }

  function paintAvatar(el) {
    if (!el) return;
    // If the current textContent is an image URL/dataURL, render as <img>
    const raw = (el.textContent || '').trim();
    if (isImage(raw) && !el.querySelector('img.av-img')) {
      el.innerHTML = `<img class="av-img" src="${escapeHtml(raw)}" alt="" />`;
      el.setAttribute('data-avatar-mode', 'image');
      return;
    }
    // If element already has img.av-img inside but no longer should
    const img = el.querySelector('img.av-img');
    if (img && !isImage(img.getAttribute('src') || '')) {
      img.remove();
    }
    if (img) { el.setAttribute('data-avatar-mode', 'image'); return; }
    // Otherwise check emoji vs letter
    if (raw && EMOJI_RE.test(raw)) {
      el.setAttribute('data-avatar-mode', 'emoji');
      el.setAttribute('data-emoji', '1');
      el.setAttribute('data-has-emoji', '1');
    } else {
      el.setAttribute('data-avatar-mode', 'letter');
      el.removeAttribute('data-emoji');
      el.removeAttribute('data-has-emoji');
    }
  }
  function paintAllAvatars(root) {
    (root || document).querySelectorAll(
      '.tb-avatar-circle, .prof-avatar-preview, .pb-header-avatar, .tp-person-avatar, .chat-msg-avatar'
    ).forEach(paintAvatar);
  }

  function watchAvatars() {
    const obs = new MutationObserver(muts => {
      const seen = new Set();
      muts.forEach(m => {
        const t = m.target;
        if (!t) return;
        // climb to avatar root
        const av = t.nodeType === 1 ? t.closest('.tb-avatar-circle, .prof-avatar-preview, .pb-header-avatar, .tp-person-avatar, .chat-msg-avatar') : null;
        if (av && !seen.has(av)) { seen.add(av); paintAvatar(av); }
      });
    });
    obs.observe(document.body, { subtree: true, childList: true, characterData: true });
  }

  // ═════════ AVATAR — custom photo upload ═════════
  function injectAvatarUploadButton() {
    const picker = document.getElementById('profAvatarPicker');
    if (!picker || picker.querySelector('[data-av-upload]')) return;

    // Create upload button styled like other avatar buttons
    const btn = document.createElement('button');
    btn.className = 'prof-av-btn prof-av-upload-btn';
    btn.setAttribute('data-av-upload', '1');
    btn.title = 'Wgraj własne zdjęcie';
    btn.innerHTML = `
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="3"/>
        <circle cx="9" cy="9" r="2"/>
        <path d="M21 15l-5-5L5 21"/>
      </svg>
    `;
    picker.appendChild(btn);

    // Hidden file input (re-used)
    const fi = document.createElement('input');
    fi.type = 'file';
    fi.accept = 'image/*';
    fi.style.display = 'none';
    fi.id = 'profAvUploadInput';
    document.body.appendChild(fi);

    btn.addEventListener('click', () => fi.click());
    fi.addEventListener('change', async () => {
      const file = fi.files && fi.files[0];
      fi.value = '';
      if (!file) return;
      if (!file.type.startsWith('image/')) { alert('Wybierz plik graficzny'); return; }
      if (file.size > 4 * 1024 * 1024) { alert('Max 4MB'); return; }
      try {
        const dataUrl = await fileToDataUrl(file);
        const resized = await resizeImage(dataUrl, 240);
        applyCustomAvatar(resized);
      } catch (e) {
        alert('Błąd wgrywania zdjęcia: ' + e.message);
      }
    });
  }

  function applyCustomAvatar(dataUrl) {
    // Mark all picker buttons as not-selected
    document.querySelectorAll('#profAvatarPicker .prof-av-btn').forEach(b => b.classList.remove('selected'));
    // Mark our upload btn as selected
    const up = document.querySelector('[data-av-upload]');
    if (up) up.classList.add('selected');
    // Set the value into preview (textContent — picked up by saveProfile)
    const preview = document.getElementById('profAvatarPreview');
    if (preview) {
      preview.textContent = dataUrl;
      paintAvatar(preview);
    }
    // Sync internal state by simulating the existing avatar selection flow:
    // The app uses a closure variable `_selectedProfileAvatar`, set via click on .prof-av-btn[data-av]
    // We can't access closure, but saveProfile reads from the variable... Workaround:
    // Create or re-use a synthetic .prof-av-btn with this dataUrl and click it.
    let synth = document.querySelector('[data-av-synth]');
    if (!synth) {
      synth = document.createElement('button');
      synth.setAttribute('data-av-synth', '1');
      synth.className = 'prof-av-btn';
      synth.style.display = 'none';
      const picker = document.getElementById('profAvatarPicker');
      if (picker) picker.appendChild(synth);
    }
    synth.setAttribute('data-av', dataUrl);
    synth.textContent = ''; // empty visual
    // Trigger native click on synth → existing delegated handler in app.js will set _selectedProfileAvatar
    synth.click();
    // After the click, the app sets preview.textContent = _selectedProfileAvatar (the dataUrl) — paint it
    setTimeout(() => paintAvatar(preview), 30);
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

  // ═════════ UPCOMING WIDGET ═════════
  const POL_MONTHS = ['STY','LUT','MAR','KWI','MAJ','CZE','LIP','SIE','WRZ','PAŹ','LIS','GRU'];
  function refreshUpcoming() {
    const list = document.getElementById('sidebarUpcomingList');
    if (!list) return;
    // Read from rendered .il-row elements — they're already sorted (active first by date asc)
    const rows = document.querySelectorAll('#itemList .il-row:not(.il-done)');
    const items = [];
    rows.forEach(row => {
      const day  = row.querySelector('.il-day')?.textContent?.trim() || '';
      const mon  = row.querySelector('.il-mon')?.textContent?.trim() || '';
      const title= row.querySelector('.il-title')?.textContent?.trim() || '';
      const accent = row.style.getPropertyValue('--il-color') || '#fbbf24';
      const typeChip = row.querySelector('.il-chip-type');
      const type = typeChip ? typeChip.textContent.trim().split(/\s+/).slice(1).join(' ') : '';
      if (day && title) {
        items.push({ day, mon, title, accent: accent.trim(), type });
      }
    });
    const top = items.slice(0, 3);
    if (!top.length) {
      list.innerHTML = '<div class="su-empty">Brak nadchodzących wpisów</div>';
      return;
    }
    list.innerHTML = top.map(it => `
      <div class="su-item" data-tab-jump="calendar" style="--su-color:${escapeHtml(it.accent)}">
        <div class="su-date">
          <span class="su-day">${escapeHtml(it.day)}</span>
          <span class="su-mon">${escapeHtml(it.mon)}</span>
        </div>
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
    // Also when calendar items mutate
    const it = document.getElementById('itemList');
    if (it) {
      const obs = new MutationObserver(() => refreshUpcoming());
      obs.observe(it, { childList: true, subtree: true });
    }
    // Click jump targets
    document.querySelectorAll('[data-tab-jump]').forEach(el => {
      el.addEventListener('click', e => {
        const tab = el.getAttribute('data-tab-jump');
        if (tab) { e.stopPropagation(); jumpToTab(tab); }
      });
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
    const chatMsgs = document.querySelectorAll('[data-tab-panel="chat"] .chat-bubble');
    Array.from(chatMsgs).slice(-30).forEach((el, i) => {
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
    for (let i = 0; i < hay.length && qi < q.length; i++) {
      if (hay[i] === q[qi]) qi++;
    }
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

  // ═════════ UPLOAD — group by folder ═════════
  function regroupUploadByFolder() {
    const list = document.getElementById('uploadFileList');
    if (!list) return;
    if (list.getAttribute('data-grouped') === '1') return;
    // We don't change app.js render structure — just CSS handles visual.
    // But we add data-folder attributes from the existing chips/cards if missing.
    list.setAttribute('data-grouped', '1');
  }

  // ═════════ INIT ═════════
  ready(() => {
    initTheme();
    initCompact();
    initUpcoming();
    initCmdK();
    setTimeout(() => { paintAllAvatars(); watchAvatars(); }, 200);
    setTimeout(() => { injectAvatarUploadButton(); }, 400);
    // Re-inject when profile modal opens (in case modal HTML re-renders)
    const profBtn = document.getElementById('topbarAvatarBtn');
    if (profBtn) profBtn.addEventListener('click', () => setTimeout(injectAvatarUploadButton, 100));
    // Watch for upload list changes to regroup
    const ul = document.getElementById('uploadFileList');
    if (ul) {
      const obs = new MutationObserver(() => { regroupUploadByFolder(); paintAllAvatars(ul); });
      obs.observe(ul, { childList: true, subtree: true });
    }
  });
})();
