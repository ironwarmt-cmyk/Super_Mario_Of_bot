// Zbieracz cen promocyjnych: Biedronka (biedronka.pl)
// Autor: MT
//
// STATUS: collect() celowo zwraca [].
//
// Przyczyna (rozpoznanie z 2026-10-25):
// - /pl/nowa-oferta zawiera tylko kafelki z linkami do gazetek (/pl/press,id,...) i daty,
//   bez nazw produktów i cen.
// - /pl/oferta-z-karta-moja-biedronka przekierowuje (301) na /pl – brak osobnej listy ofert.
// - Strony /pl/owoce-warzywa, /pl/w-tym-tygodniu itp. przekierowują do gazetek.
// - Gazetki (/pl/press,...) są wyświetlane przez widżet cdn.biedronka.cloud/leaflet-widget,
//   który pobiera https://leaflet-api.prod.biedronka.cloud/api/leaflets/<uuid>?ctx=web.
//   Ta odpowiedź zawiera WYŁĄCZNIE adresy obrazków stron (images_desktop / images_mobile),
//   bez warstwy tekstowej, hotspotów, nazw ani cen.
// - moja.biedronka.pl publicznie pokazuje tylko opis programu; oferty z kartą są
//   w aplikacji po zalogowaniu.
// Kontrakt zabrania pobierania obrazków gazetek i obchodzenia ograniczeń, więc nie ma
// publicznego, tekstowego źródła cen. Gdy Biedronka udostępni ceny tekstem, oferty
// „z kartą Moja Biedronka” muszą mieć conditions = 'z kartą Moja Biedronka'.
// robots.txt: Disallow /front/search*, /pl/search* (nieużywane).

export const chain = 'Biedronka';
export const sourceUrls = [
  'https://www.biedronka.pl/pl/nowa-oferta',
  'https://www.biedronka.pl/pl/oferta-z-karta-moja-biedronka',
  'https://www.biedronka.pl/pl/gazetki',
];

export async function collect() {
  console.error('[Biedronka] brak cen w formie tekstu – gazetki publikowane wyłącznie jako obrazki; zwracam []');
  return [];
}
