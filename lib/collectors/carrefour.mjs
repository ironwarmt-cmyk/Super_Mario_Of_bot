// Zbieracz promocji Carrefour – autor: MT
// STATUS: zablokowane – collect() zwraca [].
// Rozpoznanie (2026-10-25):
// - robots.txt carrefour.pl jest dostępny (zakazuje m.in. /szukaj, /koszyk, /moje-konto).
// - https://www.carrefour.pl/ i https://www.carrefour.pl/promocje zwracają HTTP 403 ze stroną
//   "Just a moment..." (wyzwanie JavaScript Cloudflare) – dla UA JemBezpiecznieBot oraz dla zwykłego
//   UA przeglądarki mobilnej (jedna próba).
// - Zgodnie z kontraktem nie obchodzimy blokady (bez proxy, rotacji, rozwiązywania wyzwań JS).
// collect() wykonuje jedno zapytanie kontrolne; gdy blokada zniknie, trzeba dopisać parser.

export const chain = 'Carrefour';
export const sourceUrls = ['https://www.carrefour.pl/promocje'];
const UA = 'JemBezpiecznieBot/0.1 (+https://jem-bezpiecznie-test-iron-war.vercel.app)';

export async function collect() {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    const r = await fetch(sourceUrls[0], { headers: { 'User-Agent': UA }, signal: ctrl.signal });
    clearTimeout(t);
    const body = await r.text();
    if (r.status === 403 || /Just a moment|challenge-platform|cf-chl/i.test(body)) {
      console.error(`[carrefour] HTTP ${r.status} – ochrona Cloudflare, nie obchodzimy – zwracam []`);
    } else {
      console.error(`[carrefour] HTTP ${r.status} – strona dostępna, ale parser nie jest jeszcze zaimplementowany – zwracam []`);
    }
  } catch (e) {
    console.error('[carrefour] błąd:', e.message);
  }
  return [];
}
