# Szafer Panel v10.3

Panel zarządzania dla ekipy Szafer — planer, zadania, chat, harmonogram, Tibia.

## Struktura projektu

```
szafer-panel/
├── index.html         ← Główna strona
├── manifest.json      ← PWA manifest
├── sw.js              ← Service Worker (push notifications)
├── netlify.toml       ← Konfiguracja Netlify
├── css/
│   └── style.css      ← Wszystkie style
└── js/
    ├── app.js         ← Główna logika (Firebase, kalendarz, itp.)
    └── ui.js          ← UI: m00d modal, changelog, harmonogram, iOS guide
```

## Deploy na Netlify

1. Wrzuć repo na GitHub
2. Netlify → New site → Import from GitHub
3. Wybierz repo → **Deploy site** (netlify.toml skonfiguruje resztę)
4. Netlify automatycznie doda HTTPS

## Push notifications na iOS

Wymagania:
- iOS 16.4 lub nowszy
- Safari (nie Chrome/Firefox)
- Strona dodana do ekranu głównego (Udostępnij → Dodaj do ekranu głównego)
- Otwórz z ikony, zaloguj się, kliknij przycisk Push

Szczegółowy poradnik dostępny w panelu: Lista Zmian → v10.3 → "Poradnik: Jak włączyć push na iOS"

## Changelog

### v10.3 (06.04.2026)
- ✅ **Service Worker** — push działa na telefonie (Android + iOS 16.4+ PWA)
- ✅ **sendPushNotification** — hierarchia SW → fallback desktop
- ✅ **Reset _pushInitDone** przy wylogowaniu
- ✅ **manifest.json** — zewnętrzny plik (wymagane dla SW)
- ✅ **Podział na pliki** — GitHub + Netlify ready
- ✅ **CSS cleanup** — usunięto 2 zduplikowane reguły .btn-cl-badge
- ✅ **iOS Push Guide** — animowany poradnik krok po kroku
- ✅ **Update toast** — powiadomienie o nowej wersji przy logowaniu
