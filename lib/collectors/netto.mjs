// Zbieracz promocji Netto – autor: MT
// STATUS: brak danych tekstowych – collect() zwraca [].
// Rozpoznanie (2026-10-25):
// - robots.txt netto.pl: Allow: / (brak zakazów).
// - https://netto.pl/gazetka-netto/ (także z ?leafletid=...) zawiera tylko metadane gazetek
//   (np. "Netto Gazetka T44A Food 2026", ważność 26.10–31.10.2026, liczba ofert 283) oraz obrazki stron.
//   W HTML nie ma nazw produktów ani cen (brak warstwy tekstowej).
// - Oferty ładuje dopiero skrypt przeglądarki z zewnętrznego API dostawcy gazetek (Tjek / squid-api.tjek.com),
//   wymagającego klucza API. Zgodnie z kontraktem nie używamy kluczy wyciągniętych z kodu strony
//   ani nie odczytujemy cen z obrazków – dlatego brak ofert.
// - Sitemap netto.pl nie zawiera stron produktów/promocji z cenami w tekście.
// Możliwa droga legalna: uzyskanie od Netto/Salling Group oficjalnego dostępu do API ofert.

export const chain = 'Netto';
export const sourceUrls = ['https://netto.pl/gazetka-netto/'];

export async function collect() {
  console.error('[netto] brak publicznej warstwy tekstowej z cenami (gazetka tylko jako obrazki, oferty przez API z kluczem) – zwracam []');
  return [];
}
