// Zbieracz promocji Stokrotka (stokrotka.pl) dla Jem Bezpiecznie. Autor: MT.
//
// collect() zwraca [] – na stronie sieci nie ma cen w formie tekstu (stan na 2026-10-25):
// - /oferta/ -> /oferta/gazetki-promocyjne/: gazetki (Supermarket, Market, Express, katalogi)
//   to przeglądarka stron-obrazków ładowana przez /IAJAX/ (zabronione w robots.txt) oraz pliki PDF
//   do pobrania (/download-file,...html, ok. 14 MB – grafika gazetki). Nie pobieramy ich.
// - /oferta/akcje-promocyjne/ (Specjał Tygodnia, STOkrotne Okazje itd.): kafelki-obrazki, treść
//   ładowana przez /IAJAX/ albo załącznik PDF – brak cen w HTML.
// - /aktualnosci/: brak bieżących artykułów z cenami.
// Zewnętrznych agregatorów (np. mojagazetka.com) nie używamy.
// Funkcja wykonuje jedno zapytanie, żeby w logu podać okres ważności bieżących gazetek
// (przydatne do monitorowania, czy sieć zaczęła publikować ceny tekstowo).

export const chain = 'Stokrotka';
const BASE = 'https://stokrotka.pl';
export const sourceUrls = [`${BASE}/oferta/gazetki-promocyjne/`, `${BASE}/oferta/akcje-promocyjne/`];

const UA = 'JemBezpiecznieBot/0.1 (+https://jem-bezpiecznie-test-iron-war.vercel.app)';

export async function collect() {
  try {
    const res = await fetch(`${BASE}/oferta/gazetki-promocyjne/`, {
      headers: { 'User-Agent': UA, 'Accept': 'text/html', 'Accept-Language': 'pl-PL,pl;q=0.9' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();
    const plain = html.replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
    const leaflets = [...new Set([...plain.matchAll(/AKTUALNA GAZETKA OD\s+(\d{1,2}-\d{1,2}-\d{4})\s+DO\s+(\d{1,2}-\d{1,2}-\d{4})/g)]
      .map((m) => `${m[1]} – ${m[2]}`))];
    const hasPrices = /\d+,\d{2}\s*zł/.test(plain);
    console.error(`[Stokrotka] brak cen tekstowych na stronie sieci (gazetki tylko jako obrazy/PDF)` +
      (leaflets.length ? `; bieżące gazetki: ${leaflets.join('; ')}` : '') +
      (hasPrices ? '; UWAGA: na stronie gazetek pojawiły się ceny w tekście – sprawdź parser' : ''));
    return [];
  } catch (e) {
    console.error(`[Stokrotka] błąd: ${e.message}`);
    return [];
  }
}
