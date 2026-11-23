// Sekcja „Moje certyfikaty” – lista certyfikatów ukończenia szkoleń zalogowanego użytkownika. Autor: MT
// Użycie: <div id="qa-certificates"></div><script defer src="/quality/certyfikaty.js"></script>
(function () {
  var URL_FN = "https://ixivedtgqgryawxsxnqd.supabase.co/functions/v1/quality-certificate";
  var esc = function (s) { return String(s == null ? "" : s).replace(/[<>&"]/g, function (c) { return { "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c]; }); };
  var css = "#qa-certificates{margin:24px 0}.qac{background:linear-gradient(135deg,#141b3d,#0d1430);border:1px solid #c9a74a66;border-radius:18px;padding:18px;color:#f5f7fa}" +
    ".qac h2{margin:6px 0 12px;font-size:20px}.qac .eye{color:#e8c66a;font-weight:800;letter-spacing:.14em;font-size:12px;text-transform:uppercase}" +
    ".qac ul{list-style:none;margin:0;padding:0}.qac li{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid #ffffff14}.qac li:last-child{border:0}" +
    ".qac small{color:#9eb0c1;display:block}.qac a.b{flex:none;padding:9px 14px;border-radius:12px;background:#e8c66a;color:#141b3d;font-weight:900;text-decoration:none}.qac .m{color:#9eb0c1}";
  function box(inner) {
    var el = document.getElementById("qa-certificates");
    if (!el) return;
    el.innerHTML = '<div class="qac"><div class="eye">Moje certyfikaty</div><h2>Certyfikaty ukończenia szkoleń</h2>' + inner + "</div>";
  }
  async function run() {
    var el = document.getElementById("qa-certificates");
    if (!el) return;
    var st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);
    box('<p class="m">Wczytuję…</p>');
    try {
      if (!window.QualityAuth || !(await window.QualityAuth.isAuthenticated())) { box('<p class="m">Zaloguj się, aby zobaczyć swoje certyfikaty.</p>'); return; }
      var headers = await window.QualityAuth.headers({});
      var r = await fetch(URL_FN + "?mine=1", { headers: headers });
      var d = await r.json().catch(function () { return {}; });
      if (!r.ok || d.ok === false) {
        var msg = d.error || ("Błąd " + r.status);
        if (/imię|nazwisk/i.test(msg)) msg += ' <a href="/quality/account/" style="color:#e8c66a;font-weight:800">Uzupełnij profil →</a>';
        else msg = esc(msg);
        box('<p class="m">' + msg + "</p>"); return;
      }
      var list = d.certificates || d.data || [];
      if (!list.length) { box('<p class="m">Nie masz jeszcze certyfikatów. Certyfikat pojawi się tu automatycznie po zakupie szkolenia.</p>'); return; }
      box("<ul>" + list.map(function (c) {
        var date = c.issued_at ? new Date(c.issued_at).toLocaleDateString("pl-PL") : "";
        var link = c.pdf_url || c.url || (URL_FN + "?no=" + encodeURIComponent(c.number || c.no) + "&t=" + encodeURIComponent(c.token || c.t || ""));
        return "<li><div><b>" + esc(c.training_title || c.title) + "</b><small>Nr " + esc(c.number || c.no) + (date ? " · " + date : "") + "</small></div>" +
          '<a class="b" href="' + esc(link) + '" target="_blank" rel="noopener">Pobierz PDF</a></li>';
      }).join("") + "</ul>");
    } catch (e) { box('<p class="m">Nie udało się wczytać certyfikatów. Spróbuj ponownie później.</p>'); }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", run, { once: true }); else run();
})();
