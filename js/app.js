    import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js";
    import {
      getAuth,
      onAuthStateChanged,
      signInWithEmailAndPassword,
      createUserWithEmailAndPassword,
      signOut,
      sendEmailVerification,
      updatePassword,
      updateProfile
    } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";
    import {
      getDatabase,
      ref,
      onValue,
      set,
      onDisconnect,
      serverTimestamp
    } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-database.js";

    const firebaseConfig = {
      apiKey: "AIzaSyC1yUVD47m16FFRGh6LEpWpVZkAHHuiTXU",
      authDomain: "szaferpage.firebaseapp.com",
      databaseURL: "https://szaferpage-default-rtdb.europe-west1.firebasedatabase.app",
      projectId: "szaferpage",
      storageBucket: "szaferpage.firebasestorage.app",
      messagingSenderId: "240077599565",
      appId: "1:240077599565:web:01deea4f5908bc9f01bd04",
      measurementId: "G-YKQKZ84PNK"
    };

    const PERSONS = ["Szafer", "blajetttp", "Skat"];
    const EMAIL_TO_PERSON = {
      "blajetttp@gmail.com": "blajetttp",
      "szafer": "szafer",
      "skat": "skat"
    };
    function resolvePersonFromEmail(email) {
      if (!email) return '';
      var e = email.toLowerCase().trim();
      if (EMAIL_TO_PERSON[e]) return EMAIL_TO_PERSON[e];
      for (var i = 0; i < PERSONS.length; i++) {
        if (e.includes(PERSONS[i].toLowerCase())) return PERSONS[i].toLowerCase();
      }
      return e.split('@')[0];
    }
    var emailToPerson = resolvePersonFromEmail; // alias for backward compat
    const TASK_STATUSES = ["Do zrobienia", "W toku", "Zrobione"];
    const ITEM_TYPES = ["Klip", "Rolka", "Post", "Story", "Backstage", "Spotkanie", "Sesja w Studio", "Sesja Zdjęciowa/Filmowa"];
    const ITEM_STATUSES = ["Plan", "W produkcji", "Gotowe", "Opublikowane"];
    const STORAGE_KEY = "szafer_panel_backup_v3";

    const app = initializeApp(firebaseConfig);
    const auth = getAuth(app);
    const db = getDatabase(app);
    const sharedRef = ref(db, "szaferPanel/shared");

    const $ = (id) => document.getElementById(id);

    const els = {
      dbStatus: $("dbStatus"),
      authStatus: $("authStatus"),
      userLabel: $("userLabel"),
      logoutBtn: $("logoutBtn"),
      authGate: $("authGate"),
      authReady: $("authReady"),
      currentUserEmail: $("currentUserEmail"),
      authMessage: $("authMessage"),
      appShell: $("appShell"),
      loginEmail: $("loginEmail"),
      loginPassword: $("loginPassword"),
      loginBtn: $("loginBtn"),
      registerBtn: $("registerBtn"),

      metricMonth: $("metricMonth"),
      metricItems: $("metricItems"),
      metricTasks: $("metricTasks"),
      metricMeetings: $("metricMeetings"),

      calendarMonthLabel: $("calendarMonthLabel"),
      calendarDays: $("calendarDays"),
      upcomingList: $("upcomingList"),

      goalTrack: $("goalTrack"),
      goalPosts: $("goalPosts"),
      goalStreams: $("goalStreams"),
      goalNote: $("goalNote"),

      taskTitle: $("taskTitle"),
      taskDue: $("taskDue"),
      taskStatus: $("taskStatus"),
      taskOwner: $("taskOwner"),
      taskPriority: $("taskPriority"),
      taskNotes: $("taskNotes"),
      saveTaskBtn: $("saveTaskBtn"),
      cancelTaskEditBtn: $("cancelTaskEditBtn"),
      taskFormMode: $("taskFormMode"),
      taskList: $("taskList"),

      itemTitle: $("itemTitle"),
      itemDate: $("itemDate"),
      itemType: $("itemType"),
      itemStatus: $("itemStatus"),
      itemOwner: $("itemOwner"),
      itemPlace: $("itemPlace"),
      itemNotes: $("itemNotes"),
      saveItemBtn: $("saveItemBtn"),
      cancelItemEditBtn: $("cancelItemEditBtn"),
      itemFormMode: $("itemFormMode"),
      itemList: $("itemList"),
      itemColorPicker: $("itemColorPicker"),

      personBoards: $("personBoards"),

      prevMonthBtn: $("prevMonthBtn"),
      nextMonthBtn: $("nextMonthBtn"),
      todayBtn: $("todayBtn"),
      seedBtn: $("seedBtn"),
      exportBtn: $("exportBtn")
    };

    let currentUser = null;
    let currentMonth = new Date();
    let editingItemId = null;
    let selectedItemColor = '';
    let editingTaskId = null;
    let dbUnsubscribe = null;
    let dbTasksUnsubscribe = null;
    let userTasksDbRef = null;
    let _isSaving = false; // blokuje onValue podczas zapisu

    const demoState = {
      goals: {
        track: "Singiel 1 (klip 1)",
        posts: "3-4 / tydzień",
        streams: "+ X słuchaczy"
      },
      items: [
        { id: uid(), title: "Spotkanie rolloutowe", date: futureDate(1), type: "Spotkanie", status: "Plan", owner: "Skat", place: "Zoom", notes: "Omówić tydzień, CTA i priorytety", createdBy: "system" },
        { id: uid(), title: "Klip 1 – premiera", date: futureDate(2), type: "Klip", status: "Plan", owner: "Szafer", place: "YouTube", notes: "Hero content", createdBy: "system" },
        { id: uid(), title: "Rolka – hook refrenu", date: futureDate(3), type: "Rolka", status: "Plan", owner: "blajetttp", place: "TikTok / Reels", notes: "8-12 sekund", createdBy: "system" },
        { id: uid(), title: "Post – grafika z singla", date: futureDate(4), type: "Post", status: "Plan", owner: "Skat", place: "Instagram", notes: "Grafika + caption", createdBy: "system" }
      ],
      tasks: [
        { id: uid(), title: "Zebrać RAW-y do shortów", due: futureDate(1), status: "W toku", owner: "blajetttp", priority: "Wysoki", notes: "Folder z planu klipu 1", createdBy: "system" },
        { id: uid(), title: "Spiąć okładkę singla", due: futureDate(2), status: "Do zrobienia", owner: "Skat", priority: "Średni", notes: "Wersja IG + Spotify", createdBy: "system" },
        { id: uid(), title: "Akcept publikacji klipu", due: futureDate(2), status: "Do zrobienia", owner: "Szafer", priority: "Wysoki", notes: "Final check", createdBy: "system" }
      ]
    };

    let state = loadLocal() || structuredClone(demoState);
    normalizeState();

    initSelects();
    initTabs();
    bindEvents();
    renderAll();
    initAuth();

    function uid() {
      return "id_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    }

    function futureDate(plus) {
      const d = new Date();
      d.setDate(d.getDate() + plus);
      return toISODate(d);
    }

    function toISODate(d) {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    }

    function prettyMonth(d) {
      return d.toLocaleDateString("pl-PL", { month: "long", year: "numeric" });
    }

    function loadLocal() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : null;
      } catch {
        return null;
      }
    }

    function saveLocal() {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }

    function normalizeState() {
      if (!state || typeof state !== "object") state = structuredClone(demoState);
      if (!state.goals) state.goals = { track: "", posts: "", streams: "" };
      if (!Array.isArray(state.items)) state.items = [];
      if (!Array.isArray(state.tasks)) state.tasks = [];

      state.items = state.items.map(x => ({
        id: x.id || uid(),
        title: x.title || "",
        date: x.date || toISODate(new Date()),
        type: ITEM_TYPES.includes(x.type) ? x.type : "Post",
        status: ITEM_STATUSES.includes(x.status) ? x.status : "Plan",
        owner: PERSONS.includes(x.owner) ? x.owner : PERSONS[0],
        place: x.place || "",
        notes: x.notes || "",
        color: x.color || "",
        createdBy: x.createdBy || "",
        completed: !!x.completed,
        completedAt: x.completedAt || null,
        mediaFiles: Array.isArray(x.mediaFiles) ? x.mediaFiles : []
      }));

      state.tasks = state.tasks.map(x => ({
        id: x.id || uid(),
        title: x.title || "",
        due: x.due || toISODate(new Date()),
        status: TASK_STATUSES.includes(x.status) ? x.status : "Do zrobienia",
        owner: PERSONS.includes(x.owner) ? x.owner : PERSONS[0],
        priority: ["Niski","Średni","Wysoki"].includes(x.priority) ? x.priority : "Średni",
        notes: x.notes || "",
        createdBy: x.createdBy || "",
        completed: !!x.completed,
        completedAt: x.completedAt || null,
        completed_prev_status: x.completed_prev_status || null
      }));

      if (!state.goals.track) state.goals.track = "Singiel 1";
      if (!state.goals.posts) state.goals.posts = "3-4 / tydzień";
      if (!state.goals.streams) state.goals.streams = "+ X słuchaczy";
      if (state.goals.note === undefined) state.goals.note = "";
    }

    function initSelects() {
      fillSelect(els.taskStatus, TASK_STATUSES);
      fillSelect(els.taskOwner, PERSONS);
      fillSelect(els.itemType, ITEM_TYPES);
      fillSelect(els.itemStatus, ITEM_STATUSES);
      fillSelect(els.itemOwner, PERSONS);
    }

    function fillSelect(selectEl, values) {
      selectEl.innerHTML = values.map(v => `<option value="${v}">${v}</option>`).join("");
    }

    function initTabs() {
      // Build ordered tab list for direction detection
      var tabOrder = [];
      document.querySelectorAll('.tab').forEach(function(b){ tabOrder.push(b.dataset.tab); });

      document.querySelectorAll(".tab").forEach(btn => {
        btn.addEventListener("click", () => {
          var tab = btn.dataset.tab;
          var currentPanel = document.querySelector('.tab-panel:not(.hidden)');
          var nextPanel = document.querySelector('.tab-panel[data-tab-panel="' + tab + '"]');
          if (currentPanel === nextPanel) return;

          // Determine direction: left or right
          var currentTab = currentPanel ? currentPanel.dataset.tabPanel : '';
          var fromIdx = tabOrder.indexOf(currentTab);
          var toIdx   = tabOrder.indexOf(tab);
          var goingForward = toIdx >= fromIdx;

          document.querySelectorAll(".tab").forEach(x => x.classList.remove("active"));
          btn.classList.add("active");

          var leaveClass = goingForward ? 'tab-leaving' : 'tab-leaving-reverse';
          var enterClass = goingForward ? 'tab-entering' : 'tab-entering-reverse';

          // Clean leave animation on current panel
          if (currentPanel) {
            currentPanel.classList.add(leaveClass);
            currentPanel.addEventListener('animationend', function onLeave() {
              currentPanel.removeEventListener('animationend', onLeave);
              currentPanel.classList.add('hidden');
              currentPanel.classList.remove(leaveClass);
              showNext();
            }, { once: true });
            // Fallback if animationend doesn't fire
            setTimeout(function() {
              if (!currentPanel.classList.contains('hidden')) {
                currentPanel.classList.add('hidden');
                currentPanel.classList.remove(leaveClass);
                showNext();
              }
            }, 280);
          } else {
            showNext();
          }

          var _nextShown = false;
          function showNext() {
            if (_nextShown) return;
            _nextShown = true;
            if (nextPanel) {
              nextPanel.classList.remove('hidden');
              nextPanel.classList.remove('tab-entering', 'tab-entering-reverse');
              void nextPanel.offsetWidth; // force reflow
              nextPanel.classList.add(enterClass);
              nextPanel.addEventListener('animationend', function onEnter() {
                nextPanel.removeEventListener('animationend', onEnter);
                nextPanel.classList.remove('tab-entering', 'tab-entering-reverse');
              }, { once: true });
              // Fallback
              setTimeout(function() { nextPanel.classList.remove('tab-entering', 'tab-entering-reverse'); }, 500);
            }
            // Init upload tab on first visit
            if (tab === 'upload') { try { initUpload(); } catch(e){} }
            if (tab === 'planning') { try { renderMediaAttachGrid(); } catch(e){} }
            if (tab === 'chat') {
              try { initChat(); subscribeChatChannel(); } catch(e){}
              // Always scroll to bottom when entering chat tab
              setTimeout(function() {
                var chatContainer = document.getElementById('chatMessages');
                if (chatContainer) chatContainer.scrollTop = chatContainer.scrollHeight;
              }, 350);
            }
          }
        });
      });
    }

    function bindEvents() {
      // ── Logo → Panel (scroll to top + switch tab) ──
      var logoHome = document.getElementById('szaferLogoHome');
      if (logoHome) {
        logoHome.addEventListener('click', function() {
          var panelBtn = document.querySelector('[data-tab="calendar"]');
          var currentPanel = document.querySelector('.tab-panel:not(.hidden)');
          var isOnPanel = currentPanel && currentPanel.dataset.tabPanel === 'calendar';
          if (panelBtn && !isOnPanel) {
            panelBtn.click();
          }
          window.scrollTo({ top: 0, behavior: 'smooth' });
        });
      }

      els.loginBtn.addEventListener("click", handleLogin);
      // Enter key on login fields
      [els.loginEmail, els.loginPassword].forEach(function(el) {
        if (!el) return;
        el.addEventListener("keydown", function(e) {
          if (e.key === "Enter") { e.preventDefault(); handleLogin(); }
        });
      });
      els.registerBtn.addEventListener("click", handleRegister);
      els.logoutBtn.addEventListener("click", async () => {
        await signOut(auth);
      });

      els.prevMonthBtn.addEventListener("click", () => {
        currentMonth.setMonth(currentMonth.getMonth() - 1);
        renderCalendar();
      });
      els.nextMonthBtn.addEventListener("click", () => {
        currentMonth.setMonth(currentMonth.getMonth() + 1);
        renderCalendar();
      });
      els.todayBtn.addEventListener("click", () => {
        currentMonth = new Date();
        renderCalendar();
      });

      els.saveItemBtn.addEventListener("click", saveItemFromForm);
      els.cancelItemEditBtn.addEventListener("click", cancelItemEdit);
      els.saveTaskBtn.addEventListener("click", saveTaskFromForm);
      els.cancelTaskEditBtn.addEventListener("click", cancelTaskEdit);
      els.seedBtn.addEventListener("click", seedDemo);
      els.exportBtn.addEventListener("click", exportJson);
      // ── Calendar day click ──
      els.calendarDays.addEventListener('click', function(e) {
        var cell = e.target.closest('.day');
        if (cell && cell.dataset.iso) openDayModal(cell.dataset.iso);
      });
      // ── Day modal ──
      $('dayModalCloseX').addEventListener('click', closeDayModal);
      $('dayModalCloseBtn').addEventListener('click', closeDayModal);
      $('dayModal').addEventListener('click', function(e) { if (e.target === this) closeDayModal(); });
      $('dayModalAddBtn').addEventListener('click', function() {
        var iso = this.dataset.iso || '';
        closeDayModal();
        if (iso && els.itemDate) {
          els.itemDate.value = iso;
          updateDatePreview('itemDate', 'itemDatePreview');
        }
        switchTab('planning');
        setTimeout(function() {
          var _f = document.getElementById('itemTitle');
          if (_f) { _f.scrollIntoView({ behavior: 'smooth', block: 'center' }); _f.focus(); }
        }, 80);
      });
      document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && _dayModalOpen) closeDayModal();
      });


      ["goalTrack", "goalPosts", "goalStreams", "goalNote"].forEach(id => {
        $(id).addEventListener("blur", () => {
          state.goals.track = els.goalTrack.textContent.trim();
          state.goals.posts = els.goalPosts.textContent.trim();
          state.goals.streams = els.goalStreams.textContent.trim();
          if (els.goalNote) state.goals.note = els.goalNote.textContent.trim();
          persist();
        });
      });

      els.itemList.addEventListener("click", onItemListClick);
      els.taskList.addEventListener("click", onTaskListClick);
      els.upcomingList.addEventListener("click", onUpcomingListClick);

      els.itemColorPicker.addEventListener('click', function(e) {
        var sw = e.target.closest('.color-swatch');
        if (!sw) return;
        els.itemColorPicker.querySelectorAll('.color-swatch').forEach(function(s){ s.classList.remove('active'); });
        sw.classList.add('active');
        selectedItemColor = sw.dataset.color || '';
      });

      // Auto-highlight legend item when type changes
      els.itemType.addEventListener('change', function() {
        highlightLegendType(els.itemType.value);
      });

      els.personBoards.addEventListener("click", onPersonBoardClick);
    }

    // ══════════════════════════════════════════════
    // ═══ DATE PICKER ENHANCEMENTS ═══
    // ══════════════════════════════════════════════
    var DAY_NAMES = ['Niedziela','Poniedziałek','Wtorek','Środa','Czwartek','Piątek','Sobota'];
    var DAY_SHORT = ['Ndz','Pon','Wt','Śr','Czw','Pt','Sob'];

    function updateDatePreview(inputId, previewId) {
      var input = $(inputId);
      var preview = $(previewId);
      if (!input || !preview) return;
      var val = input.value;
      if (!val) {
        preview.textContent = 'Wybierz datę';
        preview.classList.remove('has-date');
        return;
      }
      var d = new Date(val + 'T00:00:00');
      var now = new Date();
      var todayIso = toISODate(now);
      var diffDays = Math.round((d - new Date(todayIso + 'T00:00:00')) / 86400000);
      var dayName = DAY_SHORT[d.getDay()];
      var relative = '';
      if (diffDays === 0) relative = 'Dziś';
      else if (diffDays === 1) relative = 'Jutro';
      else if (diffDays === -1) relative = 'Wczoraj';
      else if (diffDays > 1 && diffDays <= 14) relative = 'Za ' + diffDays + ' dni';
      else if (diffDays < -1) relative = Math.abs(diffDays) + ' dni temu';
      preview.textContent = dayName + (relative ? ' · ' + relative : '');
      preview.classList.add('has-date');
    }

    // Quick date buttons
    document.addEventListener('click', function(e) {
      var btn = e.target.closest('.date-quick-btn');
      if (!btn) return;
      var targetId = btn.dataset.target;
      var offset = parseInt(btn.dataset.offset, 10);
      if (!targetId || isNaN(offset)) return;
      var d = new Date();
      d.setDate(d.getDate() + offset);
      var input = $(targetId);
      if (input) {
        input.value = toISODate(d);
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
      // Highlight the clicked button
      btn.parentElement.querySelectorAll('.date-quick-btn').forEach(function(b) { b.style.borderColor = ''; b.style.color = ''; b.style.background = ''; });
      btn.style.borderColor = 'rgba(247,183,51,.4)';
      btn.style.color = 'var(--accent)';
      btn.style.background = 'rgba(247,183,51,.1)';
    });

    // Listen for date input changes to update preview
    ['taskDue','itemDate'].forEach(function(id) {
      var el = $(id);
      if (!el) return;
      var previewId = id === 'taskDue' ? 'taskDuePreview' : 'itemDatePreview';
      el.addEventListener('change', function() { updateDatePreview(id, previewId); });
      el.addEventListener('input', function() { updateDatePreview(id, previewId); });
      // Initial render
      updateDatePreview(id, previewId);
    });

    function initAuth() {
      onAuthStateChanged(auth, (user) => {
        currentUser = user;

        if (dbUnsubscribe) { dbUnsubscribe(); dbUnsubscribe = null; }
        if (dbTasksUnsubscribe) { dbTasksUnsubscribe(); dbTasksUnsubscribe = null; }
        userTasksDbRef = null;

        if (user) {
          setAuthUI(true, user);
          // Jeśli blajetttp (blajetttp@gmail.com) — upewnij się że profil jest ustawiony
          if (user.email && user.email.toLowerCase() === 'blajetttp@gmail.com') {
            setTimeout(function() {
              var _aRef = ref(db, 'szaferPanel/profiles/' + user.uid);
              import('https://www.gstatic.com/firebasejs/11.0.0/firebase-database.js').then(function(mod) {
                mod.get(_aRef).then(function(snap) {
                  if (!snap.exists() || !snap.val().displayName) {
                    mod.set(_aRef, {
                      displayName: 'blajetttp',
                      avatar: '🎵',
                      mood: '',
                      note: '',
                      email: 'blajetttp@gmail.com',
                      updatedAt: Date.now()
                    });
                  }
                });
              });
            }, 800);
          }

          // ── Subscribe to SHARED data (items + goals) ──
          dbUnsubscribe = onValue(sharedRef, (snapshot) => {
            els.dbStatus.className = "chip ok";
            els.dbStatus.innerHTML = `<span class="dot"></span>Połączono`;
            if (_isSaving) return; // nie nadpisuj podczas aktywnego zapisu
            const remote = snapshot.val();
            const toArr = v => Array.isArray(v) ? v : (v && typeof v === "object" ? Object.values(v) : []);
            if (remote && typeof remote === "object") {
              state.goals = remote.goals || {};
              state.items = toArr(remote.items);
              const remoteTasks = toArr(remote.tasks);
              if (remoteTasks.length > 0 || state.tasks.length === 0) {
                state.tasks = remoteTasks;
              }
              normalizeState();
              saveLocal();
              renderAll();
            } else {
              normalizeState();
              persist(false);
            }
          }, (error) => {
            console.error(error);
            els.dbStatus.className = "chip err";
            els.dbStatus.innerHTML = `<span class="dot"></span>Błąd bazy`;
          });

          // ── Subscribe to USER-SPECIFIC tasks ──
          userTasksDbRef = ref(db, "szaferPanel/users/" + user.uid + "/tasks");
          // Zadania synchronizowane przez sharedRef (wspólne dla całego zespołu)

        } else {
          setAuthUI(false, null);
          els.dbStatus.className = "chip err";
          els.dbStatus.innerHTML = `<span class="dot"></span>Offline`;
          renderAll();
        }
      });
    }

    // ══════════════════════════════════════════════
    // ═══ AUTO-LOGOUT REMOVED (for push notifications) ═══
    // ══════════════════════════════════════════════
    // Auto-logout usunięty — sesja trwa nieograniczenie,
    // dzięki czemu powiadomienia push działają ciągle.
    function startAutoLogoutTimer() { /* disabled */ }
    function clearAutoLogoutTimer() { /* disabled */ }

    // ══════════════════════════════════════════════
    // ═══ iPHONE / PWA PUSH NOTIFICATIONS ═══
    // ══════════════════════════════════════════════
    var _pushPermissionGranted = false;
    var _pushEnabled = true; // user can toggle OFF even if permission is granted
    var _pushInitDone = false;

    function initPushNotifications() {
      if (_pushInitDone) return;
      _pushInitDone = true;
      if (!('Notification' in window)) {
        console.log('[Push] Notification API not supported in this browser');
        updatePushButtonUI();
        return;
      }
      // Only READ the current state — never auto-request (requires user gesture)
      _pushPermissionGranted = (Notification.permission === 'granted');
      console.log('[Push] Permission:', Notification.permission);
      updatePushButtonUI();
    }

    function requestNotificationPermission() {
      if (!('Notification' in window)) {
        showToast('⚠️ Ten przeglądarka nie obsługuje powiadomień. Na iPhonie dodaj stronę do ekranu głównego.');
        return;
      }
      if (Notification.permission === 'granted') {
        // Toggle ON/OFF bez zmiany uprawnień przeglądarki
        _pushEnabled = !_pushEnabled;
        _pushPermissionGranted = true;
        if (_pushEnabled) {
          showToast('🔔 Powiadomienia push włączone!');
        } else {
          showToast('🔕 Powiadomienia wyciszone — kliknij ponownie aby włączyć.');
        }
        updatePushButtonUI();
        return;
      }
      if (Notification.permission === 'denied') {
        showToast('🚫 Powiadomienia zablokowane — odblokuj w ustawieniach przeglądarki');
        updatePushButtonUI();
        return;
      }
      // Must be called from user gesture (click/tap)
      try {
        var result = Notification.requestPermission(function(perm) {
          // Callback fallback for older browsers
          _pushPermissionGranted = (perm === 'granted');
          updatePushButtonUI();
          if (_pushPermissionGranted) showToast('🔔 Powiadomienia push włączone!');
          else showToast('⚠️ Powiadomienia nie zostały włączone');
        });
        // Promise-based (modern browsers)
        if (result && result.then) {
          result.then(function(perm) {
            _pushPermissionGranted = (perm === 'granted');
            updatePushButtonUI();
            if (_pushPermissionGranted) showToast('🔔 Powiadomienia push włączone!');
            else if (perm === 'denied') showToast('🚫 Powiadomienia zablokowane przez przeglądarkę');
          });
        }
      } catch(e) {
        console.warn('[Push] requestPermission error:', e);
        showToast('⚠️ Błąd przy włączaniu powiadomień');
      }
    }

    function sendPushNotification(title, body, tag) {
      if (!_pushPermissionGranted || !_pushEnabled) return;
      if (document.visibilityState === 'visible' && document.hasFocus()) return;
      var options = {
        body: (body || '').substring(0, 200),
        tag: tag || 'szafer-' + Date.now(),
        renotify: true, requireInteraction: false, silent: false,
        icon: '/icon.svg'
      };
      // PRIORYTET 1: SW postMessage → showNotification (działa na iOS + Android)
      if (window._swRegistration && window._swRegistration.active) {
        try {
          window._swRegistration.active.postMessage({
            type: 'SHOW_NOTIFICATION',
            title: title || 'Szafer Panel',
            body: options.body, tag: options.tag
          });
          return;
        } catch(e) { console.warn('[Push] SW postMessage failed:', e); }
      }
      // PRIORYTET 2: serviceWorker.ready (async SW fallback)
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.ready.then(function(reg) {
          if (reg && reg.showNotification) {
            reg.showNotification(title || 'Szafer Panel', options);
          } else { _fallbackNotification(title, options); }
        }).catch(function() { _fallbackNotification(title, options); });
        return;
      }
      // PRIORYTET 3: direct Notification (desktop bez SW)
      _fallbackNotification(title, options);
    }
    function _fallbackNotification(title, options) {
      try {
        var notif = new Notification(title || 'Szafer Panel', options);
        notif.onclick = function() { window.focus(); notif.close(); };
        setTimeout(function() { try { notif.close(); } catch(e){} }, 10000);
      } catch(e) { console.warn('[Push] Notification error:', e); }
    }

    function updatePushButtonUI() {
      var btn = $('pushToggleBtn');
      var stateEl = document.getElementById('pushSwitchState');
      if (!btn) return;
      var supported = ('Notification' in window);
      btn.disabled = false;
      if (!supported) {
        btn.classList.remove('push-on', 'push-off');
        btn.classList.add('push-unsupported');
        btn.title = 'Ta przeglądarka nie obsługuje powiadomień push';
        btn.disabled = true;
        if (stateEl) stateEl.textContent = 'N/A';
      } else if (Notification.permission === 'granted' && _pushEnabled) {
        btn.classList.add('push-on');
        btn.classList.remove('push-off', 'push-unsupported');
        btn.title = 'Push aktywny — kliknij aby wyciszyć';
        if (stateEl) stateEl.textContent = 'ON';
      } else if (Notification.permission === 'granted' && !_pushEnabled) {
        btn.classList.remove('push-on', 'push-unsupported');
        btn.classList.add('push-off');
        btn.title = 'Push wyciszony — kliknij aby włączyć';
        if (stateEl) stateEl.textContent = 'OFF';
      } else if (Notification.permission === 'denied') {
        btn.classList.remove('push-on', 'push-unsupported');
        btn.classList.add('push-off');
        btn.title = 'Push zablokowany — odblokuj w ustawieniach przeglądarki';
        btn.disabled = true;
        if (stateEl) stateEl.textContent = 'BLK';
      } else {
        btn.classList.remove('push-on', 'push-unsupported');
        btn.classList.add('push-off');
        btn.title = 'Kliknij aby włączyć powiadomienia push';
        if (stateEl) stateEl.textContent = 'OFF';
      }
    }

    function setAuthUI(isLoggedIn, user) {
      // Hide loading spinner on first auth resolve
      var spinner = document.getElementById('authLoadingSpinner');
      if (spinner) spinner.style.display = 'none';
      els.authGate.classList.toggle("hidden", isLoggedIn);
      els.authReady.classList.toggle("hidden", !isLoggedIn);
      els.appShell.classList.toggle("hidden", !isLoggedIn);
      els.logoutBtn.classList.toggle("hidden", !isLoggedIn);
      // Toggle changelog button
      var clBtn = $("changelogOpenBtn");
      if (clBtn) clBtn.classList.toggle("hidden", !isLoggedIn);
      // Toggle notification bell
      var bellBtn = $("notifBellBtn");
      if (bellBtn) bellBtn.classList.toggle("hidden", !isLoggedIn);
      // Toggle push button
      var pushBtn = $("pushToggleBtn");
      if (pushBtn) {
        pushBtn.classList.toggle("hidden", !isLoggedIn);
        if (isLoggedIn && !pushBtn.__clickAttached) {
          pushBtn.addEventListener('click', function() {
            requestNotificationPermission();
          });
          pushBtn.__clickAttached = true;
        }
      }
      // Show/hide login modal
      var loginModal = $("loginModal");
      if (loginModal) {
        if (isLoggedIn) {
          loginModal.classList.add("hidden");
          // Safety: always restore scroll on login
          document.body.style.overflow = '';
          document.documentElement.style.overflow = '';
        } else {
          loginModal.classList.remove("hidden");
        }
      }

      if (isLoggedIn) {
        els.authStatus.className = "chip ok";
        els.authStatus.innerHTML = `<span class="dot"></span>Zalogowany`;
        els.userLabel.textContent = user.email || user.uid;
        els.currentUserEmail.textContent = user.email || user.uid;
        els.authMessage.textContent = "";
        // Init systems after login
        initPresence(user);
        initChat();
        initTeamPulse();
        initNotifBell();
        // Start DM unread tracking after a brief delay (wait for profile data)
        setTimeout(function() { initDmUnreadTracking(); }, 1500);
        // Start 12h deadline reminder checker
        startDeadlineChecker();
        // Init push notifications (replaces auto-logout)
        initPushNotifications();
        // Ensure tab + chat visibility is correct after login (no flicker)
        requestAnimationFrame(function() { switchTab('calendar'); });
      } else {
        els.authStatus.className = "chip err";
        els.authStatus.innerHTML = `<span class="dot"></span>Niezalogowany`;
        els.userLabel.textContent = "Zaloguj się";
        els.currentUserEmail.textContent = "—";
        _pushInitDone = false;
        _pushPermissionGranted = false;
        clearAutoLogoutTimer();
        stopDeadlineChecker();
        goOffline();
        // Always unlock scroll when logging out
        document.body.style.overflow = '';
        document.documentElement.style.overflow = '';
      }
    }

    async function handleLogin() {
      const email = els.loginEmail.value.trim();
      const password = els.loginPassword.value.trim();
      if (!email || !password) {
        els.authMessage.textContent = "Podaj email i hasło.";
        return;
      }
      try {
        const cred = await signInWithEmailAndPassword(auth, email, password);
        if (!cred.user.emailVerified) {
          await signOut(auth);
          const _em = email, _pw = password;
          els.authMessage.innerHTML = '<span style="color:#ffb020">⚠️ Zweryfikuj email przed logowaniem.</span><br>' +
            '<button id="resendVerBtn" style="margin-top:8px;padding:6px 14px;font-size:12px;border-radius:8px;border:1px solid rgba(255,255,255,.15);background:rgba(255,255,255,.07);color:#a8adc7;cursor:pointer">↩ Wyślij link ponownie</button>';
          setTimeout(() => {
            const btn = document.getElementById("resendVerBtn");
            if (btn) btn.addEventListener("click", async () => {
              try {
                const c2 = await signInWithEmailAndPassword(auth, _em, _pw);
                await sendEmailVerification(c2.user);
                await signOut(auth);
                els.authMessage.innerHTML = '<span style="color:#20c997">✉️ Link aktywacyjny wysłany ponownie!</span>';
              } catch (err) { els.authMessage.textContent = "Błąd: " + (err.code || err.message); }
            });
          }, 50);
          return;
        }
        els.authMessage.textContent = "";
      } catch (e) {
        els.authMessage.textContent = "Błąd logowania: " + (e.code || e.message);
      }
    }

    async function handleRegister() {
      const email = els.loginEmail.value.trim();
      const password = els.loginPassword.value.trim();
      if (!email || !password) {
        els.authMessage.textContent = "Podaj email i hasło.";
        return;
      }
      try {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        await sendEmailVerification(cred.user);
        await signOut(auth);
        els.authMessage.innerHTML = '<span style="color:#20c997">✉️ Konto założone! Wysłaliśmy link aktywacyjny na <strong>' + email + '</strong>. Kliknij go, a potem wróć i zaloguj się.</span>';
      } catch (e) {
        els.authMessage.textContent = "Błąd rejestracji: " + (e.code || e.message);
      }
    }

    function persist(sync = true) {
      normalizeState();
      saveLocal();
      renderAll();
      if (sync && currentUser) {
        // Save shared data (items + goals)
        _isSaving = true;
        set(sharedRef, {
          goals: state.goals,
          items: state.items,
          tasks: state.tasks,
          updatedAt: Date.now(),
          updatedBy: currentUser.email || currentUser.uid
        }).then(() => {
          // Keep _isSaving true a bit longer to absorb the echo onValue
          setTimeout(() => { _isSaving = false; }, 1200);
        }).catch(err => {
          _isSaving = false;
          console.error(err);
          els.dbStatus.className = "chip err";
          els.dbStatus.innerHTML = `<span class="dot"></span>Błąd zapisu`;
        });
        // Zadania są teraz zapisywane razem z sharedRef powyżej
      }
    }

    function saveItemFromForm() {
      if (!currentUser) return;

      const payload = {
        id: editingItemId || uid(),
        title: els.itemTitle.value.trim(),
        date: els.itemDate.value,
        type: els.itemType.value,
        status: els.itemStatus.value,
        owner: els.itemOwner.value,
        place: els.itemPlace.value.trim(),
        notes: els.itemNotes.value.trim(),
        color: selectedItemColor,
        mediaFiles: _selectedMediaFiles.slice(),
        createdBy: currentUser.email || currentUser.uid
      };

      if (!payload.title || !payload.date) {
        alert("Uzupełnij tytuł i datę wpisu.");
        return;
      }

      if (editingItemId) {
        state.items = state.items.map(item => item.id === editingItemId ? payload : item);
      } else {
        state.items.push(payload);
      }

      // FIX: Powiadomienie o nowym wpisie w kalendarzu
      if (!editingItemId) {
        var _myNameForNotif = _dmMyName ? _dmMyName() : (currentUser.email || '').split('@')[0];
        var _calNotifText = (payload.title || 'Nowy wpis') + (payload.date ? ' (' + payload.date + ')' : '') + (payload.type ? ' · ' + payload.type : '');
        addNotification({
          type: 'calendar',
          from: _myNameForNotif || 'Ekipa',
          text: _calNotifText,
          time: Date.now(),
          channel: 'calendar_' + payload.id
        });
        updateNotifBell();
      }
      cancelItemEdit(false);
      persist();
      switchTab("planning");
    }

    function saveTaskFromForm() {
      if (!currentUser) return;

      const payload = {
        id: editingTaskId || uid(),
        title: els.taskTitle.value.trim(),
        due: els.taskDue.value,
        status: els.taskStatus.value,
        owner: els.taskOwner.value,
        priority: els.taskPriority.value,
        notes: els.taskNotes.value.trim(),
        createdBy: currentUser.email || currentUser.uid
      };

      if (!payload.title || !payload.due) {
        alert("Uzupełnij tytuł i termin zadania.");
        return;
      }

      if (editingTaskId) {
        state.tasks = state.tasks.map(task => task.id === editingTaskId ? payload : task);
      } else {
        state.tasks.push(payload);
      }

      // Notification for new task
      if (!editingTaskId) {
        var _tn = typeof _dmMyName === 'function' ? _dmMyName() : (currentUser.email||'').split('@')[0];
        var _taskNotifText = (payload.title || 'Nowe zadanie') +
          (payload.due ? ' · termin: ' + payload.due : '') +
          (payload.owner ? ' · ' + payload.owner : '');
        addNotification({
          type: 'task',
          from: _tn || 'Ekipa',
          text: _taskNotifText,
          time: Date.now(),
          channel: 'task_' + payload.id,
          icon: '✅'
        });
        updateNotifBell();
      }

      cancelTaskEdit(false);
      persist();
      switchTab("tasks");
    }

    function cancelItemEdit(render = true) {
      editingItemId = null;
      els.itemTitle.value = "";
      els.itemDate.value = "";
      els.itemType.value = ITEM_TYPES[0];
      els.itemStatus.value = ITEM_STATUSES[0];
      els.itemOwner.value = PERSONS[0];
      var _customOpt = els.itemPlace.querySelector('[data-custom="true"]');
      if (_customOpt) _customOpt.remove();
      els.itemPlace.value = "";
      els.itemNotes.value = "";
      selectedItemColor = '';
      els.itemColorPicker.querySelectorAll('.color-swatch').forEach(function(s){ s.classList.remove('active'); });
      var defSw = els.itemColorPicker.querySelector('.swatch-default');
      if (defSw) defSw.classList.add('active');
      els.itemFormMode.textContent = "Tworzenie nowego wpisu do kalendarza";
      els.cancelItemEditBtn.classList.add("hidden");
      updateDatePreview('itemDate', 'itemDatePreview');
      if (render) renderAll();
    }

    function cancelTaskEdit(render = true) {
      editingTaskId = null;
      els.taskTitle.value = "";
      els.taskDue.value = "";
      els.taskStatus.value = TASK_STATUSES[0];
      els.taskOwner.value = PERSONS[0];
      els.taskPriority.value = "Średni";
      els.taskNotes.value = "";
      els.taskFormMode.textContent = "Tworzenie nowego taska";
      els.cancelTaskEditBtn.classList.add("hidden");
      updateDatePreview('taskDue', 'taskDuePreview');
      if (render) renderAll();
    }

    function editItem(id) {
      const item = state.items.find(x => x.id === id);
      if (!item) return;
      editingItemId = id;
      els.itemTitle.value = item.title;
      els.itemDate.value = item.date;
      els.itemType.value = item.type;
      els.itemStatus.value = item.status;
      els.itemOwner.value = item.owner;
      // Set place – add temp option if value doesn't match any select option
      (function() {
        var prev = els.itemPlace.querySelector('[data-custom="true"]');
        if (prev) prev.remove();
        els.itemPlace.value = item.place || "";
        if (item.place && els.itemPlace.value !== item.place) {
          var opt = document.createElement("option");
          opt.value = item.place; opt.textContent = "📌 " + item.place; opt.dataset.custom = "true";
          els.itemPlace.insertBefore(opt, els.itemPlace.options[1]);
          els.itemPlace.value = item.place;
        }
      })();
      els.itemNotes.value = item.notes;
      selectedItemColor = item.color || '';
      els.itemColorPicker.querySelectorAll('.color-swatch').forEach(function(s){
        s.classList.toggle('active', (s.dataset.color || '') === selectedItemColor);
      });
      els.itemFormMode.textContent = "Edycja wpisu";
      els.cancelItemEditBtn.classList.remove("hidden");
      updateDatePreview('itemDate', 'itemDatePreview');
      highlightLegendType(item.type);
      switchTab("planning");
      setTimeout(function() {
        var _f = document.getElementById('itemTitle');
        if (_f) { _f.scrollIntoView({ behavior: 'smooth', block: 'center' }); _f.focus(); }
      }, 80);
    }


    function spawnConfetti(x, y) {
      var colors = ['#f7b733','#fc4a1a','#20c997','#4ecdc4','#c471ed','#ff6b6b','#f9d976'];
      var wrap = document.createElement('div');
      wrap.className = 'confetti-wrap';
      document.body.appendChild(wrap);
      for (var i = 0; i < 20; i++) {
        var p = document.createElement('div');
        p.className = 'confetti-p';
        var spread = 80 + Math.random() * 180;
        var angle  = Math.random() * Math.PI * 2;
        p.style.left = (x + Math.cos(angle) * spread * Math.random()) + 'px';
        p.style.top  = (y - 10) + 'px';
        p.style.background = colors[Math.floor(Math.random() * colors.length)];
        p.style.width  = (5 + Math.random() * 7) + 'px';
        p.style.height = (5 + Math.random() * 7) + 'px';
        p.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';
        p.style.animationDuration = (.6 + Math.random() * .9) + 's';
        p.style.animationDelay = (Math.random() * .25) + 's';
        wrap.appendChild(p);
      }
      setTimeout(function() { if (wrap.parentNode) wrap.parentNode.removeChild(wrap); }, 2000);
    }

    function completeTask(id, fromModal) {
      var task = state.tasks.find(function(t) { return t.id === id; });
      if (!task) return;
      var newDone = !task.completed;
      task.completed = newDone;
      task.completedAt = newDone ? Date.now() : null;
      if (newDone) {
        task.completed_prev_status = task.status !== 'Zrobione' ? task.status : (task.completed_prev_status || 'Do zrobienia');
        task.status = 'Zrobione';
        var card = document.querySelector('.task-card[data-id="' + id + '"]');
        if (card) {
          var rect = card.getBoundingClientRect();
          spawnConfetti(rect.left + rect.width / 2, rect.top + rect.height / 2);
          card.classList.add('completing');
          var cbtn = card.querySelector('.btn-complete');
          if (cbtn) {
            cbtn.classList.add('just-done');
            setTimeout(function() { cbtn.classList.remove('just-done'); }, 600);
          }
          setTimeout(function() {
            card.classList.remove('completing');
            card.classList.add('task-done');
          }, 500);
        }
      } else {
        task.status = task.completed_prev_status || 'Do zrobienia';
        task.completed_prev_status = null;
        var card2 = document.querySelector('.task-card[data-id="' + id + '"]');
        if (card2) {
          card2.classList.remove('task-done');
          card2.classList.add('task-undone');
          setTimeout(function() { card2.classList.remove('task-undone'); }, 400);
        }
      }
      var delay = newDone ? 520 : 50;
      setTimeout(function() {
        persist();
        if (fromModal && typeof _currentModalIso !== 'undefined' && _currentModalIso) openDayModal(_currentModalIso);
      }, delay);
    }

    function completeItem(id) {
      var item = state.items.find(function(i) { return i.id === id; });
      if (!item) return;
      var newDone = !item.completed;
      item.completed = newDone;
      item.completedAt = newDone ? Date.now() : null;
      if (newDone) {
        var card = document.querySelector('.item-entry [data-action="complete-item"][data-id="' + id + '"]');
        if (card) {
          var entry = card.closest('.item-entry');
          if (entry) {
            var rect = entry.getBoundingClientRect();
            spawnConfetti(rect.left + rect.width / 2, rect.top + rect.height / 2);
          }
        }
      }
      setTimeout(function() { persist(); }, newDone ? 300 : 50);
    }

    function editTask(id) {
      const task = state.tasks.find(x => x.id === id);
      if (!task) return;
      editingTaskId = id;
      els.taskTitle.value = task.title;
      els.taskDue.value = task.due;
      els.taskStatus.value = task.status;
      els.taskOwner.value = task.owner;
      els.taskPriority.value = task.priority;
      els.taskNotes.value = task.notes;
      els.taskFormMode.textContent = "Edycja zadania";
      els.cancelTaskEditBtn.classList.remove("hidden");
      updateDatePreview('taskDue', 'taskDuePreview');
      switchTab("tasks");
      setTimeout(function() {
        var _f = document.getElementById('taskTitle');
        if (_f) { _f.scrollIntoView({ behavior: 'smooth', block: 'center' }); _f.focus(); }
      }, 80);
    }

    function removeItem(id) {
      if (!confirm("Usunąć ten wpis?")) return;
      state.items = state.items.filter(x => x.id !== id);
      if (editingItemId === id) cancelItemEdit(false);
      persist();
    }

    function removeTask(id) {
      if (!confirm("Usunąć to zadanie?")) return;
      state.tasks = state.tasks.filter(x => x.id !== id);
      if (editingTaskId === id) cancelTaskEdit(false);
      persist();
    }

    function onItemListClick(e) {
      var btn = e.target.closest('[data-action]');
      if (!btn) return;
      var action = btn.dataset.action;
      var id = btn.dataset.id;
      if (!action || !id) return;
      if (action === "edit-item") editItem(id);
      if (action === "delete-item") removeItem(id);
      if (action === "complete-item") completeItem(id);
    }

    function onUpcomingListClick(e) {
      var btn = e.target.closest('[data-action]');
      if (!btn) return;
      var action = btn.dataset.action;
      var id = btn.dataset.id;
      if (!action || !id) return;
      if (action === 'edit-item')    editItem(id);
      if (action === 'delete-item')  removeItem(id);
      if (action === 'complete-item') completeItem(id);
      if (action === 'edit-task')    editTask(id);
      if (action === 'delete-task')  removeTask(id);
      if (action === 'complete-task') completeTask(id, false);
    }
    function onTaskListClick(e) {
      var btn = e.target.closest('[data-action]');
      if (!btn) return;
      var action = btn.dataset.action;
      var id = btn.dataset.id;
      if (!action || !id) return;
      if (action === "edit-task")     editTask(id);
      if (action === "delete-task")   removeTask(id);
      if (action === "complete-task") completeTask(id, false);
    }

    function onPersonBoardClick(e) {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const action = btn.dataset.action;
      const id = btn.dataset.id;
      if (!action || !id) return;
      if (action === "edit-task") editTask(id);
      if (action === "edit-item") editItem(id);
    }

    function getChannelIcon(place) {
      if (!place) return '';
      var p = place.toLowerCase().split('/')[0].trim().split(' ')[0].trim();
      var icons = {
        'youtube':   '<svg class="channel-icon" viewBox="0 0 24 24" fill="#FF0000"><path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3 3 0 0 0 .5 6.2 31.2 31.2 0 0 0 0 12a31.2 31.2 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1A31.2 31.2 0 0 0 24 12a31.2 31.2 0 0 0-.5-5.8zM9.6 15.6V8.4l6.3 3.6-6.3 3.6z"/></svg>',
        'tiktok':    '<svg class="channel-icon" viewBox="0 0 24 24"><path fill="#fff" d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.77.39 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.34 6.34 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V9.31a8.16 8.16 0 0 0 4.77 1.52V7.38a4.84 4.84 0 0 1-1-.69z"/></svg>',
        'instagram': '<svg class="channel-icon" viewBox="0 0 24 24"><defs><linearGradient id="ig" x1="0%" y1="100%" x2="100%" y2="0%"><stop offset="0%" stop-color="#f09433"/><stop offset="50%" stop-color="#dc2743"/><stop offset="100%" stop-color="#bc1888"/></linearGradient></defs><path fill="url(#ig)" d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>',
        'facebook':  '<svg class="channel-icon" viewBox="0 0 24 24" fill="#1877F2"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>',
        'twitch':    '<svg class="channel-icon" viewBox="0 0 24 24" fill="#9146FF"><path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z"/></svg>',
        'discord':   '<svg class="channel-icon" viewBox="0 0 24 24" fill="#5865F2"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/></svg>',
        'spotify':   '<svg class="channel-icon" viewBox="0 0 24 24" fill="#1DB954"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/></svg>',
        'zoom':      '<svg class="channel-icon" viewBox="0 0 24 24" fill="#2D8CFF"><path d="M15.677 13.831l-3.396-2.667V9.5A1.5 1.5 0 0 0 10.781 8H3.5A1.5 1.5 0 0 0 2 9.5v5A1.5 1.5 0 0 0 3.5 16h7.281a1.5 1.5 0 0 0 1.5-1.5v-1.664l3.396-2.668v3.664L15.677 16V8l-.001 5.831z"/></svg>',
      };
      return icons[p] || '';
    }

    function renderGoalStats() {
      var monthStart = toISODate(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1));
      var monthEnd   = toISODate(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0));
      var monthItems    = state.items.filter(function(i){ return i.date >= monthStart && i.date <= monthEnd; });
      var monthMeetings = monthItems.filter(function(i){ return i.type === 'Spotkanie'; });
      var openTasks     = state.tasks.filter(function(t){ return t.status !== 'Zrobione'; });
      var doneTasks     = state.tasks.filter(function(t){ return t.status === 'Zrobione'; });
      var gs = document.getElementById('goalStats');
      if (!gs) return;
      gs.innerHTML =
        '<div class="goal-stat"><div class="gs-val">' + monthItems.length + '</div><div class="gs-label">Wpisów w miesiącu</div></div>' +
        '<div class="goal-stat"><div class="gs-val">' + monthMeetings.length + '</div><div class="gs-label">Spotkań</div></div>' +
        '<div class="goal-stat"><div class="gs-val">' + openTasks.length + '</div><div class="gs-label">Otwarte taski</div></div>' +
        '<div class="goal-stat"><div class="gs-val">' + doneTasks.length + '</div><div class="gs-label">Zrobione</div></div>';
    }

    // ═══ DAY MODAL ═══
    var _dayModalOpen = false;

    var _currentModalIso = null;
    function openDayModal(iso) {
      _dayModalOpen = true;
      _currentModalIso = iso;
      var d = new Date(iso + 'T00:00:00');
      var dayNames   = ['Niedziela','Poniedziałek','Wtorek','Środa','Czwartek','Piątek','Sobota'];
      var monthNames = ['Styczeń','Luty','Marzec','Kwiecień','Maj','Czerwiec','Lipiec','Sierpień','Wrzesień','Październik','Listopad','Grudzień'];
      var typeColors = {"Klip":"#f7b733","Rolka":"#4ecdc4","Post":"#c471ed","Story":"#f9d976","Backstage":"#43e97b","Spotkanie":"#dfe6e9","Sesja w Studio":"#a855f7","Sesja Zdjęciowa/Filmowa":"#f472b6"};
      var typeIcons  = {"Klip":"🎬","Rolka":"📱","Post":"🖼️","Story":"✨","Backstage":"🎥","Spotkanie":"📅","Sesja w Studio":"🎙️","Sesja Zdjęciowa/Filmowa":"📸"};
      $('dayModalTitle').textContent = dayNames[d.getDay()] + ', ' + d.getDate() + ' ' + monthNames[d.getMonth()] + ' ' + d.getFullYear();
      var items = state.items.filter(function(i){ return i.date === iso; });
      var tasks = state.tasks.filter(function(t){ return t.due === iso; });
      var totalCount = items.length + tasks.length;
      $('dayModalSub').textContent = totalCount === 0 ? 'Brak wpisów' : totalCount + ' wpis(y/ów)';
      var body = $('dayModalBody');
      var html = '';
      if (!totalCount) {
        html = '<div class="day-modal-empty"><span class="dme-icon">📭</span>Brak wpisów na ten dzień.<br>Dodaj coś klikając przycisk poniżej.</div>';
      } else {
        if (items.length) {
          html += '<div class="day-modal-section-label">📅 Wpisy kalendarza</div>';
          html += items.map(function(item) {
            var accent = item.color || typeColors[item.type] || '#a8adc7';
            var icon   = typeIcons[item.type] || '📌';
            return '<div class="dm-item dm-item-clickable" data-action="open-item" data-id="' + item.id + '" style="--dma:' + accent + '" title="Kliknij aby otworzyć wpis">' +
              '<div class="dm-item-title"><span>' + icon + '</span><span>' + escapeHtml(item.title) + '</span><span class="dm-item-goto">↗</span></div>' +
              '<div class="dm-item-meta">' +
                '<span class="item-type-pill" style="color:' + accent + ';border-color:' + accent + '44">' + escapeHtml(item.type) + '</span>' +
                '<span class="status ' + statusClass(item.status) + '"><span class="dot"></span>' + escapeHtml(item.status) + '</span>' +
                '<span class="task-owner-chip">' + escapeHtml(item.owner) + '</span>' +
                (item.place ? '<span class="item-place-text">' + getChannelIcon(item.place) + ' ' + escapeHtml(item.place) + '</span>' : '') +
                '<button class="btn-notify" data-action="notify-item" data-id="' + item.id + '" title="Dodaj do kalendarza telefonu">📲 Przypomnij</button>' +
              '</div>' +
              (item.notes ? '<div class="dm-item-notes">' + escapeHtml(item.notes) + '</div>' : '') +
              (item.mediaFiles && item.mediaFiles.length ? '<div class="dm-media-thumbs">' + renderMediaThumbs(item.mediaFiles, 6) + '</div>' : '') +
            '</div>';
          }).join('');
        }
        if (tasks.length) {
          html += '<div class="day-modal-section-label">✅ Zadania na ten dzień</div>';
          html += tasks.map(function(task) {
            var isDone = task.completed;
            var dmPColors = { "Wysoki":"#ff5d73","Średni":"#ffb020","Niski":"#20c997" };
            var dmPColor = isDone ? '' : (dmPColors[task.priority] || '#20c997');
            var dmPIcons = { "Wysoki":"🔴","Średni":"🟡","Niski":"🟢" };
            var dmPIcon  = dmPIcons[task.priority] || '⚪';
            return '<div class="dm-task-item dm-item-clickable' + (isDone ? ' dm-task-done' : '') + '" data-task-id="' + task.id + '" data-action="open-task" data-id="' + task.id + '"' + (dmPColor ? ' style="--dm-task-color:' + dmPColor + '"' : '') + ' title="Kliknij aby otworzyć zadanie">' +
              '<div>' +
                '<div class="dm-task-title">' + escapeHtml(task.title) + '</div>' +
                '<div class="dm-task-meta">👤 ' + escapeHtml(task.owner) + ' · ' + dmPIcon + ' ' + escapeHtml(task.priority) + (isDone ? ' · ✓ Ukończone' : '') + '</div>' +
              '</div>' +
              '<div style="display:flex;gap:6px;align-items:center">' +
                '<button class="btn-notify" data-action="notify-task" data-id="' + task.id + '" title="Dodaj do kalendarza telefonu">📲</button>' +
                '<button class="dm-task-complete-btn' + (isDone ? ' is-done' : '') + '" data-action="complete-task-modal" data-id="' + task.id + '">' +
                  (isDone ? '↩ Cofnij' : '✓ Gotowe') +
                '</button>' +
              '</div>' +
            '</div>';
          }).join('');
        }
      }
      body.innerHTML = html;
      body.querySelectorAll('[data-action="complete-task-modal"]').forEach(function(btn) {
        btn.addEventListener('click', function(e) { e.stopPropagation(); completeTask(this.dataset.id, true); });
      });
      body.querySelectorAll('[data-action="open-item"]').forEach(function(card) {
        card.addEventListener('click', function(e) {
          if (e.target.closest('button')) return;
          var id = this.dataset.id;
          closeDayModal();
          // Switch to planning tab and open item editor
          var planBtn = document.querySelector('[data-tab="tasks"]');
          if (planBtn) planBtn.click();
          setTimeout(function() { editItem(id); }, 300);
        });
      });
      body.querySelectorAll('[data-action="open-task"]').forEach(function(card) {
        card.addEventListener('click', function(e) {
          if (e.target.closest('button')) return;
          var id = this.dataset.id;
          closeDayModal();
          var tasksBtn = document.querySelector('[data-tab="tasks"]');
          if (tasksBtn) tasksBtn.click();
          setTimeout(function() { editTask(id); }, 300);
        });
      });
      $('dayModalAddBtn').dataset.iso = iso;
      $('dayModal').classList.remove('hidden');
      document.body.style.overflow = 'hidden';
    }

    function closeDayModal() {
      $('dayModal').classList.add('hidden');
      document.body.style.overflow = '';
      _dayModalOpen = false;
    }

    // Debounce renderAll to prevent excessive DOM updates
    var _renderAllTimer = null;
    function scheduleRender() {
      if (_renderAllTimer) return;
      _renderAllTimer = requestAnimationFrame(function() {
        _renderAllTimer = null;
        _renderAllImmediate();
      });
    }

    function _renderAllImmediate() {
      normalizeState();
      els.goalTrack.textContent = state.goals.track;
      els.goalPosts.textContent = state.goals.posts;
      els.goalStreams.textContent = state.goals.streams;
      if (els.goalNote) els.goalNote.textContent = state.goals.note || "";
      renderMetrics();
      renderCalendar();
      renderUpcoming();
      renderItems();
      renderTasks();
      renderPersonBoards();
      try { renderGoalStats(); } catch(e) {}
    }

    function renderAll() {
      _renderAllImmediate();
      // Re-check deadlines whenever data updates
      if (currentUser && typeof checkUpcomingDeadlines === 'function') {
        try { checkUpcomingDeadlines(); } catch(e) {}
      }
    }

    function renderMetrics() {
      els.metricMonth.textContent = prettyMonth(currentMonth);
      els.metricItems.textContent = state.items.length;
      els.metricTasks.textContent = state.tasks.filter(t => !t.completed && t.status !== "Zrobione").length;
      els.metricMeetings.textContent = state.items.filter(i => i.type === "Spotkanie").length;
    }

    function renderCalendar() {
      els.calendarMonthLabel.textContent = prettyMonth(currentMonth);
      const first = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
      const last = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
      const startOffset = (first.getDay() + 6) % 7;
      const gridStart = new Date(first);
      gridStart.setDate(first.getDate() - startOffset);

      const todayIso = toISODate(new Date());
      const itemsByDate = {};
      state.items.forEach(item => {
        if (!itemsByDate[item.date]) itemsByDate[item.date] = [];
        itemsByDate[item.date].push({ _type: 'item', data: item });
      });
      state.tasks.forEach(task => {
        if (!itemsByDate[task.due]) itemsByDate[task.due] = [];
        itemsByDate[task.due].push({ _type: 'task', data: task });
      });

      els.calendarDays.innerHTML = "";
      for (let i = 0; i < 42; i++) {
        const d = new Date(gridStart);
        d.setDate(gridStart.getDate() + i);
        const iso = toISODate(d);
        const cell = document.createElement("div");
        cell.className = "day";
        cell.dataset.iso = iso;
        if (d.getMonth() !== currentMonth.getMonth()) cell.classList.add("other");
        if (iso === todayIso) cell.classList.add("today");
        if (iso < todayIso) cell.classList.add("past");
        const allEntries = itemsByDate[iso] || [];
        if (allEntries.length > 0) cell.classList.add("has-items");

        const dayNum = document.createElement("div");
        dayNum.className = "day-num";
        dayNum.textContent = d.getDate();
        cell.appendChild(dayNum);

        const shown = allEntries.slice(0, 3);
        shown.forEach(entry => {
          const tag = document.createElement("span");
          if (entry._type === 'task') {
            const calPriorityColors = { "Wysoki":"#ff5d73","Średni":"#ffb020","Niski":"#20c997" };
            const calPColor = calPriorityColors[entry.data.priority] || "#20c997";
            tag.className = "mini-tag-task" + (entry.data.completed ? " task-done-cal" : "");
            tag.style.setProperty("--task-cal-color", calPColor);
            tag.textContent = "✓ " + entry.data.title;
          } else {
            var isItemDone = entry.data.completed;
            tag.className = "mini-tag " + tagClass(entry.data.type) + (isItemDone ? " item-done-cal" : "");
            if (!isItemDone && entry.data.color) { tag.style.background = entry.data.color; tag.style.color = '#120d05'; }
            tag.textContent = (isItemDone ? "✓ " : "") + entry.data.title;
          }
          cell.appendChild(tag);
        });

        if (allEntries.length > 3) {
          const more = document.createElement("span");
          more.className = "mini-tag";
          more.style.background = "rgba(255,255,255,.08)";
          more.style.color = "var(--text)";
          more.textContent = `+${allEntries.length - 3} więcej`;
          cell.appendChild(more);
        }
        els.calendarDays.appendChild(cell);
      }
    }

    function renderUpcoming() {
      var now = new Date();
      var nowIso = toISODate(now);
      var months = ["STY","LUT","MAR","KWI","MAJ","CZE","LIP","SIE","WRZ","PAŹ","LIS","GRU"];
      var typeColors = { "Klip":"#f7b733","Rolka":"#4ecdc4","Post":"#c471ed","Story":"#f9d976","Backstage":"#43e97b","Spotkanie":"#dfe6e9","Sesja w Studio":"#a855f7","Sesja Zdjęciowa/Filmowa":"#f472b6" };
      var typeIcons  = { "Klip":"🎬","Rolka":"📱","Post":"🖼️","Story":"✨","Backstage":"🎥","Spotkanie":"📅","Sesja w Studio":"🎙️","Sesja Zdjęciowa/Filmowa":"📸" };
      var priorityColors = { "Wysoki":"#ff5d73","Średni":"#ffb020","Niski":"#20c997" };
      var priorityIcons  = { "Wysoki":"🔴","Średni":"🟡","Niski":"🟢" };

      var upcomingItems = [...state.items]
        .filter(function(x){ return x.date >= nowIso && !x.completed; })
        .map(function(x){ return { kind: 'item', date: x.date, data: x }; });

      var upcomingTasks = [...state.tasks]
        .filter(function(x){ return x.due >= nowIso && !x.completed; })
        .map(function(x){ return { kind: 'task', date: x.due, data: x }; });

      var combined = [...upcomingItems, ...upcomingTasks]
        .sort(function(a,b){ return a.date.localeCompare(b.date); })
        .slice(0, 12);

      if (!combined.length) {
        els.upcomingList.innerHTML = '<div class="empty">Brak najbliższych wpisów i zadań.</div>';
        return;
      }

      els.upcomingList.innerHTML = combined.map(function(entry) {
        var d    = new Date(entry.date + 'T00:00:00');
        var diff = Math.round((d - now) / 86400000);
        var label = diff === 0 ? 'Dziś' : diff === 1 ? 'Jutro' : 'Za ' + diff + ' dni';
        var badgeClass = diff === 0 ? 'today-b' : diff <= 2 ? 'urgent' : '';

        if (entry.kind === 'item') {
          var item   = entry.data;
          var accent = item.color || typeColors[item.type] || '#a8adc7';
          var icon   = typeIcons[item.type] || '📌';
          return '<div class="upcoming-card" style="--card-accent:' + accent + '">' +
            '<div class="upcoming-date-box">' +
              '<div class="upcoming-day-num">' + d.getDate() + '</div>' +
              '<div class="upcoming-month-name">' + months[d.getMonth()] + '</div>' +
            '</div>' +
            '<div class="upcoming-body">' +
              '<div class="upcoming-entry-badge">📅 Wpis</div>' +
              '<div class="upcoming-title">' + escapeHtml(item.title) + '</div>' +
              '<div class="upcoming-meta-row">' +
                '<span class="upcoming-type-pill">' + icon + ' ' + escapeHtml(item.type) + '</span>' +
                (item.place ? '<span class="upcoming-place-text">' + getChannelIcon(item.place) + ' ' + escapeHtml(item.place) + '</span>' : '') +
              '</div>' +
              (item.notes ? '<div class="upcoming-notes-text">' + escapeHtml(item.notes.slice(0,80)) + (item.notes.length > 80 ? '…' : '') + '</div>' : '') +
            '</div>' +
            '<div class="upcoming-right">' +
              '<span class="status ' + statusClass(item.status) + '"><span class="dot"></span>' + escapeHtml(item.status) + '</span>' +
              '<span class="days-left-badge ' + badgeClass + '">' + label + '</span>' +
              '<div class="actions" style="margin-top:6px">' +
                '<button class="btn-notify" data-action="notify-item" data-id="' + item.id + '" title="Dodaj do kalendarza telefonu">📲</button>' +
                '<button class="small-btn" data-action="edit-item" data-id="' + item.id + '">✎</button>' +
                '<button class="small-btn" data-action="delete-item" data-id="' + item.id + '">×</button>' +
              '</div>' +
            '</div>' +
          '</div>';
        } else {
          var task   = entry.data;
          var pColor = priorityColors[task.priority] || '#a8adc7';
          var pIcon  = priorityIcons[task.priority] || '⚪';
          var glowColor = task.priority === 'Wysoki'
            ? 'rgba(255,93,115,.2)'
            : task.priority === 'Średni'
            ? 'rgba(255,176,32,.18)'
            : 'rgba(32,201,151,.14)';
          var glowSpeed = task.priority === 'Wysoki' ? '4.5s'
            : task.priority === 'Średni' ? '5.5s' : '7s';
          return '<div class="upcoming-card upcoming-task-card" style="--card-accent:' + pColor + ';--glow-color:' + glowColor + ';--glow-speed:' + glowSpeed + '">' +
            '<div class="upcoming-date-box upcoming-task-date-box">' +
              '<div class="upcoming-day-num">' + d.getDate() + '</div>' +
              '<div class="upcoming-month-name">' + months[d.getMonth()] + '</div>' +
            '</div>' +
            '<div class="upcoming-body">' +
              '<div class="upcoming-task-badge">☑️ Zadanie</div>' +
              '<div class="upcoming-title">' + escapeHtml(task.title) + '</div>' +
              '<div class="upcoming-meta-row">' +
                '<span class="upcoming-priority-pill" style="color:' + pColor + ';border-color:' + pColor + '44">' + pIcon + ' ' + escapeHtml(task.priority) + '</span>' +
                '<span class="upcoming-owner-chip">' + escapeHtml(task.owner) + '</span>' +
              '</div>' +
              (task.notes ? '<div class="upcoming-notes-text">' + escapeHtml(task.notes.slice(0,80)) + (task.notes.length > 80 ? '…' : '') + '</div>' : '') +
            '</div>' +
            '<div class="upcoming-right">' +
              '<span class="status ' + taskStatusClass(task.status) + '"><span class="dot"></span>' + escapeHtml(task.status) + '</span>' +
              '<span class="days-left-badge ' + badgeClass + '">' + label + '</span>' +
              '<div class="actions" style="margin-top:6px">' +
                '<button class="btn-notify" data-action="notify-task" data-id="' + task.id + '" title="Dodaj do kalendarza telefonu">📲</button>' +
                '<button class="small-btn" data-action="edit-task" data-id="' + task.id + '">✎</button>' +
                '<button class="small-btn" data-action="delete-task" data-id="' + task.id + '">×</button>' +
              '</div>' +
            '</div>' +
          '</div>';
        }
      }).join('');
      // update count badge
      var countEl = document.getElementById('upcomingCount');
      if (countEl) {
        var total = combined.length;
        countEl.textContent = total > 0 ? total + ' nadchodzących' : '';
        countEl.style.display = total > 0 ? '' : 'none';
      }
    }
    function renderItems() {
      var items = [...state.items].sort(function(a,b){
        if (a.completed !== b.completed) return a.completed ? 1 : -1;
        return a.date.localeCompare(b.date);
      });
      if (!items.length) {
        els.itemList.innerHTML = '<div class="empty">Brak wpisów w kalendarzu.</div>';
        return;
      }
      var typeColors = { "Klip":"#f7b733","Rolka":"#4ecdc4","Post":"#c471ed","Story":"#f9d976","Backstage":"#43e97b","Spotkanie":"#dfe6e9","Sesja w Studio":"#a855f7","Sesja Zdjęciowa/Filmowa":"#f472b6" };
      var typeIcons  = { "Klip":"🎬","Rolka":"📱","Post":"🖼️","Story":"✨","Backstage":"🎥","Spotkanie":"📅","Sesja w Studio":"🎙️","Sesja Zdjęciowa/Filmowa":"📸" };
      var months     = ["STY","LUT","MAR","KWI","MAJ","CZE","LIP","SIE","WRZ","PAŹ","LIS","GRU"];

      var total  = items.length;
      var active = items.filter(function(x){ return !x.completed; }).length;
      var done   = total - active;

      var countBar = '<div class="il-count-bar">' +
        '<span>' + total + ' wpisów łącznie</span>' +
        (done > 0 ? '<span style="color:#20c997">✓ ' + done + ' ukończonych</span>' : '') +
      '</div>';

      els.itemList.innerHTML = countBar + '<div class="il-list">' + items.map(function(item) {
        var d      = new Date(item.date + 'T00:00:00');
        var accent = item.color || typeColors[item.type] || '#a8adc7';
        var icon   = typeIcons[item.type] || '📌';
        var isDone = item.completed;
        var hasMedia = item.mediaFiles && item.mediaFiles.length;
        return '<div class="il-row' + (isDone ? ' il-done' : '') + '" style="--il-color:' + accent + '">' +
          '<div class="il-date">' +
            '<span class="il-day">' + d.getDate() + '</span>' +
            '<span class="il-mon">' + months[d.getMonth()] + '</span>' +
          '</div>' +
          '<div class="il-sep"></div>' +
          '<div class="il-body">' +
            '<span class="il-title">' + escapeHtml(item.title) + '</span>' +
            '<div class="il-chips">' +
              '<span class="il-chip il-chip-type">' + icon + ' ' + escapeHtml(item.type) + '</span>' +
              (item.place ? '<span class="il-chip">' + getChannelIcon(item.place) + ' ' + escapeHtml(item.place) + '</span>' : '') +
              '<span class="il-chip il-chip-owner">' + escapeHtml(item.owner) + '</span>' +
              (isDone ? '<span class="il-chip il-chip-done">✓ Gotowe</span>' : '') +
              (hasMedia ? '<span class="il-chip il-chip-media">📎 ' + item.mediaFiles.length + '</span>' : '') +
            '</div>' +
          '</div>' +
          '<div class="il-right">' +
            '<span class="status ' + statusClass(item.status) + '" style="font-size:10px;padding:2px 7px"><span class="dot"></span>' + escapeHtml(item.status) + '</span>' +
            '<div class="il-actions">' +
              '<button class="il-btn il-btn-check' + (isDone ? ' is-done' : '') + '" data-action="complete-item" data-id="' + item.id + '" title="' + (isDone ? 'Cofnij ukończenie' : 'Oznacz jako gotowe') + '">' + (isDone ? '↩' : '✓') + '</button>' +
              '<button class="il-btn" data-action="edit-item" data-id="' + item.id + '" title="Edytuj wpis">✎</button>' +
              '<button class="il-btn il-btn-del" data-action="delete-item" data-id="' + item.id + '" title="Usuń wpis">×</button>' +
            '</div>' +
          '</div>' +
        '</div>';
      }).join('') + '</div>';
    }

    function renderTasks() {
      var tasks = [...state.tasks].sort(function(a,b) {
        if (a.completed !== b.completed) return a.completed ? 1 : -1;
        if (a.status === b.status) return a.due.localeCompare(b.due);
        return a.status.localeCompare(b.status);
      });
      if (!tasks.length) { els.taskList.innerHTML = '<div class="empty">Brak zadań.</div>'; return; }
      var priorityColors = { "Wysoki":"#ff5d73","Średni":"#ffb020","Niski":"#20c997" };
      var priorityIcons  = { "Wysoki":"🔴","Średni":"🟡","Niski":"🟢" };
      els.taskList.innerHTML = tasks.map(function(task) {
        var isDone  = task.completed;
        var pColor  = isDone ? '#a8adc7' : (priorityColors[task.priority] || '#a8adc7');
        var pIcon   = priorityIcons[task.priority] || '⚪';
        var doneAt  = isDone && task.completedAt ? ' · ' + new Date(task.completedAt).toLocaleDateString('pl-PL') : '';
        return '<div class="task-card' + (isDone ? ' task-done' : '') + '" data-id="' + task.id + '" style="--task-color:' + pColor + '">' +
          '<div class="task-priority-badge">' + pIcon + '</div>' +
          '<div class="task-body">' +
            '<div class="task-title-row">' +
              '<span class="task-title-text">' + escapeHtml(task.title) + '</span>' +
              '<span class="task-priority-pill">' + escapeHtml(task.priority) + '</span>' +
              '<span class="task-done-stamp">✓ Ukończone' + escapeHtml(doneAt) + '</span>' +
            '</div>' +
            '<div class="task-due-text">📅 ' + escapeHtml(task.due) + ' · ' + escapeHtml(task.owner) + '</div>' +
            (task.notes ? '<div class="task-notes-text">' + escapeHtml(task.notes) + '</div>' : '') +
          '</div>' +
          '<div class="task-right">' +
            '<span class="status ' + taskStatusClass(task.status) + '"><span class="dot"></span>' + escapeHtml(task.status) + '</span>' +
            '<button class="btn-complete' + (isDone ? ' is-done' : '') + '" data-action="complete-task" data-id="' + task.id + '" title="' + (isDone ? 'Cofnij ukończenie' : 'Oznacz jako ukończone') + '">' +
              '<span class="check-icon">' + (isDone ? '↩' : '✓') + '</span>' +
              (isDone ? 'Cofnij' : 'Gotowe') +
            '</button>' +
            '<div class="task-actions">' +
              '<button class="btn-notify" data-action="notify-task" data-id="' + task.id + '" title="Dodaj do kalendarza telefonu">📲</button>' +
              '<button class="small-btn" data-action="edit-task" data-id="' + task.id + '">✎</button>' +
              '<button class="small-btn" data-action="delete-task" data-id="' + task.id + '">×</button>' +
            '</div>' +
          '</div>' +
        '</div>';
      }).join('');
    }

    function renderPersonBoards() {
      const today = toISODate(new Date());
      const priorityColors = { "Wysoki":"#ff5d73","Średni":"#ffb020","Niski":"#20c997" };
      const priorityIcons  = { "Wysoki":"🔴","Średni":"🟡","Niski":"🟢" };
      const typeColors = { "Klip":"#f7b733","Rolka":"#4ecdc4","Post":"#c471ed","Story":"#f9d976","Backstage":"#43e97b","Spotkanie":"#dfe6e9","Sesja w Studio":"#a855f7","Sesja Zdjęciowa/Filmowa":"#f472b6" };
      const typeIcons  = { "Klip":"🎬","Rolka":"📱","Post":"🖼️","Story":"✨","Backstage":"🎥","Spotkanie":"📅","Sesja w Studio":"🎙️","Sesja Zdjęciowa/Filmowa":"📸" };
      const months = ["STY","LUT","MAR","KWI","MAJ","CZE","LIP","SIE","WRZ","PAŹ","LIS","GRU"];
      const avatarColors = {
        "Szafer": "linear-gradient(135deg,#f7b733,#fc4a1a)",
        "blajetttp":   "linear-gradient(135deg,#4ecdc4,#1a9fd9)",
        "Skat":   "linear-gradient(135deg,#c471ed,#f64f59)"
      };

      els.personBoards.innerHTML = PERSONS.map(person => {
        const openTasks = state.tasks
          .filter(t => t.owner === person && !t.completed && t.status !== "Zrobione")
          .sort((a,b) => a.due.localeCompare(b.due));

        const activeItems = state.items
          .filter(i => i.owner === person && !i.completed && i.status !== "Opublikowane" && i.date >= today)
          .sort((a,b) => a.date.localeCompare(b.date))
          .slice(0, 5);

        const totalCount  = openTasks.length + activeItems.length;
        const avatarStyle = avatarColors[person] || "linear-gradient(135deg,#a8adc7,#6b7280)";

        const tasksHtml = openTasks.map(task => {
          const pColor = priorityColors[task.priority] || "#a8adc7";
          const pIcon  = priorityIcons[task.priority]  || "⚪";
          const d = new Date(task.due + "T00:00:00");
          const diff = Math.round((d - new Date()) / 86400000);
          const isOverdue = diff < 0;
          const dateLabel = diff === 0 ? "Dziś" : diff === 1 ? "Jutro"
            : isOverdue ? "⚠️ Termin minął"
            : months[d.getMonth()] + " " + d.getDate();
          const dateChipClass = isOverdue ? "pb-chip pb-chip-overdue" : "pb-chip";
          return `<div class="pb-task-chip" style="--pb-color:${pColor}">
            <div class="pb-task-chip-title" title="${escapeHtml(task.title)}">${escapeHtml(task.title)}</div>
            <div class="pb-task-chip-meta">
              <span class="pb-chip pb-chip-priority" style="color:${pColor};border-color:${pColor}44">${pIcon} ${escapeHtml(task.priority)}</span>
              <span class="${dateChipClass}">${dateLabel}</span>
            </div>
            <div style="display:flex;align-items:center;justify-content:space-between;gap:6px">
              <span class="pb-chip pb-chip-status">${escapeHtml(task.status)}</span>
              <button class="pb-task-chip-edit" data-action="edit-task" data-id="${task.id}" title="Edytuj">✎</button>
            </div>
          </div>`;
        }).join("");

        const itemsHtml = activeItems.map(item => {
          const iColor = item.color || typeColors[item.type] || "#a8adc7";
          const iIcon  = typeIcons[item.type] || "📌";
          const d = new Date(item.date + "T00:00:00");
          const diff = Math.round((d - new Date()) / 86400000);
          const dateLabel = diff === 0 ? "Dziś" : diff === 1 ? "Jutro"
            : months[d.getMonth()] + " " + d.getDate();
          return `<div class="pb-item pb-entry-item" style="--pb-color:${iColor}">
            <div class="pb-item-body">
              <div class="pb-item-title">${escapeHtml(item.title)}</div>
              <div class="pb-item-chips">
                <span class="pb-chip pb-chip-type" style="color:${iColor};border-color:${iColor}44">${iIcon} ${escapeHtml(item.type)}</span>
                <span class="pb-chip">📅 ${dateLabel}</span>
                ${item.place ? `<span class="pb-chip">${getChannelIcon(item.place)} ${escapeHtml(item.place)}</span>` : ""}
                <span class="pb-chip pb-chip-status">${escapeHtml(item.status)}</span>
              </div>
            </div>
            <button class="pb-edit-btn" data-action="edit-item" data-id="${item.id}" title="Edytuj wpis">✎</button>
          </div>`;
        }).join("");

        const taskCountLabel  = openTasks.length === 1 ? "zadanie" : openTasks.length < 5 ? "zadania" : "zadań";
        const itemCountLabel  = activeItems.length === 1 ? "wpis" : activeItems.length < 5 ? "wpisy" : "wpisów";
        const metaText = totalCount === 0
          ? "Wszystko gotowe ✓"
          : `${openTasks.length} ${taskCountLabel} · ${activeItems.length} ${itemCountLabel}`;

        return `<div class="pb-card">
          <div class="pb-card-header">
            <div class="pb-avatar" style="background:${avatarStyle}">${escapeHtml(person.slice(0,2).toUpperCase())}</div>
            <div class="pb-person-info">
              <div class="pb-person-name">${escapeHtml(person)}</div>
              <div class="pb-person-meta">${metaText}</div>
            </div>
            ${totalCount === 0
              ? `<span class="pb-all-done-badge">✓ Czysto</span>`
              : `<span class="pb-count-badge">${totalCount}</span>`}
          </div>
          ${totalCount === 0 ? `
            <div class="pb-empty-state">
              <div class="pb-empty-icon">🎉</div>
              <div class="pb-empty-text">Brak otwartych zadań i wpisów</div>
            </div>` : `
            <div class="pb-sections">
              ${openTasks.length ? `
                <div class="pb-section">
                  <div class="pb-section-label">☑️ Zadania (${openTasks.length})</div>
                  ${tasksHtml}
                </div>` : ""}
              ${activeItems.length ? `
                <div class="pb-section">
                  <div class="pb-section-label">📅 Wpisy w kalendarzu (${activeItems.length})</div>
                  ${itemsHtml}
                </div>` : ""}
            </div>`}
        </div>`;
      }).join("");
    }

    function seedDemo() {
      if (!confirm("Wczytać przykładowe dane demo? Nadpisze to bieżący stan.")) return;
      state = structuredClone(demoState);
      normalizeState();
      cancelItemEdit(false);
      cancelTaskEdit(false);
      persist();
    }

    function exportJson() {
      const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "szafer-panel-export.json";
      a.click();
      URL.revokeObjectURL(url);
    }

    function tagClass(type) {
      return {
        "Klip":"tag-klip",
        "Rolka":"tag-rolka",
        "Post":"tag-post",
        "Story":"tag-story",
        "Backstage":"tag-backstage",
        "Spotkanie":"tag-spotkanie",
        "Sesja w Studio":"tag-studio",
        "Sesja Zdjęciowa/Filmowa":"tag-sesja"
      }[type] || "tag-post";
    }

    var TYPE_LEGEND_NAMES = {
      "Klip":"🎬 Klip", "Rolka":"📱 Rolka", "Post":"🖼️ Post", "Story":"✨ Story",
      "Backstage":"🎥 Backstage", "Spotkanie":"📅 Spotkanie",
      "Sesja w Studio":"🎙️ Sesja w Studio", "Sesja Zdjęciowa/Filmowa":"📸 Sesja Zdjęciowa"
    };

    function highlightLegendType(type) {
      var legendItems = document.querySelectorAll('.type-legend-item');
      var needle = TYPE_LEGEND_NAMES[type] || '';
      legendItems.forEach(function(li) {
        var text = li.textContent.trim();
        var isMatch = needle && text === needle;
        li.style.background = isMatch ? 'rgba(247,183,51,.12)' : '';
        li.style.borderColor = isMatch ? 'rgba(247,183,51,.25)' : '';
        li.style.border = isMatch ? '1px solid rgba(247,183,51,.25)' : '';
        li.style.borderRadius = isMatch ? '10px' : '';
      });
    }

    function statusClass(status) {
      if (status === "Plan") return "s-plan";
      if (status === "W produkcji") return "s-prod";
      return "s-done";
    }

    function taskStatusClass(status) {
      if (status === "Do zrobienia") return "s-plan";
      if (status === "W toku") return "s-prod";
      return "s-done";
    }

    function switchTab(tab) {
      document.querySelectorAll(".tab").forEach(btn => btn.classList.toggle("active", btn.dataset.tab === tab));
      var currentPanel = document.querySelector('.tab-panel:not(.hidden)');
      var nextPanel = document.querySelector('.tab-panel[data-tab-panel="' + tab + '"]');

      if (!nextPanel || currentPanel === nextPanel) return;

      // Kill any in-progress transition on ALL panels — prevents stuck states
      document.querySelectorAll('.tab-panel').forEach(function(p) {
        p.classList.remove('tab-entering','tab-entering-reverse','tab-leaving','tab-leaving-reverse');
      });

      function showNext() {
        nextPanel.classList.remove('hidden');
        void nextPanel.offsetWidth; // force reflow before animation
        nextPanel.classList.add('tab-entering');
        var done = false;
        function clearEntry() {
          if (done) return; done = true;
          nextPanel.classList.remove('tab-entering','tab-entering-reverse');
        }
        nextPanel.addEventListener('animationend', clearEntry, { once: true });
        setTimeout(clearEntry, 440);
        if (tab === 'planning') { try { renderMediaAttachGrid(); } catch(e){} }
        if (tab === 'upload')   { try { initUpload(); } catch(e){} }
        if (tab === 'chat')     { try { initChat(); subscribeChatChannel(); } catch(e){} }
      }

      if (currentPanel) {
        currentPanel.classList.add('tab-leaving');
        var leftDone = false;
        function clearLeave() {
          if (leftDone) return; leftDone = true;
          currentPanel.classList.add('hidden');
          currentPanel.classList.remove('tab-leaving','tab-leaving-reverse');
          showNext();
        }
        currentPanel.addEventListener('animationend', clearLeave, { once: true });
        setTimeout(clearLeave, 230);
      } else {
        showNext();
      }
    }

    function escapeHtml(value) {
      return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
    }

    // ══════════════════════════════════════════════
    // ═══ ICS CALENDAR NOTIFICATION EXPORT ═══
    // ══════════════════════════════════════════════
    function generateICS(title, dateStr, notes, place, type) {
      var d = new Date(dateStr + 'T09:00:00');
      var end = new Date(d.getTime() + 60 * 60 * 1000); // 1h duration
      function pad(n) { return String(n).padStart(2,'0'); }
      function toICSDate(dt) {
        return dt.getFullYear() + pad(dt.getMonth()+1) + pad(dt.getDate()) + 'T' + pad(dt.getHours()) + pad(dt.getMinutes()) + '00';
      }
      var now = new Date();
      var alarm = 'BEGIN:VALARM\r\nTRIGGER:-PT30M\r\nACTION:DISPLAY\r\nDESCRIPTION:Przypomnienie: ' + title + '\r\nEND:VALARM\r\n';
      var alarm2 = 'BEGIN:VALARM\r\nTRIGGER:-PT120M\r\nACTION:DISPLAY\r\nDESCRIPTION:Za 2h: ' + title + '\r\nEND:VALARM\r\n';
      var ics = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//Szafer Panel//PL',
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH',
        'BEGIN:VEVENT',
        'DTSTART:' + toICSDate(d),
        'DTEND:' + toICSDate(end),
        'DTSTAMP:' + toICSDate(now),
        'UID:szafer-' + Date.now() + '@szaferpanel',
        'SUMMARY:' + (type ? '[' + type + '] ' : '') + title,
        'DESCRIPTION:' + (notes || 'Brak notatki') + (place ? '\\nKanał/miejsce: ' + place : ''),
        place ? 'LOCATION:' + place : '',
        alarm,
        alarm2,
        'END:VEVENT',
        'END:VCALENDAR'
      ].filter(Boolean).join('\r\n');

      var blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = 'szafer-' + dateStr + '-' + title.replace(/[^a-zA-Z0-9]/g,'_').slice(0,30) + '.ics';
      document.body.appendChild(a);
      a.click();
      setTimeout(function() { document.body.removeChild(a); URL.revokeObjectURL(url); }, 200);
    }

    function addItemToCalendar(id) {
      var item = state.items.find(function(i){ return i.id === id; });
      if (!item) return;
      generateICS(item.title, item.date, item.notes, item.place, item.type);
      showToast('📲 Pobrano plik .ics — otwórz go na telefonie aby dodać przypomnienie!');
    }

    function addTaskToCalendar(id) {
      var task = state.tasks.find(function(t){ return t.id === id; });
      if (!task) return;
      generateICS(task.title, task.due, task.notes, '', 'Zadanie');
      showToast('📲 Pobrano plik .ics — otwórz go na telefonie aby dodać przypomnienie!');
    }

    function showToast(msg) {
      var existing = document.querySelector('.sz-toast');
      if (existing) existing.remove();
      var toast = document.createElement('div');
      toast.className = 'sz-toast';
      toast.innerHTML = msg;
      document.body.appendChild(toast);
      requestAnimationFrame(function() { toast.classList.add('show'); });
      setTimeout(function() {
        toast.classList.remove('show');
        setTimeout(function() { if (toast.parentNode) toast.remove(); }, 400);
      }, 4000);
    }

    // Handle notification button clicks globally
    document.addEventListener('click', function(e) {
      var btn = e.target.closest('[data-action="notify-item"]');
      if (btn) { addItemToCalendar(btn.dataset.id); return; }
      var btn2 = e.target.closest('[data-action="notify-task"]');
      if (btn2) { addTaskToCalendar(btn2.dataset.id); return; }
    });


    // ══════════════════════════════════════════════
    // ═══ LIVE CHAT (Firebase) ═══
    // ══════════════════════════════════════════════
    var _chatChannel = 'general';
    var _chatIsDM = false;
    var _chatDMTarget = null;
    var _chatUnsub = null;
    var _chatInitialized = false;

    function initChat() {
      if (_chatInitialized) return;
      _chatInitialized = true;

      // Helper: stable identifier for DM keys — always use email prefix
      function myName() {
        if (!currentUser) return '';
        // Try profile displayName first for better matching
        var prof = _profileData[currentUser.uid];
        if (prof && prof.displayName) {
          var dn = prof.displayName.toLowerCase();
          for (var i = 0; i < PERSONS.length; i++) {
            if (dn === PERSONS[i].toLowerCase() || dn.includes(PERSONS[i].toLowerCase())) {
              return PERSONS[i].toLowerCase();
            }
          }
        }
        return (currentUser.email || '').split('@')[0].toLowerCase();
      }

      // Helper: build DM channel key (sorted so A↔B == B↔A)
      function dmKey(a, b) {
        return [a, b].sort().join('__');
      }

      // Channel / DM switching
      function activateChannel(el) {
        document.querySelectorAll('.chat-channel').forEach(function(c){ c.classList.remove('active'); });
        el.classList.add('active');
        var type = el.dataset.type || 'channel';
        var headerName = document.querySelector('.chat-main-channel-name');
        var headerDesc = document.querySelector('.chat-main-channel-desc');

        if (type === 'dm') {
          var target = el.dataset.dmTarget;
          _chatChannel = 'dm/' + dmKey(myName(), target);
          _chatIsDM = true;
          _chatDMTarget = target;
          // Resolve display name from profile data
          var _dmDisplayName = target.charAt(0).toUpperCase() + target.slice(1);
          var _dmProfs = Object.values(_profileData);
          for (var pi = 0; pi < _dmProfs.length; pi++) {
            var _dp = _dmProfs[pi];
            if (_dp && _dp.displayName) {
              var _dpEmail = (_dp.email || '').toLowerCase();
              var _dpResolved = resolvePersonFromEmail(_dpEmail);
              if (_dpResolved === target.toLowerCase()) {
                _dmDisplayName = _dp.displayName;
                break;
              }
            }
          }
          if (headerName) headerName.innerHTML = '🔒 <span style="color:var(--text)">@ ' + escapeHtml(_dmDisplayName) + '</span>';
          if (headerDesc) headerDesc.textContent = 'Prywatna rozmowa — widzi tylko wasza dwójka';
          // Mark DM as read
          if (typeof markDmAsRead === 'function') markDmAsRead(target);
          // Update input hints
          var chatInput = $('chatInput');
          var chatHint = document.querySelector('.chat-input-hint');
          if (chatInput) chatInput.placeholder = 'Napisz do ' + _dmDisplayName + '...';
          if (chatHint) chatHint.textContent = 'Enter aby wysłać · 🔒 Prywatna rozmowa';
        } else {
          _chatChannel = el.dataset.channel;
          _chatIsDM = false;
          _chatDMTarget = null;
          var names = { general:'# Ogólny', pomysly:'💡 Pomysły', feedback:'🎯 Feedback' };
          var descs  = { general:'Główny kanał komunikacji ekipy', pomysly:'Rzucajcie pomysłami na content', feedback:'Komentarze do gotowych materiałów' };
          if (headerName) headerName.textContent = names[_chatChannel] || '#' + _chatChannel;
          if (headerDesc) headerDesc.textContent = descs[_chatChannel] || '';
          // Restore input hints
          var chatInput = $('chatInput');
          var chatHint = document.querySelector('.chat-input-hint');
          if (chatInput) chatInput.placeholder = 'Napisz wiadomość do ekipy...';
          if (chatHint) chatHint.textContent = 'Enter aby wysłać · Wiadomości widzi cała ekipa';
        }
        subscribeChatChannel();
      }

      document.querySelectorAll('.chat-channel').forEach(function(ch) {
        ch.addEventListener('click', function() { activateChannel(ch); });
      });

      // Hide own DM entry from sidebar
      var me = myName();
      document.querySelectorAll('[data-dm-target]').forEach(function(el) {
        if (el.dataset.dmTarget.toLowerCase() === me) {
          el.style.display = 'none';
        }
      });

      // Send message
      var chatInput = $('chatInput');
      var chatSendBtn = $('chatSendBtn');
      function sendChatMessage() {
        if (!currentUser || !chatInput) return;
        var text = chatInput.value.trim();
        if (!text) return;
        chatInput.value = '';
        var path = 'szaferPanel/chat/' + _chatChannel;
        var msgId = 'msg_' + Date.now().toString(36) + Math.random().toString(36).slice(2,6);
        var msgRef = ref(db, path + '/' + msgId);
        var prof = _profileData[currentUser.uid] || {};
        var senderDisplay = prof.displayName || (currentUser.email || '').split('@')[0];
        set(msgRef, {
          id: msgId,
          text: text,
          sender: senderDisplay,
          senderEmail: currentUser.email || currentUser.uid,
          timestamp: Date.now()
        });
        // Auto-scroll to bottom after sending
        requestAnimationFrame(function() {
          var container = $('chatMessages');
          if (container) container.scrollTop = container.scrollHeight;
        });
        if (chatSendBtn) chatSendBtn.classList.add('disabled');
        chatInput.focus();
      }
      if (chatSendBtn) chatSendBtn.addEventListener('click', sendChatMessage);
      if (chatInput) chatInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChatMessage(); }
      });
      // Toggle send button disabled state based on input content
      if (chatInput && chatSendBtn) {
        chatSendBtn.classList.add('disabled');
        chatInput.addEventListener('input', function() {
          chatSendBtn.classList.toggle('disabled', !chatInput.value.trim());
        });
      }

      subscribeChatChannel();
      updateOnlineUsers();
    }

    var _chatLastMsgTimestamp = 0;

    function subscribeChatChannel() {
      if (_chatUnsub) { _chatUnsub(); _chatUnsub = null; }
      _chatLastMsgTimestamp = Date.now(); // Prevent stale push on channel load
      var chatRef = ref(db, 'szaferPanel/chat/' + _chatChannel);
      _chatUnsub = onValue(chatRef, function(snapshot) {
        var msgs = [];
        snapshot.forEach(function(child) {
          var m = child.val();
          if (m && m.text && m.timestamp) {
            msgs.push(Object.assign({}, m, { _firebaseKey: child.key, id: m.id || child.key }));
          }
        });
        msgs.sort(function(a,b){ return a.timestamp - b.timestamp; });

        // ── Push for NEW channel messages (not DMs — DM tracking handles those) ──
        if (!_chatIsDM && msgs.length > 0) {
          var lastMsg = msgs[msgs.length - 1];
          if (lastMsg.timestamp > _chatLastMsgTimestamp) {
            var myEmail = currentUser ? currentUser.email : '';
            var isFromMe = lastMsg.senderEmail && lastMsg.senderEmail === myEmail;
            if (!isFromMe) {
              var senderDisplay = lastMsg.sender || 'Ktoś';
              var _sp = Object.values(_profileData).find(function(p) {
                return p.email && p.email === lastMsg.senderEmail;
              });
              if (_sp && _sp.displayName) senderDisplay = _sp.displayName;
              sendPushNotification(
                '💬 ' + senderDisplay,
                (lastMsg.text || '').substring(0, 120),
                'chat_' + _chatChannel + '_' + lastMsg.timestamp
              );
            }
          }
        }
        // Always update timestamp marker
        if (msgs.length > 0) {
          _chatLastMsgTimestamp = Math.max(_chatLastMsgTimestamp, msgs[msgs.length - 1].timestamp);
        }

        renderChatMessages(msgs);
      });
    }

    function renderChatMessages(msgs) {
      var container = $('chatMessages');
      if (!container) return;
      if (!msgs.length) {
        var welcomeIcon  = _chatIsDM ? '🔒' : '🚀';
        var welcomeTitle = _chatIsDM ? 'Prywatna rozmowa' : 'Witaj w Team Chat!';
        var welcomeText  = _chatIsDM
          ? 'Tu widzicie tylko Wy dwoje. Napisz pierwszą wiadomość!'
          : 'To jest początek konwersacji ekipy. Napisz coś aby rozpocząć rozmowę.';
        container.innerHTML = '<div class="chat-empty-state">' +
          '<div class="chat-empty-icon">' + welcomeIcon + '</div>' +
          '<div class="chat-empty-title">' + welcomeTitle + '</div>' +
          '<div class="chat-empty-text">' + welcomeText + '</div></div>';
        return;
      }

      var _wasEmpty = container.children.length === 0 || container.querySelector('.chat-empty-state') !== null;
      var wasAtBottom = _wasEmpty || container.scrollTop + container.clientHeight >= container.scrollHeight - 60;
      var frag = document.createDocumentFragment();
      var lastDate = '';
      var prevSenderEmail = null;
      var prevTimestamp = 0;
      var GROUP_THRESHOLD = 5 * 60 * 1000; // 5 min — same sender within this = grouped

      msgs.forEach(function(msg, idx) {
        var d = new Date(msg.timestamp);
        var dateKey = d.toLocaleDateString('pl-PL');
        if (dateKey !== lastDate) {
          lastDate = dateKey;
          prevSenderEmail = null; // reset grouping on date change
          var divider = document.createElement('div');
          divider.className = 'chat-date-divider';
          // Show relative date labels
          var today = new Date();
          var yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
          var dateLabel = dateKey;
          if (dateKey === today.toLocaleDateString('pl-PL')) dateLabel = 'Dzisiaj';
          else if (dateKey === yesterday.toLocaleDateString('pl-PL')) dateLabel = 'Wczoraj';
          divider.innerHTML = '<span>' + dateLabel + '</span>';
          frag.appendChild(divider);
        }

        var senderName  = (msg.sender || '').split('@')[0];
        var senderLower = senderName.toLowerCase();
        var avatarClass = '', avatarLetter = senderName.charAt(0).toUpperCase();
        if      (senderLower.includes('blajetttp'))   { avatarClass = ' av-blajetttp'; avatarLetter = 'A'; }
        else if (senderLower.includes('skat'))   { avatarClass = ' av-skat'; avatarLetter = 'SK'; }
        else if (senderLower.includes('szafer')) { avatarLetter = 'S'; }

        // Use profile avatar/displayName if available
        var _sProf = Object.values(_profileData).find(function(p) {
          return (msg.senderEmail && p.email === msg.senderEmail) ||
                 (p.email || '').toLowerCase().split('@')[0] === senderLower;
        });
        if (_sProf && _sProf.avatar)      avatarLetter = _sProf.avatar;
        if (_sProf && _sProf.displayName) senderName   = _sProf.displayName;

        var timeStr  = pad2(d.getHours()) + ':' + pad2(d.getMinutes());
        var textHtml = escapeHtml(msg.text || '').replace(/(https?:\/\/[^\s]+)/g,
          '<a href="$1" target="_blank" rel="noopener">$1</a>');

        var myEmail = currentUser ? currentUser.email : '';
        var myProf  = currentUser ? (_profileData[currentUser.uid] || {}) : {};
        var myDisplayName = (myProf.displayName || (myEmail || '').split('@')[0] || '').toLowerCase();
        var isMine  = (msg.senderEmail && msg.senderEmail === myEmail) ||
                      myDisplayName === senderLower;

        // Message grouping — same sender within threshold
        var isGrouped = prevSenderEmail &&
                        prevSenderEmail === (msg.senderEmail || msg.sender) &&
                        (msg.timestamp - prevTimestamp) < GROUP_THRESHOLD;

        prevSenderEmail = msg.senderEmail || msg.sender;
        prevTimestamp = msg.timestamp;

        // Use Firebase key for reliable delete path
        var firebaseKey = msg._firebaseKey || msg.id || '';
        var msgPath = 'szaferPanel/chat/' + _chatChannel + '/' + firebaseKey;

        var msgEl = document.createElement('div');
        msgEl.className = 'chat-msg' + (isMine ? ' chat-msg-mine' : '') + (isGrouped ? ' chat-msg-grouped' : '');

        var avatarHtml = '<div class="chat-msg-avatar' + avatarClass + '">' + avatarLetter + '</div>';
        // Only own messages can be deleted (both channels and DMs)
        var canDelete = firebaseKey && isMine;
        var deleteBtn  = canDelete
          ? '<button class="chat-action-btn chat-delete-btn" title="Usuń wiadomość">🗑️</button>'
          : '';

        msgEl.innerHTML = avatarHtml +
          '<div class="chat-msg-body">' +
            '<div class="chat-msg-header">' +
              '<span class="chat-msg-name">' + escapeHtml(senderName) +
                (isMine ? ' <span class="chat-msg-you">Ty</span>' : '') +
              '</span>' +
              '<span class="chat-msg-time">' + timeStr + '</span>' +
              '<div class="chat-msg-actions">' + deleteBtn + '</div>' +
            '</div>' +
            '<div class="chat-msg-text">' + textHtml + '</div>' +
          '</div>';

        if (canDelete) {
          var delBtn = msgEl.querySelector('.chat-delete-btn');
          if (delBtn) {
            delBtn.addEventListener('click', function(e) {
              e.stopPropagation();
              if (!confirm('Usunąć tę wiadomość?')) return;
              set(ref(db, msgPath), null);
            });
          }
        }

        frag.appendChild(msgEl);
      });

      container.innerHTML = '';
      container.appendChild(frag);
      // Always scroll to bottom on new messages if user was already near bottom
      if (wasAtBottom) {
        requestAnimationFrame(function() {
          container.scrollTop = container.scrollHeight;
        });
      }
    }
    function pad2(n) { return String(n).padStart(2,'0'); }

    // ══════════════════════════════════════════════
    // ═══ REAL-TIME PRESENCE SYSTEM ═══
    // ══════════════════════════════════════════════
    var _presenceInitialized = false;
    var _presenceUnsub = null;
    var _heartbeatInterval = null;
    var _presenceData = {}; // { uid: { online, lastSeen, email } }
    var _personMoods = {};  // { "Szafer": "🔥", "blajetttp": "😎" }

    function initPresence(user) {
      if (!user) return;

      // Write own presence as online
      var myPresRef = ref(db, 'szaferPanel/presence/' + user.uid);
      var now = Date.now();
      set(myPresRef, {
        online: true,
        lastSeen: now,
        email: user.email || user.uid,
        loginAt: now
      });

      // On disconnect → mark offline automatically
      var disconnRef = onDisconnect(myPresRef);
      disconnRef.set({
        online: false,
        lastSeen: serverTimestamp(),
        email: user.email || user.uid,
        loginAt: null
      });

      // Heartbeat — update lastSeen every 45s so stale sessions don't stay green
      if (_heartbeatInterval) clearInterval(_heartbeatInterval);
      _heartbeatInterval = setInterval(function() {
        if (currentUser) {
          set(ref(db, 'szaferPanel/presence/' + currentUser.uid + '/lastSeen'), Date.now());
          set(ref(db, 'szaferPanel/presence/' + currentUser.uid + '/online'), true);
        }
      }, 45000);

      // Also update on tab focus (user coming back) / mark idle when hidden
      if (!_presenceInitialized) {
        document.addEventListener('visibilitychange', function() {
          if (!currentUser) return;
          var presPath = 'szaferPanel/presence/' + currentUser.uid;
          if (!document.hidden) {
            // Tab became visible — mark as online, update lastSeen
            set(ref(db, presPath + '/lastSeen'), Date.now());
            set(ref(db, presPath + '/online'), true);
          } else {
            // Tab became hidden — update lastSeen so stale check can work
            // Don't mark as offline yet, but stop lying about being active
            set(ref(db, presPath + '/lastSeen'), Date.now());
          }
        });
        // Handle page unload — try to mark offline explicitly
        window.addEventListener('beforeunload', function() {
          if (currentUser) {
            // Use sendBeacon to try marking offline synchronously
            try {
              var presPath = 'szaferPanel/presence/' + currentUser.uid;
              set(ref(db, presPath + '/online'), false);
              set(ref(db, presPath + '/lastSeen'), Date.now());
            } catch(e) {}
            // onDisconnect handler is the real safety net
          }
        });
      }

      // Subscribe to all presence data
      if (!_presenceInitialized) {
        subscribePresence();
      }
      _presenceInitialized = true;
    }

    function goOffline() {
      if (_heartbeatInterval) { clearInterval(_heartbeatInterval); _heartbeatInterval = null; }
      // If we still have a user ref, mark offline explicitly
      if (currentUser) {
        var myPresRef = ref(db, 'szaferPanel/presence/' + currentUser.uid);
        set(myPresRef, {
          online: false,
          lastSeen: Date.now(),
          email: currentUser.email || currentUser.uid,
          loginAt: null
        });
      }
    }

    function subscribePresence() {
      var presenceRef = ref(db, 'szaferPanel/presence');
      _presenceUnsub = onValue(presenceRef, function(snapshot) {
        var data = snapshot.val();
        _presenceData = {};
        if (data && typeof data === 'object') {
          Object.keys(data).forEach(function(uid) {
            var p = data[uid];
            if (p && p.email) {
              _presenceData[uid] = {
                online: !!p.online,
                lastSeen: p.lastSeen || 0,
                email: p.email,
                loginAt: p.loginAt || null
              };
              // Mark as offline if heartbeat is stale (>75 seconds = 1.67x heartbeat)
              if (p.online && p.lastSeen && (Date.now() - p.lastSeen > 75000)) {
                _presenceData[uid].online = false;
              }
            }
          });
        }
        renderPresenceUI();
      });

      // Periodic stale checker — re-evaluate every 30s even if Firebase data didn't change
      if (!window._presenceStaleInterval) {
        window._presenceStaleInterval = setInterval(function() {
          var changed = false;
          Object.keys(_presenceData).forEach(function(uid) {
            var p = _presenceData[uid];
            if (p.online && p.lastSeen && (Date.now() - p.lastSeen > 75000)) {
              p.online = false;
              changed = true;
            }
          });
          if (changed) renderPresenceUI();
        }, 30000);
      }
    }

    function renderPresenceUI() {
      // Build a map: person name → presence info
      var personPresence = {};
      PERSONS.forEach(function(p) { personPresence[p] = { online: false, lastSeen: 0, email: '' }; });

      Object.values(_presenceData).forEach(function(pres) {
        var email = (pres.email || '').toLowerCase().split('@')[0];
        PERSONS.forEach(function(person) {
          var pLower = person.toLowerCase();
          // Match exactly or as prefix — avoid partial matches like "a" inside "blajetttp"
          if (email === pLower || email.startsWith(pLower) || email.includes(pLower)) {
            // Only overwrite if this entry is more recent or currently online
            var existing = personPresence[person];
            if (pres.online || !existing.online) {
              personPresence[person] = pres;
            }
          }
        });
      });

      // ─── Update Team Pulse person cards ───
      PERSONS.forEach(function(person) {
        var statusEl = $('tpStatus' + person);
        if (!statusEl) return;
        var pres = personPresence[person];
        var mood = _personMoods[person] || '';
        var moodHtml = mood ? '<span style="font-size:14px;margin-right:2px">' + mood + '</span> ' : '';
        if (pres.online) {
          var loginInfo = pres.loginAt ? '<div class="tp-lastseen-detail">🟢 Zalogowany od ' + prettyLastSeen(pres.loginAt).replace(' temu','') + '</div>' : '';
          statusEl.innerHTML = '<div class="tp-status-line">' + moodHtml + '<span class="dot ok"></span><span class="presence-label">Online</span></div>' + loginInfo;
          statusEl.closest('.tp-person').classList.add('tp-online');
          statusEl.closest('.tp-person').classList.remove('tp-offline');
        } else {
          var lastSeenText = pres.lastSeen ? prettyLastSeen(pres.lastSeen) : '';
          statusEl.innerHTML = '<div class="tp-status-line">' + moodHtml +
            '<span class="dot offline-dot"></span><span class="presence-label">Offline</span></div>' +
            (lastSeenText ? '<div class="tp-lastseen-detail">🕐 Ostatnio: ' + lastSeenText + '</div>' : '<div class="tp-lastseen-detail">Nigdy się nie logował</div>');
          statusEl.closest('.tp-person').classList.remove('tp-online');
          statusEl.closest('.tp-person').classList.add('tp-offline');
        }
      });

      // ─── Update Chat sidebar online list ───
      var chatEl = $('chatOnlineUsers');
      if (chatEl) {
        var onlineHTML = '';
        var offlineHTML = '';
        PERSONS.forEach(function(p) {
          var pres = personPresence[p];
          if (pres.online) {
            onlineHTML += '<div class="chat-online-user">' +
              '<span class="chat-online-dot"></span>' +
              '<span>' + escapeHtml(p) + '</span>' +
              '<span class="chat-online-badge">online</span>' +
            '</div>';
          } else {
            var lastSeenShort = pres.lastSeen ? prettyLastSeen(pres.lastSeen) : '';
            offlineHTML += '<div class="chat-online-user chat-user-offline">' +
              '<span class="chat-online-dot offline"></span>' +
              '<span>' + escapeHtml(p) + '</span>' +
              (lastSeenShort ? '<span class="chat-offline-ago" title="' + escapeHtml(lastSeenShort) + '">' + getTimeAgo(pres.lastSeen) + '</span>' : '') +
            '</div>';
          }
        });

        // Also show any non-PERSONS users that are online
        Object.values(_presenceData).forEach(function(pres) {
          if (!pres.online) return;
          var email = (pres.email || '').toLowerCase().split('@')[0];
          var isKnown = PERSONS.some(function(p) { return email.includes(p.toLowerCase()); });
          if (!isKnown && pres.email) {
            onlineHTML += '<div class="chat-online-user">' +
              '<span class="chat-online-dot"></span>' +
              '<span>' + escapeHtml(pres.email.split('@')[0]) + '</span>' +
              '<span class="chat-online-badge">online</span>' +
            '</div>';
          }
        });

        chatEl.innerHTML = onlineHTML + offlineHTML;
      }

      // ─── Update topbar chip with online count ───
      var onlineCount = Object.values(_presenceData).filter(function(p){ return p.online; }).length;
      var topChip = $('onlineCountChip');
      if (topChip) {
        topChip.innerHTML = '<span class="dot ' + (onlineCount > 0 ? 'ok' : '') + '"></span>' + onlineCount + ' online';
      }

      // ─── Update DM sidebar dots ───
      PERSONS.forEach(function(person) {
        var pLower = person.toLowerCase();
        var dotEl = $('dmDot_' + pLower);
        if (dotEl) {
          var pres = personPresence[person];
          if (pres && pres.online) {
            dotEl.classList.add('online');
          } else {
            dotEl.classList.remove('online');
          }
        }
      });
    }

    // Backward compat — old calls still work
    function updateOnlineUsers() { /* handled by renderPresenceUI now */ }


    // ══════════════════════════════════════════════
    // ═══ DM UNREAD TRACKING + NOTIFICATION BELL ═══
    // ══════════════════════════════════════════════
    var _dmUnreadCounts = {}; // { "szafer":3, "blajetttp":1 }
    var _dmBgListeners = [];
    var _notifItems = [];    // Array of { type, from, text, time, channel }
    var _notifBellInitialized = false;
    var _lastSeenTimestamps = {}; // { channelKey: lastSeenTimestamp }

    // Global helpers (same logic as inside initChat)
    function _dmMyName() {
      if (!currentUser) return '';
      // Najpierw sprawdź EMAIL_TO_PERSON (np. blajetttp@gmail.com → adam)
      var byEmail = resolvePersonFromEmail(currentUser.email || '');
      if (byEmail) return byEmail;
      // Try profile displayName first, then email prefix
      var prof = _profileData[currentUser.uid];
      if (prof && prof.displayName) {
        var dn = prof.displayName.toLowerCase();
        // Check if displayName matches a known person
        for (var i = 0; i < PERSONS.length; i++) {
          if (dn === PERSONS[i].toLowerCase() || dn.includes(PERSONS[i].toLowerCase())) {
            return PERSONS[i].toLowerCase();
          }
        }
      }
      return (currentUser.email || '').split('@')[0].toLowerCase();
    }
    function _dmKeyGlobal(a, b) {
      return [a, b].sort().join('__');
    }

    function initDmUnreadTracking() {
      // Clean up old listeners
      _dmBgListeners.forEach(function(unsub) { if (unsub) unsub(); });
      _dmBgListeners = [];
      _dmUnreadCounts = {};

      var me = _dmMyName();
      if (!me) return;

      // Load last-seen timestamps from localStorage
      try {
        var saved = localStorage.getItem('szafer_dm_lastseen_' + me);
        if (saved) _lastSeenTimestamps = JSON.parse(saved);
      } catch(e) { _lastSeenTimestamps = {}; }

      PERSONS.forEach(function(person) {
        var pLower = person.toLowerCase();
        if (pLower === me) return; // Don't track DM to self

        var channelKey = 'dm/' + _dmKeyGlobal(me, pLower);
        var chatRef = ref(db, 'szaferPanel/chat/' + channelKey);
        var lastSeen = _lastSeenTimestamps[channelKey] || 0;

        var unsub = onValue(chatRef, function(snapshot) {
          var count = 0;
          var latestMsg = null;
          var myEmail = currentUser ? (currentUser.email || '').toLowerCase() : '';
          snapshot.forEach(function(child) {
            var m = child.val();
            if (!m || !m.text || !m.timestamp) return;
            // Count messages from OTHER person that are newer than lastSeen
            // Use email match first (reliable), then fallback to name match
            var senderEmail = (m.senderEmail || '').toLowerCase();
            var senderName = (m.sender || '').toLowerCase();
            var isFromMe = (senderEmail && senderEmail === myEmail) ||
                           senderName === me ||
                           resolvePersonFromEmail(senderEmail) === me;
            if (!isFromMe && m.timestamp > lastSeen) {
              count++;
              latestMsg = m;
            }
          });

          _dmUnreadCounts[pLower] = count;
          renderDmUnreadBadges();
          updateNotifBell();

          // Add to notification list if there's a new message
          if (latestMsg && count > 0) {
            addNotification({
              type: 'dm',
              from: person,
              text: latestMsg.text,
              time: latestMsg.timestamp,
              channel: channelKey
            });
          }
        });
        _dmBgListeners.push(unsub);
      });
    }

    function markDmAsRead(target) {
      var me = _dmMyName();
      if (!me) return;
      var channelKey = 'dm/' + _dmKeyGlobal(me, target.toLowerCase());
      _lastSeenTimestamps[channelKey] = Date.now();
      _dmUnreadCounts[target.toLowerCase()] = 0;
      try {
        localStorage.setItem('szafer_dm_lastseen_' + me, JSON.stringify(_lastSeenTimestamps));
      } catch(e) {}
      renderDmUnreadBadges();
      updateNotifBell();
    }

    function renderDmUnreadBadges() {
      PERSONS.forEach(function(person) {
        var pLower = person.toLowerCase();
        var channelEl = document.querySelector('[data-dm-target="' + pLower + '"]');
        if (!channelEl) return;
        var count = _dmUnreadCounts[pLower] || 0;
        // Remove existing badge
        var existing = channelEl.querySelector('.chat-dm-unread');
        if (existing) existing.remove();
        channelEl.classList.toggle('has-unread', count > 0);

        if (count > 0) {
          var badge = document.createElement('span');
          badge.className = 'chat-dm-unread';
          badge.textContent = count > 99 ? '99+' : count;
          channelEl.appendChild(badge);
        }
      });
    }

    // ── Notification Bell ──
    var NOTIF_STORAGE_KEY = 'szafer_notif_items';

    // Load saved notifications from localStorage
    (function _loadNotifs() {
      try {
        var saved = localStorage.getItem(NOTIF_STORAGE_KEY);
        if (saved) {
          var parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) _notifItems = parsed;
        }
      } catch(e) {}
    })();

    function _saveNotifs() {
      try {
        localStorage.setItem(NOTIF_STORAGE_KEY, JSON.stringify(_notifItems.slice(0, 80)));
      } catch(e) {}
    }

    function addNotification(item) {
      // Avoid duplicates (same channel + close timestamp)
      var isDup = _notifItems.some(function(n) {
        return n.channel === item.channel && Math.abs(n.time - item.time) < 2000;
      });
      if (isDup) return;

      // Auto-assign icon na podstawie typu
      if (!item.icon) {
        var iconMap = { dm: '💬', channel: '📢', calendar: '📅', task: '✅', system: '⚙️' };
        item.icon = iconMap[item.type] || '🔔';
      }
      if (!item.type) item.type = 'channel';

      _notifItems.unshift(item);
      // Keep max 80 notifications for history
      if (_notifItems.length > 80) _notifItems = _notifItems.slice(0, 80);
      _saveNotifs();
      updateNotifBell();

      // ── Push notification (only for notifications FROM others) ──
      // Skip push if this was triggered by own action (calendar/task creation by self)
      var _myNameNow = typeof _dmMyName === 'function' ? _dmMyName() : '';
      var isOwnAction = item.from && _myNameNow &&
        item.from.toLowerCase() === _myNameNow.toLowerCase();
      if (!isOwnAction) {
        var pushTitle = 'Szafer Panel';
        if (item.type === 'dm') pushTitle = '💬 ' + (item.from || 'Wiadomość');
        else if (item.type === 'task') pushTitle = '✅ ' + (item.from || 'Zadanie');
        else if (item.type === 'calendar') pushTitle = '📅 ' + (item.from || 'Kalendarz');
        sendPushNotification(pushTitle, item.text || '', item.channel);
      }
    }

    function updateNotifBell() {
      var bellBtn = $('notifBellBtn');
      if (!bellBtn) return;
      // Licz nieprzeczytane DM + nieprzeczytane powiadomienia
      var dmUnread = 0;
      Object.values(_dmUnreadCounts).forEach(function(c) { dmUnread += c; });
      var notifUnread = _notifItems.filter(function(n) { return !n.read; }).length;
      var totalUnread = dmUnread + notifUnread;

      var existingCount = bellBtn.querySelector('.notif-bell-count');
      if (existingCount) existingCount.remove();

      if (totalUnread > 0) {
        bellBtn.classList.add('has-notif');
        var badge = document.createElement('span');
        badge.className = 'notif-bell-count';
        badge.textContent = totalUnread > 99 ? '99+' : totalUnread;
        bellBtn.appendChild(badge);
      } else {
        bellBtn.classList.remove('has-notif');
      }
    }


    function renderNotifDropdown() {
      var dropdown = $('notifDropdown');
      if (!dropdown) return;

      var unreadCount = _notifItems.filter(function(n) { return !n.read; }).length;
      var hasItems = _notifItems.length > 0;

      // Filtrowanie po typie
      var _activeFilter = dropdown.__activeFilter || 'all';
      var filtered = _activeFilter === 'all' ? _notifItems :
        _notifItems.filter(function(n) { return n.type === _activeFilter; });

      var typeLabels = { all: '🔔 Wszystkie', dm: '💬 Czat', calendar: '📅 Kalendarz', task: '✅ Zadania' };
      var filterBtns = Object.keys(typeLabels).map(function(k) {
        return '<button class="notif-filter-btn' + (_activeFilter === k ? ' active' : '') + '" data-filter="' + k + '">' + typeLabels[k] + '</button>';
      }).join('');

      var html = '<div class="notif-dd-header">' +
        '<div class="notif-dd-title">🔔 Powiadomienia' + (unreadCount > 0 ? ' <span class="notif-dd-unread-badge">' + unreadCount + '</span>' : '') + '</div>' +
        (unreadCount > 0 ? '<button class="notif-dd-mark-all" id="notifMarkAllRead">✓ Odznacz wszystkie</button>' : '') +
      '</div>';

      // Push notification permission banner
      if ('Notification' in window && Notification.permission === 'default') {
        html += '<div class="notif-push-banner" style="padding:8px 12px;background:rgba(247,183,51,.06);border-bottom:1px solid rgba(247,183,51,.15);display:flex;align-items:center;gap:8px;font-size:11px;color:var(--muted)">' +
          '<span style="font-size:16px">📱</span>' +
          '<span style="flex:1">Włącz powiadomienia push na iPhonie i komputerze</span>' +
          '<button id="notifPushEnableBtn" style="padding:4px 10px;border-radius:999px;border:1px solid rgba(247,183,51,.3);background:rgba(247,183,51,.12);color:var(--accent);font-size:10px;font-weight:700;cursor:pointer;white-space:nowrap">Włącz</button>' +
        '</div>';
      } else if ('Notification' in window && Notification.permission === 'granted' && _pushEnabled) {
        html += '<div style="padding:4px 12px;background:rgba(32,201,151,.04);border-bottom:1px solid rgba(32,201,151,.1);display:flex;align-items:center;gap:6px;font-size:10px;color:#20c997;font-weight:700">' +
          '<span>✅</span> Push aktywne' +
        '</div>';
      } else if ('Notification' in window && Notification.permission === 'granted' && !_pushEnabled) {
        html += '<div style="padding:4px 12px;background:rgba(168,173,199,.05);border-bottom:1px solid rgba(168,173,199,.12);display:flex;align-items:center;gap:6px;font-size:10px;color:var(--muted);font-weight:700">' +
          '<span>🔕</span> Push wyciszony — kliknij przełącznik aby włączyć' +
        '</div>';
      }

      html += '<div class="notif-dd-filters">' + filterBtns + '</div>' +
      '<div class="notif-dd-body">';

      if (!filtered.length) {
        html += '<div class="notif-dd-empty">' +
          '<div class="notif-dd-empty-icon">' + (hasItems ? '🔍' : '🔕') + '</div>' +
          (hasItems ? 'Brak w tej kategorii' : 'Brak powiadomień') +
        '</div>';
      } else {
        filtered.forEach(function(item) {
          var realIdx = _notifItems.indexOf(item);
          var icon = item.icon || (item.type === 'dm' ? '💬' : item.type === 'calendar' ? '📅' : item.type === 'task' ? '✅' : '📢');
          var timeStr = formatNotifTime(item.time);
          var shortText = (item.text || '').length > 70 ? item.text.substring(0, 70) + '…' : (item.text || '');
          var isUnread = !item.read;
          var typeBadgeMap = { dm: 'DM', channel: 'KANAŁ', calendar: 'KALENDARZ', task: 'ZADANIE', system: 'SYSTEM' };
          var typeBadge = typeBadgeMap[item.type] || 'NOTIF';
          var typeBadgeColor = item.type === 'calendar' ? '#4ecdc4' : item.type === 'task' ? '#20c997' : item.type === 'dm' ? '#c471ed' : 'var(--accent)';
          html += '<div class="notif-dd-item' + (isUnread ? ' unread' : ' read-state') +
            '" data-notif-idx="' + realIdx + '" data-notif-target="' + escapeHtml((item.from || '').toLowerCase()) + '" data-notif-type="' + escapeHtml(item.type || '') + '">' +
            '<div class="notif-dd-icon" style="font-size:18px">' + icon + '</div>' +
            '<div class="notif-dd-content">' +
              '<div class="notif-dd-text"><span>' + escapeHtml(item.from || '') + '</span> — ' + escapeHtml(shortText) + '</div>' +
              '<div class="notif-dd-time">' +
                '<span style="color:' + typeBadgeColor + ';font-weight:800;font-size:9px;margin-right:5px">' + typeBadge + '</span>' +
                timeStr +
              '</div>' +
            '</div>' +
            '<button class="notif-mark-btn' + (isUnread ? '' : ' checked') + '" data-mark-idx="' + realIdx + '" title="' + (isUnread ? 'Oznacz jako przeczytane' : 'Przeczytane') + '">' +
              (isUnread ? '○' : '') +
            '</button>' +
          '</div>';
        });
      }
      html += '</div>';
      dropdown.innerHTML = html;

      // Filter buttons
      dropdown.querySelectorAll('.notif-filter-btn').forEach(function(btn) {
        btn.addEventListener('click', function(e) {
          e.stopPropagation();
          dropdown.__activeFilter = btn.dataset.filter;
          renderNotifDropdown();
        });
      });

      // Push permission enable button
      var pushEnableBtn = $('notifPushEnableBtn');
      if (pushEnableBtn) {
        pushEnableBtn.addEventListener('click', function(e) {
          e.stopPropagation();
          requestNotificationPermission();
          // Re-render after a short delay to update banner
          setTimeout(function() { renderNotifDropdown(); }, 1000);
        });
      }

      // Mark all as read (with staggered animation)
      var markAllBtn = $('notifMarkAllRead');
      if (markAllBtn) markAllBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        // Mark all in data immediately
        _notifItems.forEach(function(n) { n.read = true; });
        _saveNotifs();
        updateNotifBell();
        // Animate each item
        var unreadEls = dropdown.querySelectorAll('.notif-dd-item.unread');
        unreadEls.forEach(function(el, i) {
          setTimeout(function() {
            el.classList.remove('unread');
            el.classList.add('reading');
            var btn = el.querySelector('.notif-mark-btn');
            if (btn) { btn.classList.add('checked'); btn.textContent = ''; }
            el.addEventListener('animationend', function() {
              el.classList.remove('reading');
              el.classList.add('read-state');
            }, { once: true });
            // Fallback if animationend doesn't fire
            setTimeout(function() { el.classList.remove('reading'); el.classList.add('read-state'); }, 600);
          }, i * 55);
        });
        // Update header after animations
        setTimeout(function() {
          var badge = dropdown.querySelector('.notif-dd-unread-badge');
          if (badge) badge.remove();
          markAllBtn.style.opacity = '0';
          markAllBtn.style.pointerEvents = 'none';
        }, unreadEls.length * 55 + 200);
      });

      // Per-item mark-read buttons (delegated)
      // Handled by delegation in initNotifBell
    }

    function formatNotifTime(ts) {
      var diff = Date.now() - ts;
      if (diff < 60000) return 'teraz';
      if (diff < 3600000) return Math.floor(diff / 60000) + ' min temu';
      if (diff < 86400000) return Math.floor(diff / 3600000) + ' godz. temu';
      var d = new Date(ts);
      return d.toLocaleDateString('pl-PL') + ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes());
    }


    function showNotifDetail(notif) {
      var modal = document.getElementById('notifDetailModal');
      if (!modal) return;
      var typeBadgeMap = { dm: 'DM', channel: 'KANAŁ', calendar: 'KALENDARZ', task: 'ZADANIE', system: 'SYSTEM' };
      var typeBadgeColorMap = { calendar: '#4ecdc4', task: '#20c997', dm: '#c471ed', channel: '#c471ed', system: 'var(--accent)' };
      var icon = notif.icon || (notif.type === 'dm' ? '💬' : notif.type === 'calendar' ? '📅' : notif.type === 'task' ? '✅' : '📢');
      var typeBadge = typeBadgeMap[notif.type] || 'NOTIF';
      var color = typeBadgeColorMap[notif.type] || 'var(--accent)';
      var iconEl = document.getElementById('notifDetailIcon');
      var badgeEl = document.getElementById('notifDetailBadge');
      var fromEl = document.getElementById('notifDetailFrom');
      var textEl = document.getElementById('notifDetailText');
      var timeEl = document.getElementById('notifDetailTime');
      if (iconEl) iconEl.textContent = icon;
      if (badgeEl) {
        badgeEl.textContent = typeBadge;
        badgeEl.style.color = color;
        badgeEl.style.borderColor = color;
        badgeEl.style.background = color.replace(')', ', .12)').replace('var(--accent)', 'rgba(247,183,51,.12)');
      }
      if (fromEl) fromEl.textContent = notif.from || '—';
      if (textEl) textEl.textContent = notif.text || '';
      if (timeEl) timeEl.textContent = formatNotifTime(notif.time);
      modal.classList.remove('hidden');
    }

    // Notif detail close handlers
    (function(){
      var modal = document.getElementById('notifDetailModal');
      var closeBtn = document.getElementById('notifDetailClose');
      var dismissBtn = document.getElementById('notifDetailDismiss');
      function closeModal(){ if(modal) modal.classList.add('hidden'); }
      if (closeBtn) closeBtn.addEventListener('click', closeModal);
      if (dismissBtn) dismissBtn.addEventListener('click', closeModal);
      if (modal) modal.addEventListener('click', function(e){ if(e.target === modal) closeModal(); });
      document.addEventListener('keydown', function(e){ if(e.key === 'Escape' && modal && !modal.classList.contains('hidden')) closeModal(); });
    })();

    function initNotifBell() {
      if (_notifBellInitialized) return;
      _notifBellInitialized = true;

      var bellBtn = $('notifBellBtn');
      var dropdown = $('notifDropdown');
      if (!bellBtn || !dropdown) return;

      bellBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        var isOpen = !dropdown.classList.contains('hidden');
        if (isOpen) {
          dropdown.classList.add('hidden');
        } else {
          renderNotifDropdown();
          dropdown.classList.remove('hidden');
        }
      });

      // Close on outside click
      document.addEventListener('click', function(e) {
        if (!dropdown.classList.contains('hidden') && !dropdown.contains(e.target) && e.target !== bellBtn) {
          dropdown.classList.add('hidden');
        }
      });
      // Delegacja kliknięcia na item w dropdownie
      dropdown.addEventListener('click', function(e) {
        // ── Checkmark button click → mark as read, stay in dropdown ──
        var markBtn = e.target.closest('.notif-mark-btn');
        if (markBtn && !markBtn.classList.contains('checked')) {
          e.stopPropagation();
          var idx = parseInt(markBtn.dataset.markIdx);
          if (!isNaN(idx) && _notifItems[idx] && !_notifItems[idx].read) {
            _notifItems[idx].read = true;
            _saveNotifs();
            updateNotifBell(); // ← update bell IMMEDIATELY

            // Animate the checkmark
            markBtn.classList.add('checked');
            markBtn.textContent = '';

            // Animate the row
            var row = markBtn.closest('.notif-dd-item');
            if (row) {
              row.classList.remove('unread');
              row.classList.add('reading');
              row.addEventListener('animationend', function() {
                row.classList.remove('reading');
                row.classList.add('read-state');
              }, { once: true });
              // Fallback
              setTimeout(function() { row.classList.remove('reading'); row.classList.add('read-state'); }, 600);
            }

            // Update header badge
            var unreadNow = _notifItems.filter(function(n) { return !n.read; }).length;
            var badge = dropdown.querySelector('.notif-dd-unread-badge');
            if (badge) {
              if (unreadNow > 0) { badge.textContent = unreadNow; }
              else { badge.style.opacity = '0'; setTimeout(function(){ if(badge.parentNode) badge.remove(); }, 300); }
            }
            var markAllBtn = dropdown.querySelector('.notif-dd-mark-all');
            if (markAllBtn && unreadNow === 0) {
              markAllBtn.style.opacity = '0'; markAllBtn.style.pointerEvents = 'none';
            }
          }
          return;
        }

        // ── Body click → show detail popup ──
        var item = e.target.closest('.notif-dd-item');
        if (!item) return;
        e.stopPropagation();
        var nIdx = parseInt(item.dataset.notifIdx);
        dropdown.classList.add('hidden');
        if (!isNaN(nIdx) && _notifItems[nIdx]) {
          showNotifDetail(_notifItems[nIdx]);
          if (!_notifItems[nIdx].read) {
            _notifItems[nIdx].read = true;
            _saveNotifs();
            updateNotifBell();
          }
        }
      });
    }


    // ══════════════════════════════════════════════
    // ═══ 12H DEADLINE REMINDER SYSTEM ═══
    // ══════════════════════════════════════════════
    var _deadlineCheckInterval = null;
    var _notifiedDeadlines = {}; // { id: true } — tracks which deadlines we already notified about

    function checkUpcomingDeadlines() {
      if (!currentUser || !state) return;
      var now = Date.now();
      var TWELVE_HOURS = 12 * 60 * 60 * 1000;
      var myName = typeof _dmMyName === 'function' ? _dmMyName() : '';

      // Load already notified from localStorage to persist across reloads
      try {
        var saved = localStorage.getItem('szafer_deadline_notified');
        if (saved) _notifiedDeadlines = JSON.parse(saved);
      } catch(e) {}

      // Clean old entries (older than 48h)
      var cutoff = now - (48 * 60 * 60 * 1000);
      Object.keys(_notifiedDeadlines).forEach(function(k) {
        if (_notifiedDeadlines[k] < cutoff) delete _notifiedDeadlines[k];
      });

      // Check TASKS
      if (Array.isArray(state.tasks)) {
        state.tasks.forEach(function(task) {
          if (!task.due || task.completed || task.status === 'Zrobione') return;
          var deadlineKey = 'task_12h_' + task.id;
          if (_notifiedDeadlines[deadlineKey]) return; // already notified

          var dueDate = new Date(task.due + 'T23:59:59');
          var timeUntil = dueDate.getTime() - now;

          // Notify if within 12 hours AND not already past
          if (timeUntil > 0 && timeUntil <= TWELVE_HOURS) {
            var hoursLeft = Math.ceil(timeUntil / (60 * 60 * 1000));
            var priorityIcon = task.priority === 'Wysoki' ? '🔴' : task.priority === 'Średni' ? '🟡' : '🟢';
            addNotification({
              type: 'task',
              from: '⏰ Przypomnienie',
              text: priorityIcon + ' ' + (task.title || 'Zadanie') + ' — zostało ' + hoursLeft + 'h do terminu!' +
                (task.owner ? ' (' + task.owner + ')' : ''),
              time: now,
              channel: deadlineKey,
              icon: '⏰'
            });
            _notifiedDeadlines[deadlineKey] = now;
          }
        });
      }

      // Check ITEMS (calendar entries)
      if (Array.isArray(state.items)) {
        state.items.forEach(function(item) {
          if (!item.date || item.completed || item.status === 'Opublikowane') return;
          var deadlineKey = 'item_12h_' + item.id;
          if (_notifiedDeadlines[deadlineKey]) return; // already notified

          var dueDate = new Date(item.date + 'T23:59:59');
          var timeUntil = dueDate.getTime() - now;

          // Notify if within 12 hours AND not already past
          if (timeUntil > 0 && timeUntil <= TWELVE_HOURS) {
            var hoursLeft = Math.ceil(timeUntil / (60 * 60 * 1000));
            var typeIcon = {
              'Klip':'🎬', 'Rolka':'📱', 'Post':'🖼️', 'Story':'✨',
              'Backstage':'🎥', 'Spotkanie':'📅', 'Sesja w Studio':'🎙️',
              'Sesja Zdjęciowa/Filmowa':'📸'
            }[item.type] || '📌';
            addNotification({
              type: 'calendar',
              from: '⏰ Przypomnienie',
              text: typeIcon + ' ' + (item.title || 'Wpis') + ' — za ' + hoursLeft + 'h!' +
                (item.type ? ' · ' + item.type : '') +
                (item.owner ? ' (' + item.owner + ')' : ''),
              time: now,
              channel: deadlineKey,
              icon: '⏰'
            });
            _notifiedDeadlines[deadlineKey] = now;
          }
        });
      }

      // Save notified state
      try {
        localStorage.setItem('szafer_deadline_notified', JSON.stringify(_notifiedDeadlines));
      } catch(e) {}

      updateNotifBell();
    }

    function startDeadlineChecker() {
      // Run immediately on login
      setTimeout(checkUpcomingDeadlines, 3000);
      // Then every 5 minutes
      if (_deadlineCheckInterval) clearInterval(_deadlineCheckInterval);
      _deadlineCheckInterval = setInterval(checkUpcomingDeadlines, 5 * 60 * 1000);
    }

    function stopDeadlineChecker() {
      if (_deadlineCheckInterval) {
        clearInterval(_deadlineCheckInterval);
        _deadlineCheckInterval = null;
      }
    }


    // ══════════════════════════════════════════════
    // ═══ TEAM PULSE ═══
    // ══════════════════════════════════════════════
    var _tpInitialized = false;

    function initTeamPulse() {
      if (_tpInitialized) return;
      _tpInitialized = true;

      // Particles (deferred)
      setTimeout(function() {
        var particleWrap = $('tpParticles');
        if (particleWrap) {
          var colors = ['rgba(247,183,51,.25)','rgba(252,74,26,.2)','rgba(78,205,196,.2)','rgba(196,113,237,.15)'];
          for (var i = 0; i < 12; i++) {
            var p = document.createElement('div');
            p.className = 'tp-particle';
            p.style.left = (Math.random() * 100) + '%';
            p.style.width = (4 + Math.random() * 10) + 'px';
            p.style.height = p.style.width;
            p.style.background = colors[Math.floor(Math.random() * colors.length)];
            p.style.animationDuration = (6 + Math.random() * 10) + 's';
            p.style.animationDelay = (Math.random() * 8) + 's';
            particleWrap.appendChild(p);
          }
        }
      }, 2000);

      // Person card click → highlight
      document.querySelectorAll('.tp-person').forEach(function(card) {
        card.addEventListener('click', function() {
          document.querySelectorAll('.tp-person').forEach(function(c){ c.classList.remove('tp-active'); });
          card.classList.add('tp-active');
        });
      });

      // Mood buttons
      var moodRow = $('tpMoodRow');
      if (moodRow) {
        moodRow.addEventListener('click', function(e) {
          var btn = e.target.closest('.tp-mood-btn');
          if (!btn) return;
          moodRow.querySelectorAll('.tp-mood-btn').forEach(function(b){ b.classList.remove('selected'); });
          btn.classList.add('selected');
          var mood = btn.dataset.mood;
          if (currentUser) {
            var moodRef = ref(db, 'szaferPanel/pulse/mood/' + currentUser.uid);
            set(moodRef, { mood: mood, email: currentUser.email, timestamp: Date.now() });
            addPulseActivity(mood + ' ' + (currentUser.email || '').split('@')[0] + ' ustawił mood');
          }
        });
      }

      // Quick note
      var noteEl = $('tpQuickNote');
      if (noteEl) {
        noteEl.addEventListener('blur', function() {
          if (!currentUser) return;
          var text = noteEl.value.trim();
          if (!text) return;
          var noteRef = ref(db, 'szaferPanel/pulse/notes/' + currentUser.uid);
          set(noteRef, { text: text, email: currentUser.email, timestamp: Date.now() });
          addPulseActivity('📝 ' + (currentUser.email || '').split('@')[0] + ': ' + text.slice(0,40));
        });
      }

      // Subscribe to pulse data
      var pulseRef = ref(db, 'szaferPanel/pulse');
      onValue(pulseRef, function(snapshot) {
        var data = snapshot.val();
        if (!data) return;
        // Store moods globally for renderPresenceUI to use
        if (data.mood) {
          _personMoods = {};
          Object.values(data.mood).forEach(function(m) {
            if (!m || !m.email) return;
            var name = m.email.split('@')[0].toLowerCase();
            PERSONS.forEach(function(p) {
              if (name.includes(p.toLowerCase()) && m.mood) {
                _personMoods[p] = m.mood;
              }
            });
          });
          // Re-render presence with updated moods
          renderPresenceUI();
        }
        // Update activity feed
        if (data.activity) {
          var acts = [];
          Object.values(data.activity).forEach(function(a) { if (a && a.text) acts.push(a); });
          acts.sort(function(a,b){ return b.timestamp - a.timestamp; });
          renderActivityFeed(acts.slice(0, 8));
        }
      });
    }

    function addPulseActivity(text) {
      if (!currentUser) return;
      var actId = 'act_' + Date.now().toString(36);
      var actRef = ref(db, 'szaferPanel/pulse/activity/' + actId);
      set(actRef, { text: text, timestamp: Date.now() });
    }

    function renderActivityFeed(acts) {
      var el = $('tpActivityFeed');
      if (!el || !acts.length) return;
      el.innerHTML = acts.map(function(a) {
        var ago = getTimeAgo(a.timestamp);
        return '<div class="tp-activity-item">' +
          '<span class="tp-act-icon">⚡</span>' +
          '<span class="tp-act-text">' + escapeHtml(a.text) + '</span>' +
          '<span class="tp-act-time">' + ago + '</span>' +
        '</div>';
      }).join('');
    }

    function getTimeAgo(ts) {
      var diff = Math.round((Date.now() - ts) / 1000);
      if (diff < 60) return 'teraz';
      if (diff < 3600) return Math.floor(diff/60) + ' min';
      if (diff < 86400) return Math.floor(diff/3600) + ' godz.';
      return Math.floor(diff/86400) + ' dni';
    }

    function prettyLastSeen(ts) {
      if (!ts) return '';
      var d = new Date(ts);
      var now = new Date();
      var diffMs = now - d;
      var diffMin = Math.floor(diffMs / 60000);
      var diffHr = Math.floor(diffMs / 3600000);
      var diffDay = Math.floor(diffMs / 86400000);

      var timeStr = pad2(d.getHours()) + ':' + pad2(d.getMinutes());
      var dateStr = pad2(d.getDate()) + '.' + pad2(d.getMonth()+1);

      if (diffMin < 2) return 'Przed chwilą';
      if (diffMin < 60) return diffMin + ' min temu · ' + timeStr;
      if (diffDay === 0) return 'Dziś o ' + timeStr;
      if (diffDay === 1) return 'Wczoraj o ' + timeStr;
      if (diffDay < 7) return diffDay + ' dni temu · ' + dateStr + ' ' + timeStr;
      return dateStr + '.' + d.getFullYear() + ' o ' + timeStr;
    }

    // ══════════════════════════════════════════════
    // ═══ FILE UPLOAD SYSTEM (RTDB base64) ═══
    // ══════════════════════════════════════════════
    var _uploadInitialized = false;
    var _uploadUnsub = null;
    var MAX_FILE_SIZE = 8 * 1024 * 1024; // 8 MB

    function initUpload() {
      if (_uploadInitialized) return;
      _uploadInitialized = true;

      var dropZone = $('uploadDropZone');
      var fileInput = $('uploadFileInput');
      var filterSelect = $('uploadFilterFolder');

      // Click to select
      dropZone.addEventListener('click', function() { fileInput.click(); });
      fileInput.addEventListener('change', function() {
        if (fileInput.files.length) handleUploadFiles(fileInput.files);
        fileInput.value = '';
      });

      // Drag & drop
      ['dragenter','dragover'].forEach(function(evt) {
        dropZone.addEventListener(evt, function(e) { e.preventDefault(); e.stopPropagation(); dropZone.classList.add('drag-over'); });
      });
      ['dragleave','drop'].forEach(function(evt) {
        dropZone.addEventListener(evt, function(e) { e.preventDefault(); e.stopPropagation(); dropZone.classList.remove('drag-over'); });
      });
      dropZone.addEventListener('drop', function(e) {
        if (e.dataTransfer.files.length) handleUploadFiles(e.dataTransfer.files);
      });

      // Filter (hidden select kept for compat)
      if (filterSelect) filterSelect.addEventListener('change', function() { renderUploadFiles(); });

      // Folder chip shortcuts
      document.querySelectorAll('.upload-folder-chip').forEach(function(chip) {
        chip.addEventListener('click', function() {
          document.querySelectorAll('.upload-folder-chip').forEach(function(c){ c.classList.remove('active'); });
          chip.classList.add('active');
          var val = chip.dataset.folderChip;
          if (filterSelect) { filterSelect.value = val; renderUploadFiles(); }
        });
      });

      // Subscribe to file metadata
      var filesRef = ref(db, 'szaferPanel/files');
      _uploadUnsub = onValue(filesRef, function(snapshot) {
        var data = snapshot.val();
        window._uploadedFiles = [];
        if (data && typeof data === 'object') {
          Object.keys(data).forEach(function(k) {
            var f = data[k];
            if (f && f.name) { f._key = k; window._uploadedFiles.push(f); }
          });
        }
        window._uploadedFiles.sort(function(a,b){ return (b.uploadedAt||0) - (a.uploadedAt||0); });
        renderUploadFiles();
        // Also refresh the media attachment grid in the item form
        try { renderMediaAttachGrid(); } catch(e) {}
      });

      // Action handlers (delete / download)
      $('uploadFileList').addEventListener('click', function(e) {
        var delBtn = e.target.closest('[data-action="delete-file"]');
        if (delBtn) {
          var key = delBtn.dataset.key;
          if (key && confirm('Usunąć ten plik?')) {
            set(ref(db, 'szaferPanel/files/' + key), null);
            showToast('🗑️ Plik usunięty');
          }
          return;
        }
        var dlBtn = e.target.closest('[data-action="download-file"]');
        if (dlBtn) {
          var key2 = dlBtn.dataset.key;
          var file = (window._uploadedFiles || []).find(function(f){ return f._key === key2; });
          if (file && file.dataUrl) {
            var a = document.createElement('a');
            a.href = file.dataUrl;
            a.download = file.name;
            document.body.appendChild(a);
            a.click();
            setTimeout(function(){ document.body.removeChild(a); }, 100);
          }
          return;
        }
        var prevBtn = e.target.closest('[data-action="preview-file"]');
        if (prevBtn) {
          var key3 = prevBtn.dataset.key;
          var file2 = (window._uploadedFiles || []).find(function(f){ return f._key === key3; });
          if (file2 && file2.dataUrl) {
            openLightbox(file2.dataUrl, file2.name);
          }
        }
      });
    }

    function fileToBase64(file) {
      return new Promise(function(resolve, reject) {
        var reader = new FileReader();
        reader.onload = function() { resolve(reader.result); };
        reader.onerror = function() { reject(new Error('Błąd odczytu pliku')); };
        reader.readAsDataURL(file);
      });
    }

    async function handleUploadFiles(files) {
      if (!currentUser) { alert('Zaloguj się aby uploadować pliki.'); return; }
      var folder = ($('uploadFolder') || {}).value || 'ogólne';
      var progressWrap = $('uploadProgress');
      progressWrap.classList.remove('hidden');
      progressWrap.innerHTML = '';

      for (var i = 0; i < files.length; i++) {
        var file = files[i];
        if (file.size > MAX_FILE_SIZE) {
          showToast('⚠️ Plik "' + file.name + '" przekracza 8 MB!');
          continue;
        }

        // Progress UI
        var progEl = document.createElement('div');
        progEl.className = 'upload-progress-item';
        progEl.innerHTML = '<div class="upload-progress-name">' + escapeHtml(file.name) + '</div>' +
          '<div class="upload-progress-bar"><div class="upload-progress-fill" style="width:0%"></div></div>' +
          '<div class="upload-progress-pct">0%</div>';
        progressWrap.appendChild(progEl);
        var fillBar = progEl.querySelector('.upload-progress-fill');
        var pctText = progEl.querySelector('.upload-progress-pct');

        try {
          fillBar.style.width = '30%'; pctText.textContent = '30%';

          var dataUrl = await fileToBase64(file);
          fillBar.style.width = '70%'; pctText.textContent = '70%';

          var fileId = 'f_' + Date.now().toString(36) + Math.random().toString(36).slice(2,6);
          var metaRef = ref(db, 'szaferPanel/files/' + fileId);

          await set(metaRef, {
            name: file.name,
            size: file.size,
            type: file.type || 'application/octet-stream',
            folder: folder,
            dataUrl: dataUrl,
            uploadedBy: currentUser.email || currentUser.uid,
            uploadedAt: Date.now()
          });

          fillBar.style.width = '100%'; pctText.textContent = '✅';
          showToast('✅ Przesłano: ' + file.name);

          (function(el) {
            setTimeout(function() {
              if (el.parentNode) el.remove();
              if (!progressWrap.children.length) progressWrap.classList.add('hidden');
            }, 1500);
          })(progEl);

        } catch(err) {
          pctText.textContent = '❌';
          console.error('Upload error:', err);
          showToast('❌ Błąd: ' + file.name + ' — ' + (err.message || 'nieznany błąd'));
        }
      }
    }

    function renderUploadFiles() {
      var el = $('uploadFileList');
      if (!el) return;
      var allFiles = window._uploadedFiles || [];
      var filter = ($('uploadFilterFolder') || {}).value || '';
      var files = filter ? allFiles.filter(function(f){ return f.folder === filter; }) : allFiles;

      // Update stats
      (function() {
        var total  = allFiles.length;
        var images = allFiles.filter(function(f){ return (f.type||'').startsWith('image/'); }).length;
        var videos = allFiles.filter(function(f){ return (f.type||'').startsWith('video/'); }).length;
        var docs   = allFiles.filter(function(f){ return !((f.type||'').startsWith('image/') || (f.type||'').startsWith('video/')); }).length;
        var s = document.getElementById('uploadStatTotal'); if(s) s.textContent = total;
        s = document.getElementById('uploadStatImages'); if(s) s.textContent = images;
        s = document.getElementById('uploadStatVideos'); if(s) s.textContent = videos;
        s = document.getElementById('uploadStatDocs');   if(s) s.textContent = docs;
      })();

      if (!files.length) {
        el.innerHTML = '<div class="empty" style="text-align:center;padding:30px"><div style="font-size:36px;opacity:.3;margin-bottom:8px">📁</div>Brak plików' + (filter ? ' w folderze "' + filter + '"' : '') + '.<br><span style="font-size:11px;opacity:.6">Wrzuć pliki w strefie po lewej</span></div>';
        return;
      }

      var folderIcons = {'ogólne':'📁','klipy':'🎬','grafiki':'🖼️','muzyka':'🎵','dokumenty':'📄','raw':'📦'};

      // Separate images and other files
      var images = files.filter(function(f){ return (f.type||'').startsWith('image/') && f.dataUrl; });
      var others = files.filter(function(f){ return !(f.type||'').startsWith('image/') || !f.dataUrl; });

      var html = '';

      // Image gallery grid
      if (images.length) {
        html += '<div class="uf-section-label">🖼️ Zdjęcia · ' + images.length + '</div>';
        html += '<div class="uf-gallery">';
        html += images.map(function(f) {
          var sizeStr = f.size < 1048576 ? Math.round(f.size/1024) + ' KB' : (f.size/1048576).toFixed(1) + ' MB';
          var uploader = (f.uploadedBy || '').split('@')[0];
          return '<div class="uf-gallery-item">' +
            '<img class="uf-gallery-img" src="' + f.dataUrl + '" alt="" loading="lazy" data-key="' + escapeHtml(f._key) + '" />' +
            '<div class="uf-gallery-overlay">' +
              '<div class="uf-gallery-name">' + escapeHtml(f.name) + '</div>' +
              '<div class="uf-gallery-meta">' + sizeStr + ' · 👤 ' + escapeHtml(uploader) + '</div>' +
            '</div>' +
            '<div class="uf-gallery-actions">' +
              '<button class="uf-gal-btn" data-action="download-file" data-key="' + escapeHtml(f._key) + '" title="Pobierz">⬇️</button>' +
              '<button class="uf-gal-btn uf-gal-del" data-action="delete-file" data-key="' + escapeHtml(f._key) + '" title="Usuń">✕</button>' +
            '</div>' +
          '</div>';
        }).join('');
        html += '</div>';
      }

      // Other files list
      if (others.length) {
        html += '<div class="uf-section-label">📄 Inne pliki · ' + others.length + '</div>';
        html += others.map(function(f) {
          var isVideo = (f.type||'').startsWith('video/');
          var isAudio = (f.type||'').startsWith('audio/');
          var icon = isVideo ? '🎬' : isAudio ? '🎵' : '📄';
          var sizeStr = f.size < 1048576 ? Math.round(f.size/1024) + ' KB' : (f.size/1048576).toFixed(1) + ' MB';
          var date = f.uploadedAt ? new Date(f.uploadedAt).toLocaleDateString('pl-PL',{day:'2-digit',month:'short'}) : '';
          var uploader = (f.uploadedBy || '').split('@')[0];
          var folderIcon = folderIcons[f.folder] || '📁';
          return '<div class="upload-file-card">' +
            '<div class="upload-file-icon">' + icon + '</div>' +
            '<div class="upload-file-body">' +
              '<div class="upload-file-name">' + escapeHtml(f.name) + '</div>' +
              '<div class="upload-file-meta">' +
                '<span>' + sizeStr + '</span>' +
                '<span>' + date + '</span>' +
                '<span>👤 ' + escapeHtml(uploader) + '</span>' +
                '<span class="upload-file-tag">' + folderIcon + ' ' + escapeHtml(f.folder || 'ogólne') + '</span>' +
              '</div>' +
            '</div>' +
            '<div class="upload-file-actions">' +
              '<button class="btn-notify" data-action="download-file" data-key="' + escapeHtml(f._key) + '" title="Pobierz">⬇️</button>' +
              '<button class="small-btn" data-action="delete-file" data-key="' + escapeHtml(f._key) + '" title="Usuń">×</button>' +
            '</div>' +
          '</div>';
        }).join('');
      }

      el.innerHTML = html;
    }

    // Initialize upload when auth is ready
    var _origSetAuthUI = setAuthUI;
    setAuthUI = function(isLoggedIn, user) {
      _origSetAuthUI(isLoggedIn, user);
      if (isLoggedIn) initUpload();
    };

    // ══════════════════════════════════════════════
    // ═══ HERO PARTICLES (deferred) ═══
    // ══════════════════════════════════════════════
    setTimeout(function() {
      var w = $('heroParticles');
      if (!w) return;
      var c = ['rgba(247,183,51,.12)','rgba(252,74,26,.1)','rgba(78,205,196,.1)','rgba(196,113,237,.08)','rgba(255,255,255,.04)'];
      for (var i = 0; i < 10; i++) {
        var p = document.createElement('div');
        p.className = 'tp-particle';
        p.style.left = (Math.random()*100)+'%';
        var s = (2+Math.random()*6)+'px'; p.style.width=s; p.style.height=s;
        p.style.background = c[Math.floor(Math.random()*c.length)];
        p.style.animationDuration = (8+Math.random()*14)+'s';
        p.style.animationDelay = (Math.random()*10)+'s';
        w.appendChild(p);
      }
    }, 1500);

    // ══════════════════════════════════════════════
    // ═══ MEDIA ATTACHMENT SYSTEM ═══
    // ══════════════════════════════════════════════
    var _selectedMediaFiles = [];

    // Compatibility: which MIME types are allowed per CHANNEL
    var MEDIA_COMPAT_CHANNEL = {
      "YouTube":          ["video/","image/"],
      "TikTok":           ["video/"],
      "Instagram":        ["image/"],
      "Instagram Reels":  ["video/"],
      "TikTok / Reels":   ["video/"],
      "Facebook":         ["image/","video/"],
      "Twitch":           ["video/"],
      "Discord":          [],
      "Spotify":          ["audio/"],
      "Zoom":             [],
      "Studio":           ["audio/","video/","image/"],
      "Inne":             ["image/","video/","audio/"]
    };

    function getCompatibleMimes(channel) {
      if (!channel) return ["image/","video/","audio/"];
      var byChannel = MEDIA_COMPAT_CHANNEL[channel];
      if (byChannel === null || byChannel === undefined) return ["image/","video/","audio/"];
      return byChannel;
    }

    function isFileCompatible(file, allowedMimes) {
      if (!file || !file.type) return false;
      return allowedMimes.some(function(prefix){ return file.type.startsWith(prefix); });
    }

    function renderMediaThumbs(mediaKeys, maxShow) {
      if (!mediaKeys || !mediaKeys.length) return '';
      var files = window._uploadedFiles || [];
      var shown = mediaKeys.slice(0, maxShow || 4);
      var extra = mediaKeys.length - shown.length;
      var html = '<div class="media-thumbs-row">';
      shown.forEach(function(key) {
        var f = files.find(function(x){ return x._key === key; });
        if (!f) return;
        var isImg = (f.type||'').startsWith('image/');
        var isVid = (f.type||'').startsWith('video/');
        if (isImg && f.dataUrl) {
          html += '<div class="media-thumb-item" title="' + escapeHtml(f.name) + '"><img src="' + f.dataUrl + '" class="media-thumb-img" loading="lazy" /></div>';
        } else {
          var icon = isVid ? '🎬' : '🎵';
          html += '<div class="media-thumb-item media-thumb-file" title="' + escapeHtml(f.name) + '"><span>' + icon + '</span><span class="media-thumb-fname">' + escapeHtml(f.name.slice(0,12)) + '</span></div>';
        }
      });
      if (extra > 0) html += '<div class="media-thumb-item media-thumb-more">+' + extra + '</div>';
      html += '</div>';
      return html;
    }

    function renderMediaAttachGrid() {
      var grid = $('mediaAttachGrid');
      var info = $('mediaAttachInfo');
      if (!grid || !info) return;

      var channel = (els.itemPlace || {}).value || '';
      var allowedMimes = getCompatibleMimes(channel);

      if (allowedMimes.length === 0) {
        var reason = '🚫 Kanał "' + channel + '" nie obsługuje przypisywania mediów';
        info.textContent = reason;
        info.className = 'media-attach-info has-warning';
        grid.innerHTML = '';
        renderAttachedChips();
        return;
      }

      var channelLabel = channel || 'Wszystkie kanały';
      var mimeLabels = allowedMimes.map(function(m){ return m === 'image/' ? '🖼️ Zdjęcia' : m === 'video/' ? '🎬 Video' : m === 'audio/' ? '🎵 Audio' : m; });
      info.textContent = '📎 ' + channelLabel + ' → akceptuje: ' + mimeLabels.join(', ') + ' · Kliknij aby przypisać';
      info.className = 'media-attach-info';

      var files = (window._uploadedFiles || []).filter(function(f){ return isFileCompatible(f, allowedMimes); });

      if (!files.length) {
        grid.innerHTML = '<div class="media-no-compat">Brak kompatybilnych plików w Uploadzie. Wrzuć pliki w zakładce 📁 Upload.</div>';
        renderAttachedChips();
        return;
      }

      grid.innerHTML = files.map(function(f) {
        var isSelected = _selectedMediaFiles.indexOf(f._key) !== -1;
        var isImage = (f.type || '').startsWith('image/');
        var isVideo = (f.type || '').startsWith('video/');
        var isAudio = (f.type || '').startsWith('audio/');
        var icon = isImage ? '🖼️' : isVideo ? '🎬' : isAudio ? '🎵' : '📄';
        var thumb = isImage && f.dataUrl ?
          '<img class="media-attach-thumb" src="' + f.dataUrl + '" alt="" loading="lazy" />' :
          '<div class="media-attach-icon">' + icon + '</div>';
        return '<div class="media-attach-card' + (isSelected ? ' selected' : '') + '" data-file-key="' + escapeHtml(f._key) + '">' +
          thumb +
          '<div class="media-attach-name">' + escapeHtml(f.name) + '</div>' +
        '</div>';
      }).join('');

      renderAttachedChips();
    }

    function renderAttachedChips() {
      var el = $('mediaAttachedList');
      if (!el) return;
      if (!_selectedMediaFiles.length) { el.innerHTML = ''; return; }
      var files = window._uploadedFiles || [];
      el.innerHTML = _selectedMediaFiles.map(function(key) {
        var f = files.find(function(x){ return x._key === key; });
        if (!f) return '';
        var isImage = (f.type||'').startsWith('image/');
        var icon = isImage ? '🖼️' : (f.type||'').startsWith('video/') ? '🎬' : '🎵';
        return '<span class="media-attached-chip">' +
          icon + ' ' + escapeHtml(f.name.slice(0,25)) +
          '<span class="mac-remove" data-remove-key="' + escapeHtml(key) + '">✕</span>' +
        '</span>';
      }).filter(Boolean).join('');
    }

    // Click handlers for media grid
    document.addEventListener('click', function(e) {
      var card = e.target.closest('.media-attach-card');
      if (card) {
        var key = card.dataset.fileKey;
        if (!key) return;
        var idx = _selectedMediaFiles.indexOf(key);
        if (idx === -1) { _selectedMediaFiles.push(key); card.classList.add('selected'); }
        else { _selectedMediaFiles.splice(idx,1); card.classList.remove('selected'); }
        renderAttachedChips();
        return;
      }
      var removeBtn = e.target.closest('.mac-remove');
      if (removeBtn) {
        var rk = removeBtn.dataset.removeKey;
        _selectedMediaFiles = _selectedMediaFiles.filter(function(k){ return k !== rk; });
        renderMediaAttachGrid();
      }
    });

    // Update grid when channel changes (type no longer matters for media)
    if (els.itemPlace) els.itemPlace.addEventListener('change', renderMediaAttachGrid);

    // Media thumbnail lightbox
    document.addEventListener('click', function(e) {
      // Thumb from item cards / day modal
      var thumb = e.target.closest('.media-thumb-item');
      if (thumb && !thumb.classList.contains('media-thumb-more')) {
        var img = thumb.querySelector('.media-thumb-img');
        if (img && img.src) { openLightbox(img.src, thumb.title || ''); }
        return;
      }
      // Gallery image click
      var galImg = e.target.closest('.uf-gallery-img');
      if (galImg && galImg.src) {
        openLightbox(galImg.src, '');
        return;
      }
      // Preview-file action from upload list
      var prevBtn = e.target.closest('[data-action="preview-file"]');
      if (prevBtn) {
        var key = prevBtn.dataset.key;
        var f = (window._uploadedFiles || []).find(function(x){ return x._key === key; });
        if (f && f.dataUrl) openLightbox(f.dataUrl, f.name);
      }
    });

    function openLightbox(src, name) {
      var lb = $('mediaLightbox');
      var lbImg = $('mediaLbImg');
      var lbName = $('mediaLbName');
      if (lb && lbImg) {
        lbImg.src = src;
        if (lbName) lbName.textContent = name || '';
        lb.classList.remove('hidden');
      }
    }

    // Hook into cancelItemEdit to reset media
    var _origCancelItemEdit = cancelItemEdit;
    cancelItemEdit = function(render) {
      _selectedMediaFiles = [];
      _origCancelItemEdit(render);
      renderMediaAttachGrid();
    };

    // Hook into editItem to load media
    var _origEditItem = editItem;
    editItem = function(id) {
      _origEditItem(id);
      var item = state.items.find(function(x){ return x.id === id; });
      if (item) {
        _selectedMediaFiles = (item.mediaFiles || []).slice();
        setTimeout(renderMediaAttachGrid, 100);
      }
    };

    // ══════════════════════════════════════════════
    // ═══ PROFILE EDITOR ═══
    // ══════════════════════════════════════════════
    var _profileData = {}; // { uid: { displayName, avatar, ... } }
    var _profileUnsub = null;
    var _selectedProfileAvatar = '';
    var _selectedProfileMood = '';

    function initProfileSystem() {
      if (initProfileSystem._done) return;
      initProfileSystem._done = true;
      // Subscribe to all profiles
      var profRef = ref(db, 'szaferPanel/profiles');
      _profileUnsub = onValue(profRef, function(snapshot) {
        _profileData = snapshot.val() || {};
        applyProfilesToUI();
        // Reinit DM tracking when profiles update (myName may change)
        if (currentUser && _notifBellInitialized) {
          initDmUnreadTracking();
        }
      });

      // Mark current user's card and make it clickable
      markOwnCard();

      // Modal controls — listenery już dodane przez _attachProfileClosers()
      // (zapobiega duplikatom przy wielokrotnym wywołaniu initProfileSystem)

      // Avatar picker
      $('profAvatarPicker').addEventListener('click', function(e) {
        var btn = e.target.closest('.prof-av-btn');
        if (!btn) return;
        $('profAvatarPicker').querySelectorAll('.prof-av-btn').forEach(function(b){ b.classList.remove('selected'); });
        btn.classList.add('selected');
        _selectedProfileAvatar = btn.dataset.av;
        $('profAvatarPreview').textContent = _selectedProfileAvatar;
        // Live preview in topbar
        var _tbc = $('tbAvatarCircle');
        if (_tbc) {
          _tbc.textContent = _selectedProfileAvatar;
          _tbc.style.transition = 'transform .2s cubic-bezier(.34,1.56,.64,1)';
          _tbc.style.transform  = 'scale(1.25)';
          setTimeout(function(){ _tbc.style.transform = 'scale(1)'; }, 220);
        }
      });

      // Mood picker
      var profMoodEl = $('profMoodPicker');
      if (profMoodEl) {
        profMoodEl.addEventListener('click', function(e) {
          var btn = e.target.closest('.tp-mood-btn');
          if (!btn) return;
          profMoodEl.querySelectorAll('.tp-mood-btn').forEach(function(b){ b.classList.remove('selected'); });
          btn.classList.add('selected');
          _selectedProfileMood = btn.dataset.mood;
        });
      }

      // Save button
      $('profSaveBtn').addEventListener('click', saveProfile);
    }

    function markOwnCard() {
      if (!currentUser) return;
      var email = emailToPerson((currentUser.email || '').toLowerCase());
      document.querySelectorAll('.tp-person').forEach(function(card) {
        var person = (card.dataset.person || '').toLowerCase();
        if (email.includes(person)) {
          card.classList.add('tp-is-you');
        }
      });
    }

    function openProfileModal() {
      if (!currentUser) return;
      var uid = currentUser.uid;
      var prof = _profileData[uid] || {};
      $('profDisplayName').value = prof.displayName || (currentUser.email || '').split('@')[0];
      var _profEmailVal = currentUser.email || '';
      // Jeśli brak emaila w auth ale profil to blajetttp — uzupełnij
      if (!_profEmailVal && prof.displayName && prof.displayName.toLowerCase() === 'blajetttp') {
        _profEmailVal = 'blajetttp@gmail.com';
      }
      $('profEmail').value = _profEmailVal;
      _selectedProfileAvatar = prof.avatar || '';
      $('profAvatarPreview').textContent = _selectedProfileAvatar || (currentUser.email || 'U').charAt(0).toUpperCase();
      $('profAvatarPicker').querySelectorAll('.prof-av-btn').forEach(function(b) {
        b.classList.toggle('selected', b.dataset.av === _selectedProfileAvatar);
      });
      // Mood
      _selectedProfileMood = prof.mood || '';
      var moodPkr = $('profMoodPicker');
      if (moodPkr) moodPkr.querySelectorAll('.tp-mood-btn').forEach(function(b) {
        b.classList.toggle('selected', b.dataset.mood === _selectedProfileMood);
      });
      // Quick note
      if ($('profQuickNote')) $('profQuickNote').value = prof.note || '';
      // Header title
      if ($('profModalTitle')) $('profModalTitle').textContent = (prof.displayName || (currentUser.email||'').split('@')[0]) || 'Edytuj profil';
      $('profNewPassword').value = '';
      $('profConfirmPassword').value = '';
      $('profMessage').textContent = '';
      $('profileModal').classList.remove('hidden');
    }

    window.openProfileModal = openProfileModal;
    window.closeProfileModal = closeProfileModal;
    function closeProfileModal() {
      var pm = $('profileModal');
      if (pm) pm.classList.add('hidden');
    }

    // FIX: Bezpośrednie listenery — nie zależą od initProfileSystem / kolejności wywołań
    document.addEventListener('DOMContentLoaded', function() {}, false); // ensure DOM
    (function _attachProfileClosers() {
      function _tryAttach() {
        var xBtn = $('profileModalClose');
        var cancelBtn = $('profCancelBtn');
        if (!xBtn) { setTimeout(_tryAttach, 150); return; }
        if (!xBtn.__closeAttached) {
          xBtn.addEventListener('click', function(e) { e.stopPropagation(); closeProfileModal(); });
          xBtn.__closeAttached = true;
        }
        if (cancelBtn && !cancelBtn.__closeAttached) {
          cancelBtn.addEventListener('click', function(e) { e.stopPropagation(); closeProfileModal(); });
          cancelBtn.__closeAttached = true;
        }
      }
      // Próbuj natychmiast i po chwili (moduł ładuje się asynchronicznie)
      _tryAttach();
      // ESC key
      document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
          var pm = $('profileModal');
          if (pm && !pm.classList.contains('hidden')) closeProfileModal();
        }
      });
      // Klik poza profileModal zamyka go
      document.addEventListener('click', function(e) {
        var pm = $('profileModal');
        if (!pm || pm.classList.contains('hidden')) return;
        var wrap = document.querySelector('.prof-dropdown-wrap');
        if (wrap && !wrap.contains(e.target)) closeProfileModal();
      });
    })();

    async function saveProfile() {
      if (!currentUser) return;
      var msgEl = $('profMessage');
      var displayName = $('profDisplayName').value.trim();
      var newEmail = $('profEmail').value.trim();
      var newPass = $('profNewPassword').value;
      var confirmPass = $('profConfirmPassword').value;

      if (!displayName) { msgEl.innerHTML = '<span style="color:var(--danger)">Podaj nazwę użytkownika.</span>'; return; }

      // Save profile data to RTDB
      try {
        var profRef = ref(db, 'szaferPanel/profiles/' + currentUser.uid);
        await set(profRef, {
          displayName: displayName,
          avatar: _selectedProfileAvatar,
          mood: _selectedProfileMood || '',
          note: ($('profQuickNote') ? $('profQuickNote').value.trim() : ''),
          email: currentUser.email,
          updatedAt: Date.now()
        });

        // Update Firebase Auth display name
        try {
          await updateProfile(currentUser, { displayName: displayName });
        } catch(e) { /* non-critical */ }

        // Change password if provided
        if (newPass) {
          if (newPass.length < 6) {
            msgEl.innerHTML = '<span style="color:var(--danger)">Hasło musi mieć min. 6 znaków.</span>';
            return;
          }
          if (newPass !== confirmPass) {
            msgEl.innerHTML = '<span style="color:var(--danger)">Hasła się nie zgadzają.</span>';
            return;
          }
          try {
            await updatePassword(currentUser, newPass);
            msgEl.innerHTML = '<span style="color:var(--ok)">✅ Hasło zmienione!</span>';
          } catch(e) {
            msgEl.innerHTML = '<span style="color:var(--danger)">Błąd zmiany hasła: ' + escapeHtml(e.code || e.message) + '<br>Wymagane ponowne logowanie.</span>';
            return;
          }
        }

        // Change email if different
        if (newEmail && newEmail !== currentUser.email) {
          try {
            await currentUser.verifyBeforeUpdateEmail(newEmail);
            msgEl.innerHTML = '<span style="color:var(--ok)">✅ Profil zapisany! Sprawdź skrzynkę e-mail aby potwierdzić zmianę adresu.</span>';
          } catch(e) {
            msgEl.innerHTML = '<span style="color:var(--warn)">⚠️ Profil zapisany, ale zmiana emaila wymaga ponownego logowania: ' + escapeHtml(e.code || e.message) + '</span>';
          }
        } else {
          if (!newPass) msgEl.innerHTML = '<span style="color:var(--ok)">✅ Profil zapisany!</span>';
        }

        // ── Instant local update — no wait for Firebase listener ──
        // Update _profileData locally so applyProfilesToUI reflects changes immediately
        if (!_profileData[currentUser.uid]) _profileData[currentUser.uid] = {};
        _profileData[currentUser.uid].displayName = displayName;
        _profileData[currentUser.uid].avatar = _selectedProfileAvatar;
        _profileData[currentUser.uid].mood = _selectedProfileMood || '';
        _profileData[currentUser.uid].note = ($('profQuickNote') ? $('profQuickNote').value.trim() : '');
        _profileData[currentUser.uid].email = currentUser.email;
        applyProfilesToUI();
        (function() {
          var circle = $('tbAvatarCircle');
          var nameEl = $('tbUserName');
          if (circle) {
            var av = _selectedProfileAvatar || (currentUser.email||'U').charAt(0).toUpperCase();
            circle.textContent = av;
            circle.style.transition = 'transform .28s cubic-bezier(.34,1.56,.64,1), box-shadow .28s';
            circle.style.transform  = 'scale(1.4)';
            circle.style.boxShadow  = '0 0 20px rgba(247,183,51,.75)';
            setTimeout(function(){ circle.style.transform='scale(1)'; circle.style.boxShadow=''; }, 300);
          }
          if (nameEl && displayName) {
            nameEl.style.transition = 'opacity .18s';
            nameEl.style.opacity    = '0';
            setTimeout(function(){ nameEl.textContent = displayName; nameEl.style.opacity = ''; }, 200);
          }
        })();
        showToast('✅ Profil zaktualizowany!');
        setTimeout(closeProfileModal, 1500);

      } catch(err) {
        msgEl.innerHTML = '<span style="color:var(--danger)">Błąd: ' + escapeHtml(err.message || 'nieznany') + '</span>';
      }
    }

    function applyProfilesToUI() {
      // Cache profiles to localStorage for instant restore after re-login
      try { localStorage.setItem('szafer_profiles_cache', JSON.stringify(_profileData)); } catch(e) {}

      Object.keys(_profileData).forEach(function(uid) {
        var prof = _profileData[uid];
        if (!prof || !prof.email) return;
        var email = emailToPerson(prof.email.toLowerCase());
        PERSONS.forEach(function(person) {
          if (email.includes(person.toLowerCase())) {
            // m00d person cards
            var card = document.querySelector('.tp-person[data-person="' + person + '"]');
            if (card) {
              var avEl = card.querySelector('.tp-person-avatar');
              if (avEl && prof.avatar) { avEl.textContent = prof.avatar; avEl.style.fontSize = '28px'; }
              var nameEl = card.querySelector('.tp-person-name');
              if (nameEl && prof.displayName) nameEl.textContent = prof.displayName;
            }
            // DM sidebar — update BOTH avatar AND name
            var dmChannelEl = document.querySelector('[data-dm-target="' + person.toLowerCase() + '"]');
            if (dmChannelEl) {
              var dmAvEl = dmChannelEl.querySelector('.chat-dm-avatar');
              if (dmAvEl && prof.avatar) dmAvEl.textContent = prof.avatar;
              // Update DM sidebar display name
              var dmNameSpans = dmChannelEl.querySelectorAll('span');
              dmNameSpans.forEach(function(sp) {
                if (!sp.classList.contains('chat-dm-avatar') && !sp.classList.contains('chat-dm-dot') &&
                    !sp.classList.contains('chat-dm-unread') && sp.textContent.trim()) {
                  if (prof.displayName && sp.textContent.trim() !== prof.displayName) {
                    sp.textContent = prof.displayName;
                  }
                }
              });
            }
          }
        });
        // Update topbar for current user
        if (currentUser && uid === currentUser.uid) {
          var circle = $('tbAvatarCircle');
          var nameEl = $('tbUserName');
          var av = (prof.avatar && prof.avatar.trim()) ? prof.avatar.trim()
                   : (currentUser.email || 'U').charAt(0).toUpperCase();
          if (circle) {
            var didChange = circle.textContent !== av;
            circle.textContent = av;
            if (didChange) {
              circle.style.transition = 'transform .3s cubic-bezier(.34,1.56,.64,1),box-shadow .3s';
              circle.style.transform  = 'scale(1.35)';
              circle.style.boxShadow  = '0 0 18px rgba(247,183,51,.65)';
              setTimeout(function(){ circle.style.transform='scale(1)'; circle.style.boxShadow=''; }, 340);
            }
          }
          if (nameEl && prof.displayName) nameEl.textContent = prof.displayName;
        }
      });
      // Re-render chat messages to reflect updated names/avatars
      if (typeof subscribeChatChannel === 'function' && _chatInitialized) {
        subscribeChatChannel();
      }
    }

    // Hook into setAuthUI to init profile after login
    var _origSetAuthUI2 = setAuthUI;
    setAuthUI = function(isLoggedIn, user) {
      _origSetAuthUI2(isLoggedIn, user);
      if (isLoggedIn) {
        // Instantly restore cached profile data (before Firebase responds)
        try {
          var cached = localStorage.getItem('szafer_profiles_cache');
          if (cached) {
            var parsedCache = JSON.parse(cached);
            if (parsedCache && typeof parsedCache === 'object') {
              _profileData = parsedCache;
              applyProfilesToUI();
            }
          }
        } catch(e) {}
        setTimeout(function() { initProfileSystem(); }, 500);
      } else {
        // Reset so initProfileSystem re-subscribes on next login
        initProfileSystem._done = false;
        if (_profileUnsub) { _profileUnsub(); _profileUnsub = null; }
      }
    };

    // ══════════════════════════════════════════════
    // ═══ TIBIA TAB ═══
    // ══════════════════════════════════════════════
    (function initTibiaTab() {
      var tibiaWindow = null;
      var tibiaCheckInterval = null;
      var launchBtn = $('tibiaLaunchBtn');
      var statusEl = $('tibiaWindowStatus');
      var charBtn = $('tibiaCharBtn');
      var charInput = $('tibiaCharName');
      var charResult = $('tibiaCharResult');

      // ─── Particles ───
      var particleWrap = $('tibiaParticles');
      if (particleWrap) {
        var cols = ['rgba(139,69,19,.2)','rgba(34,139,34,.15)','rgba(212,164,76,.15)','rgba(74,222,128,.1)'];
        for (var i = 0; i < 15; i++) {
          var p = document.createElement('div');
          p.className = 'tp-particle';
          p.style.left = (Math.random()*100)+'%';
          var sz = (3+Math.random()*8)+'px';
          p.style.width = sz; p.style.height = sz;
          p.style.background = cols[Math.floor(Math.random()*cols.length)];
          p.style.animationDuration = (5+Math.random()*12)+'s';
          p.style.animationDelay = (Math.random()*6)+'s';
          particleWrap.appendChild(p);
        }
      }

      // ─── Launch popup window ───
      if (launchBtn) {
        launchBtn.addEventListener('click', function() {
          // If window is already open, focus it
          if (tibiaWindow && !tibiaWindow.closed) {
            tibiaWindow.focus();
            return;
          }
          // Calculate popup size and position
          var w = Math.min(1100, screen.availWidth - 100);
          var h = Math.min(750, screen.availHeight - 80);
          var left = Math.round((screen.availWidth - w) / 2);
          var top = Math.round((screen.availHeight - h) / 2);
          tibiaWindow = window.open(
            'https://www.tibia.com/community/?subtopic=webclient',
            'TibiaSzaferPanel',
            'width='+w+',height='+h+',left='+left+',top='+top+',resizable=yes,scrollbars=yes,toolbar=no,menubar=no,location=no,status=no'
          );
          updateWindowStatus();
          // Monitor window state
          if (tibiaCheckInterval) clearInterval(tibiaCheckInterval);
          tibiaCheckInterval = setInterval(updateWindowStatus, 1500);
        });
      }

      function updateWindowStatus() {
        if (!statusEl) return;
        if (tibiaWindow && !tibiaWindow.closed) {
          statusEl.className = 'tibia-window-status is-open';
          statusEl.innerHTML = '<span class="dot"></span> Klient uruchomiony — kliknij ponownie aby wrócić do okna';
        } else {
          statusEl.className = 'tibia-window-status';
          statusEl.innerHTML = '<span class="dot"></span> Klient nieaktywny';
          if (tibiaCheckInterval) { clearInterval(tibiaCheckInterval); tibiaCheckInterval = null; }
        }
      }

      // ─── Character lookup ───
      function lookupChar() {
        var name = (charInput ? charInput.value.trim() : '');
        if (!name) return;
        if (charResult) charResult.innerHTML = '<div style="color:var(--muted);font-size:12px">Szukam...</div>';
        var url = 'https://api.tibiadata.com/v4/character/' + encodeURIComponent(name);
        fetch(url)
          .then(function(r){ return r.json(); })
          .then(function(data) {
            if (!charResult) return;
            if (!data || !data.character || !data.character.character || !data.character.character.name) {
              charResult.innerHTML = '<div style="color:var(--danger)">Nie znaleziono postaci "' + escapeHtml(name) + '".</div>';
              return;
            }
            var ch = data.character.character;
            var deaths = (data.character.deaths || []).slice(0,3);
            var deathHtml = deaths.length ? '<div style="margin-top:8px;font-size:10px;color:var(--muted)">' +
              '<strong>Ostatnie śmierci:</strong><br>' +
              deaths.map(function(d){ return '💀 ' + escapeHtml(d.reason || '').slice(0,80) + ' <span style="opacity:.5">(' + new Date(d.time).toLocaleDateString('pl-PL') + ')</span>'; }).join('<br>') +
              '</div>' : '';
            charResult.innerHTML =
              '<div class="tibia-char-card">' +
                '<div class="tc-name">' + escapeHtml(ch.name) + '</div>' +
                '<div class="tc-meta">' +
                  'Level <strong>' + (ch.level || '?') + '</strong> · ' +
                  escapeHtml(ch.vocation || '?') + ' · ' +
                  '🌍 ' + escapeHtml(ch.world || '?') + ' · ' +
                  (ch.guild ? '🛡️ ' + escapeHtml(ch.guild.name || '') : 'Bez gildii') +
                '</div>' +
                '<div class="tc-meta" style="margin-top:4px">' +
                  'Achievement Points: ' + (ch.achievement_points || 0) + ' · ' +
                  'Status: ' + (ch.online ? '<span style="color:#4ade80">🟢 Online</span>' : '<span style="color:var(--muted)">⚪ Offline</span>') +
                '</div>' +
                deathHtml +
                '<a href="https://www.tibia.com/community/?subtopic=characters&name=' + encodeURIComponent(ch.name) + '" target="_blank" rel="noopener" style="display:inline-block;margin-top:8px;font-size:11px;color:#d4a44c;text-decoration:underline">Pełny profil na tibia.com →</a>' +
              '</div>';
          })
          .catch(function(err) {
            if (charResult) charResult.innerHTML = '<div style="color:var(--danger)">Błąd: ' + escapeHtml(err.message || 'Brak połączenia') + '</div>';
          });
      }

      if (charBtn) charBtn.addEventListener('click', lookupChar);
      if (charInput) charInput.addEventListener('keydown', function(e) { if (e.key === 'Enter') lookupChar(); });
    })()
    // ── New-version update toast ──────────────────────────
    function showVersionUpdateToast() {
      var SEEN_KEY = 'szafer-seen-v10.4';
      try { if (localStorage.getItem(SEEN_KEY)) return; } catch(e){}
      var toast = document.getElementById('szaferUpdateToast');
      if (!toast) return;
      toast.classList.add('show');
      var clBtn = toast.querySelector('.szafer-update-toast-btn');
      if (clBtn) clBtn.addEventListener('click', function() {
        hideVersionUpdateToast();
        setTimeout(function() {
          var btn = document.getElementById('changelogOpenBtn');
          if (btn) btn.click();
        }, 300);
      });
      // Auto-hide after 12s
      setTimeout(hideVersionUpdateToast, 12000);
    }
    function hideVersionUpdateToast() {
      var toast = document.getElementById('szaferUpdateToast');
      if (!toast) return;
      toast.classList.remove('show');
      try { localStorage.setItem('szafer-seen-v10.4', '1'); } catch(e){}
    }
;