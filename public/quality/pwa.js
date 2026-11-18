/* QA Support – rejestracja aplikacji i instalacja (MT) */
(function () {
  // Aplikacja wymaga konta: bez zalogowania przekierowanie do logowania / rejestracji.
  try {
    var path = location.pathname;
    var open = /^\/(quality\/)?(login|reset|link|offline)/.test(path) || /access_token=/.test(location.hash || "");
    if (!open) {
      var s = JSON.parse(localStorage.getItem("quality_web_session_v4") || "null");
      var ok = s && s.access_token && (s.refresh_token || Number(s.expires_at || 0) > Date.now() / 1000);
      if (!ok) { location.replace("/login?next=" + encodeURIComponent(path + location.search + location.hash)); return; }
    }
  } catch (e) {}
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(function () {});
    });
  }
  var deferred = null;
  var ua = navigator.userAgent || "";
  var isIOS = /iphone|ipad|ipod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  var standalone = window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;

  function buttons() { return document.querySelectorAll("[data-pwa-install]"); }
  function show(on) { buttons().forEach(function (b) { b.hidden = !on; }); }
  function hint(text) {
    var el = document.querySelector("[data-pwa-hint]");
    if (el) { el.textContent = text; el.hidden = false; }
  }

  window.addEventListener("beforeinstallprompt", function (e) {
    e.preventDefault(); deferred = e; show(true);
  });
  window.addEventListener("appinstalled", function () {
    deferred = null; show(false); hint("Aplikacja QA Support została zainstalowana.");
  });

  document.addEventListener("click", function (e) {
    var btn = e.target.closest && e.target.closest("[data-pwa-install]");
    if (!btn) return;
    e.preventDefault();
    if (deferred) {
      deferred.prompt();
      deferred.userChoice.finally(function () { deferred = null; show(false); });
    } else if (isIOS) {
      hint("Na iPhonie/iPadzie: otwórz stronę w Safari, stuknij „Udostępnij” (kwadrat ze strzałką), a potem „Do ekranu początkowego”.");
    } else {
      hint("Użyj menu przeglądarki i wybierz „Zainstaluj aplikację” lub „Dodaj do ekranu głównego”.");
    }
  });

  document.addEventListener("DOMContentLoaded", function () {
    if (standalone) { show(false); return; }
    if (isIOS) show(true);
  });
})();
