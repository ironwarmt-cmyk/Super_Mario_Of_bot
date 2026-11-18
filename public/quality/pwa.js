/* QA Support – rejestracja aplikacji i instalacja (MT) */
(function () {
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
