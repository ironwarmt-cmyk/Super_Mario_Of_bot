/* QA Support – rejestracja aplikacji i instalacja (MT) */
(function () {
  // Aplikacja wymaga konta: bez zalogowania przekierowanie do logowania / rejestracji.
  try {
    var path = location.pathname;
    var open = /^\/(quality\/)?(login|reset|link|offline|potwierdz)/.test(path) || /access_token=/.test(location.hash || "");
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

/* QA Support – wspólny pasek z przyciskiem „Wstecz” i bezpieczne marginesy ekranu (MT, 24.11.2026) */
(function () {
  if (window.__qaShell) return; window.__qaShell = true;
  var embedded = false; try { embedded = window.self !== window.top; } catch (e) { embedded = true; }
  var path = location.pathname.replace(/\/+$/, "/");
  var isHub = /^\/(quality\/?|app\/?)?$/.test(path) || path === "/quality/";
  var noBar = /^\/(quality\/)?(potwierdz|offline)/.test(path);

  var css = [
    "html{overflow-x:clip;-webkit-text-size-adjust:100%}",
    "body{padding-left:env(safe-area-inset-left,0px);padding-right:env(safe-area-inset-right,0px)}",
    "body.qa-no-bar{padding-top:env(safe-area-inset-top,0px)}",
    ".qa-topbar{position:sticky;top:0;z-index:95;display:flex;align-items:center;gap:10px;margin:0 calc(-1*env(safe-area-inset-right,0px)) 0 calc(-1*env(safe-area-inset-left,0px));padding:calc(env(safe-area-inset-top,0px) + 8px) calc(12px + env(safe-area-inset-right,0px)) 8px calc(12px + env(safe-area-inset-left,0px));background:rgba(9,7,19,.88);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);border-bottom:1px solid rgba(143,107,255,.25)}",
    ".qa-topbar button,.qa-topbar a{display:inline-flex;align-items:center;gap:6px;min-height:40px;padding:8px 14px;border-radius:999px;border:1px solid rgba(143,107,255,.45);background:rgba(29,23,54,.9);color:#fbf8ff;font:800 14px/1 system-ui,-apple-system,'Segoe UI',sans-serif;text-decoration:none;cursor:pointer}",
    ".qa-topbar .qa-topbar-title{flex:1;min-width:0;font:900 11px/1.2 system-ui,sans-serif;letter-spacing:.08em;color:#ff72df;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
    ".qa-topbar .qa-topbar-home{padding:8px 12px}",
    ".top{flex-wrap:wrap;row-gap:10px}.top .lang{display:flex;flex-wrap:wrap;gap:6px}.top .lang button{margin-left:0;min-height:36px}",
    ".qa-dock{bottom:calc(8px + env(safe-area-inset-bottom,0px))!important}",
    ".qa-feedback-fab{bottom:calc(84px + env(safe-area-inset-bottom,0px))!important}",
    ".qa-ambient{bottom:calc(84px + env(safe-area-inset-bottom,0px))!important}",
    "body.qa-has-dock{padding-bottom:calc(150px + env(safe-area-inset-bottom,0px))!important}",
    ".qa-modal-backdrop{padding:calc(16px + env(safe-area-inset-top,0px)) calc(16px + env(safe-area-inset-right,0px)) calc(16px + env(safe-area-inset-bottom,0px)) calc(16px + env(safe-area-inset-left,0px))!important}",
    ".qa-modal{max-height:100%;overflow:auto}",
    ".qa-error-drawer{bottom:calc(84px + env(safe-area-inset-bottom,0px))!important;max-width:calc(100% - 20px)}"
  ].join("");
  var st = document.createElement("style"); st.id = "qa-shell-css"; st.textContent = css;
  (document.head || document.documentElement).appendChild(st);

  function goBack() {
    var sameOrigin = false;
    try { sameOrigin = document.referrer && new URL(document.referrer).origin === location.origin; } catch (e) {}
    if (history.length > 1 && (sameOrigin || embedded)) { history.back(); return; }
    location.href = isHub ? "https://jembezpiecznie.com/" : "/app";
  }
  window.QAGoBack = goBack;

  function mount() {
    var body = document.body; if (!body) return;
    var hideBar = noBar || (isHub && embedded);
    if (hideBar) { body.classList.add("qa-no-bar"); }
    else if (!document.querySelector(".qa-topbar")) {
      var bar = document.createElement("div");
      bar.className = "qa-topbar"; bar.setAttribute("role", "navigation"); bar.setAttribute("aria-label", "Nawigacja wstecz");
      var back = document.createElement("button"); back.type = "button";
      back.textContent = isHub ? "← Strona JB" : "← Wstecz";
      back.setAttribute("aria-label", isHub ? "Wróć na stronę jembezpiecznie.com" : "Wróć do poprzedniego ekranu");
      back.addEventListener("click", goBack);
      var title = document.createElement("span"); title.className = "qa-topbar-title"; title.textContent = "QA SUPPORT";
      bar.appendChild(back); bar.appendChild(title);
      if (!isHub) { var home = document.createElement("a"); home.className = "qa-topbar-home"; home.href = "/app"; home.textContent = "⌂"; home.setAttribute("aria-label", "Pulpit QA Support"); bar.appendChild(home); }
      body.insertBefore(bar, body.firstChild);
    }
    var markDock = function () { body.classList.toggle("qa-has-dock", !!document.querySelector(".qa-dock")); };
    markDock(); setTimeout(markDock, 600); setTimeout(markDock, 2500);
    // Pola tekstowe nie chowają się za klawiaturą ani za dolnym paskiem.
    document.addEventListener("focusin", function (e) {
      var t = e.target; if (!t || !/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
      setTimeout(function () { try { t.scrollIntoView({ block: "center", behavior: "smooth" }); } catch (_) {} }, 300);
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount); else mount();
})();
