// Zbieracz promocji Kaufland – autor: MT
// STATUS: zablokowane – collect() zwraca [].
// Rozpoznanie (2026-10-25):
// - https://www.kaufland.pl/robots.txt oraz https://www.kaufland.pl/oferta/aktualny-tydzien.html
//   zwracają HTTP 403 ze stroną "Kaufland.pl - Wymagana weryfikacja" (captcha / ochrona antybotowa),
//   zarówno dla UA JemBezpiecznieBot, jak i dla zwykłego UA przeglądarki mobilnej (jedna próba).
// - Zgodnie z kontraktem nie obchodzimy blokady (bez proxy, rotacji, łamania captcha).
// collect() wykonuje jedno zapytanie kontrolne; gdy blokada zniknie, trzeba dopisać parser.

export const chain = 'Kaufland';
export const sourceUrls = ['https://www.kaufland.pl/oferta/aktualny-tydzien.html'];
const UA = 'JemBezpiecznieBot/0.1 (+https://jem-bezpiecznie-test-iron-war.vercel.app)';

export async function collect() {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    const r = await fetch(sourceUrls[0], { headers: { 'User-Agent': UA }, signal: ctrl.signal });
    clearTimeout(t);
    const body = await r.text();
    if (r.status === 403 || /Wymagana weryfikacja|captcha/i.test(body)) {
      console.error(`[kaufland] HTTP ${r.status} – ochrona antybotowa/captcha, nie obchodzimy – zwracam []`);
    } else {
      console.error(`[kaufland] HTTP ${r.status} – strona dostępna, ale parser nie jest jeszcze zaimplementowany – zwracam []`);
    }
  } catch (e) {
    console.error('[kaufland] błąd:', e.message);
  }
  return [];
}
