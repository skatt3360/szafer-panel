(function(){
  /* ═══ m00d modal open / close ═══ */
  function $(id){ return document.getElementById(id); }
  var modal    = $('moodModal');
  var openBtn  = $('moodBtn');
  var closeBtn = $('moodModalClose');
  var backdrop = $('moodModalBackdrop');

  function openMood() {
    if (!modal) return;
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }
  function closeMood() {
    if (!modal) return;
    modal.classList.add('hidden');
    document.body.style.overflow = '';
    document.documentElement.style.overflow = '';
  }
  if (openBtn)  openBtn.addEventListener('click', openMood);
  if (closeBtn) closeBtn.addEventListener('click', closeMood);
  if (backdrop) backdrop.addEventListener('click', closeMood);
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && modal && !modal.classList.contains('hidden')) closeMood();
  });

  /* ─ mood online count ─ */
  var countEl = $('moodOnlineCount');
  function updateMoodCount() {
    // placeholder – real count comes from Firebase presence
    var chips = document.querySelectorAll('.online-chip, .mood-pill-count');
    chips.forEach(function(c) {
      var n = parseInt(c.textContent) || 0;
      if (countEl && c !== countEl) countEl.textContent = n;
    });
  }
  setInterval(updateMoodCount, 5000);
  updateMoodCount();
})();

/* ════════════════════════════════════════════════════════
   CHANGELOG – działa z pełną delegacją zdarzeń
   (skrypt może być w dowolnym miejscu HTML)
   ════════════════════════════════════════════════════════ */
(function() {
  var _activeVer = 'v10.3';

  function showChangelog() {
    var m = document.getElementById('changelogModal');
    if (!m) return;
    m.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    switchClVer(_activeVer, true);
  }
  function closeChangelog() {
    var m = document.getElementById('changelogModal');
    if (!m) return;
    m.classList.add('hidden');
    document.body.style.overflow = '';
    document.documentElement.style.overflow = '';
  }
  function switchClVer(ver, skipAnim) {
    _activeVer = ver;
    var hdr = document.getElementById('clHeaderVer');
    if (hdr) hdr.textContent = 'Panel ' + ver + ' · Changelog';
    document.querySelectorAll('.cl-ver-btn').forEach(function(b) {
      b.classList.toggle('cl-ver-active', b.dataset.ver === ver);
    });
    document.querySelectorAll('.cl-ver-panel').forEach(function(p) {
      var match = p.dataset.verPanel === ver;
      if (match) {
        p.classList.remove('cl-ver-panel-hidden', 'hidden');
        if (!skipAnim) { p.style.animation='none'; void p.offsetWidth; p.style.animation=''; }
        p.querySelectorAll('.cl-item').forEach(function(it,i){ it.style.animationDelay=(0.04+i*0.035)+'s'; });
      } else {
        p.classList.add('cl-ver-panel-hidden');
      }
    });
  }

  /* ── Pełna delegacja – działa niezależnie od kolejności skryptu ── */
  document.addEventListener('click', function(e) {
    /* Version buttons */
    var verBtn = e.target.closest('.cl-ver-btn');
    if (verBtn && verBtn.dataset.ver) { switchClVer(verBtn.dataset.ver, false); return; }

    /* Open changelog */
    var openBtn = e.target.closest('#changelogOpenBtn');
    if (openBtn) { showChangelog(); return; }

    /* Close: × button */
    var closeX = e.target.closest('#changelogCloseBtn, .cl-close');
    if (closeX) { closeChangelog(); return; }

    /* Close: "Przeczytałem zmiany" */
    var dismiss = e.target.closest('#changelogDismissBtn, .cl-dismiss-btn');
    if (dismiss) { closeChangelog(); return; }

    /* Close: click on overlay backdrop */
    if (e.target.id === 'changelogModal') { closeChangelog(); return; }
  });

  /* iOS touch fallback dla dismiss */
  document.addEventListener('touchend', function(e) {
    var dismiss = e.target.closest('#changelogDismissBtn') ||
                  e.target.closest('.cl-dismiss-btn');
    if (dismiss) { e.preventDefault(); closeChangelog(); return; }
    var closeX = e.target.closest('#changelogCloseBtn') ||
                 e.target.closest('.cl-close');
    if (closeX) { e.preventDefault(); closeChangelog(); return; }
  }, { passive: false });

  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      var m = document.getElementById('changelogModal');
      if (m && !m.classList.contains('hidden')) closeChangelog();
    }
  });

  /* Scroll-unlock safety */
  setInterval(function() {
    if (document.body.style.overflow !== 'hidden') return;
    var anyOpen = document.querySelector(
      '.day-modal-overlay:not(.hidden),.mood-modal:not(.hidden),' +
      '.cl-overlay:not(.hidden),.media-lightbox:not(.hidden),' +
      '.ios-guide-overlay:not(.hidden)'
    );
    if (!anyOpen) { document.body.style.overflow=''; document.documentElement.style.overflow=''; }
  }, 2000);

  /* Auto-show once per version */
  (function() {
    var VER = 'v10.3', KEY = 'szaferCLseen_' + VER;
    function tryAutoShow() {
      var shell = document.getElementById('appShell');
      if (!shell || shell.classList.contains('hidden')) return;
      try { if (localStorage.getItem(KEY)) return; } catch(e){}
      showChangelog();
      try { localStorage.setItem(KEY, '1'); } catch(e){}
    }
    /* Watch for appShell becoming visible */
    var _obs = null;
    if (typeof MutationObserver !== 'undefined') {
      _obs = new MutationObserver(function() {
        var s = document.getElementById('appShell');
        if (s && !s.classList.contains('hidden')) { tryAutoShow(); if(_obs) _obs.disconnect(); }
      });
      _obs.observe(document.body, { attributes: true, subtree: true, attributeFilter: ['class'] });
    }
    /* Fallback */
    setTimeout(tryAutoShow, 2500);
  })();
})();

/* ════════════════════════════════════════════════════════
   iOS PUSH GUIDE MODAL
   ════════════════════════════════════════════════════════ */
(function() {
  function openIosGuide() {
    var el = document.getElementById('iosGuideModal');
    if (el) {
      el.classList.remove('hidden');
      document.body.style.overflow = 'hidden';
    }
  }
  function closeIosGuide() {
    var el = document.getElementById('iosGuideModal');
    if (el) {
      el.classList.add('hidden');
      /* Przywróć scroll tylko jeśli inne modale też zamknięte */
      var otherOpen = document.querySelector(
        '.cl-overlay:not(.hidden),.day-modal-overlay:not(.hidden),.mood-modal:not(.hidden)'
      );
      if (!otherOpen) {
        document.body.style.overflow = '';
        document.documentElement.style.overflow = '';
      }
    }
  }

  document.addEventListener('click', function(e) {
    var iosBtn = e.target.closest('#iosGuideOpenBtn') ||
                 e.target.closest('.btn-ios-guide');
    if (iosBtn) { openIosGuide(); return; }
    if (e.target.closest('#iosGuideClose')) { closeIosGuide(); return; }
    if (e.target.id === 'iosGuideModal') { closeIosGuide(); return; }
  });
  /* iOS: touch fallback dla btn-ios-guide */
  document.addEventListener('touchend', function(e) {
    var iosBtn = e.target.closest('#iosGuideOpenBtn') ||
                 e.target.closest('.btn-ios-guide');
    if (iosBtn) { e.preventDefault(); openIosGuide(); }
  }, { passive: false });
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      var el = document.getElementById('iosGuideModal');
      if (el && !el.classList.contains('hidden')) closeIosGuide();
    }
  });
})();

/* ════════════════════════════════════════════════════════
   HARMONOGRAM — highlight today column
   ════════════════════════════════════════════════════════ */
(function(){
  var jsDay = new Date().getDay();
  var colMap = [6,0,1,2,3,4,5];
  var col = colMap[jsDay];
  var tbl = document.getElementById('harmTbl');
  if (!tbl) return;
  tbl.querySelectorAll('[data-col="' + col + '"]').forEach(function(c) {
    c.classList.add('harm-today');
  });
})();
