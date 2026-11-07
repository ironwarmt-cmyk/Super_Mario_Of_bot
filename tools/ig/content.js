// Banki treści rolek Instagram Jem Bezpiecznie / QASUPPORT.
// Zasady: tylko prawdziwe funkcje strony/aplikacji/grup; bez słów „bot”, „agent”, „AI”.
const S = 'jembezpiecznie.com', Q = 'qasupport.jembezpiecznie.com';
export const TAGS = {
  site: '#bezpieczeństwożywności #jembezpiecznie #etykiety #wycofania #GIS #świadomyklient #zdrowejedzenie #żywność',
  app: '#QASUPPORT #jakośćżywności #HACCP #BRCGS #IFSFood #audyt #CAPA #foodsafety #działjakości',
  tg: '#QASUPPORT #społeczność #telegram #jakośćżywności #HACCP #audyt #foodsafety #jembezpiecznie',
  fact: '#bezpieczeństwożywności #wiedza #jembezpiecznie #etykiety #kuchnia #zdrowie #żywność #ciekawostki',
};
const end = (title, cta, url = S, sub) => ({ kind: 'end', d: 3, title, cta, url, sub });
const QA = { brand: 'QASUPPORT', brandSub: 'quality assurance support', url: Q };
const TG = { brand: 'QASUPPORT', brandSub: 'społeczność na Telegramie', url: S };

export const SITE = [
 { accent: '#ff8a8a', scenes: [
   { kind: 'hook', eyebrow: 'Alerty Jem Bezpiecznie', title: 'Produkt *wycofany?*', sub: 'Dowiesz się od razu, a nie z wiadomości tydzień później.' },
   { kind: 'list', eyebrow: 'Każdy alert zawiera', title: 'Cztery *konkrety*', small: 1, items: [{ t: 'Co wycofano' }, { t: 'Numer partii i data' }, { t: 'Dlaczego' }, { t: 'Co masz zrobić' }] },
   { kind: 'chips', eyebrow: 'Źródło', title: 'Tylko *oficjalne* komunikaty', small: 1, items: ['GIS', 'Inspekcja Weterynaryjna', 'RASFF'] },
   end('Wiesz, *co jesz.*', 'Zobacz alerty')],
   caption: 'Produkt wycofany z rynku? Dowiesz się od razu. 🚨\n\nKażdy nasz alert mówi, co wycofano, którego numeru partii dotyczy, dlaczego i co masz zrobić. Opieramy się wyłącznie na oficjalnych komunikatach.\n\n👉 jembezpiecznie.com (link w bio)' },
 { accent: '#c9b3ff', scenes: [
   { kind: 'hook', eyebrow: 'Etykiety kontra przepisy', title: 'Drobny druk *po ludzku*' },
   { kind: 'list', eyebrow: 'Sprawdzamy punkt po punkcie', title: 'Co mówi *etykieta*', small: 1, items: [{ t: 'Nazwa i skład' }, { t: 'Alergeny' }, { t: 'Daty' }, { t: 'Wartość odżywcza' }] },
   { kind: 'big', eyebrow: 'Przy każdej uwadze', big: '§ *przepis*', src: 'np. rozporządzenie (UE) nr 1169/2011' },
   end('Czytaj *analizy*', 'Wejdź na stronę')],
   caption: 'Co naprawdę mówi etykieta? 🏷\n\nBierzemy konkretny produkt i sprawdzamy go punkt po punkcie. Przy każdej uwadze podajemy przepis, z którego wynika.\n\n👉 jembezpiecznie.com' },
 { accent: '#5fe3a1', scenes: [
   { kind: 'hook', eyebrow: 'Zweryfikowani dostawcy', title: 'Sprawdzeni *audytem*' },
   { kind: 'big', eyebrow: 'Na listę', big: 'nie da się *kupić* wejścia', small: 1 },
   { kind: 'list', eyebrow: 'Jak to działa', title: 'Od audytu do *znaku*', small: 1, items: [{ t: 'Audyt dokumentów i zakładu' }, { t: 'Raport z zaleceniami' }, { t: 'Znak Jem Bezpiecznie' }, { t: 'Profil na liście dostawców' }] },
   end('Polskie, *sprawdzone*', 'Oferta dla firm')],
   caption: 'Polscy producenci sprawdzeni tak, jak robią to audytorzy dużych sieci handlowych. ✅\n\nNa listę nie da się kupić wejścia. Pozytywny wynik audytu daje znak Jem Bezpiecznie i profil na liście zweryfikowanych dostawców.\n\n👉 jembezpiecznie.com' },
 { accent: '#4ff0e0', scenes: [
   { kind: 'hook', eyebrow: 'Asystent Jem Bezpiecznie', title: 'Zapytaj *po polsku*' },
   { kind: 'chat', eyebrow: 'Na przykład', items: [{ me: 'Co znaczy E330?' }, { as: '*E330 to kwas cytrynowy* – dozwolony dodatek regulujący kwasowość.' }] },
   { kind: 'chips', eyebrow: 'Pytaj o', title: 'Skład, alergeny, *prawa*', small: 1, items: ['Etykieta', 'Rodzaj żywności', 'Prawa konsumenta'] },
   end('Odpowiada *całą dobę*', 'Zadaj pytanie')],
   caption: 'Nie wiesz, co oznacza symbol na etykiecie? Zapytaj. 💬\n\nAsystent na jembezpiecznie.com wyjaśnia skład, alergeny i Twoje prawa konsumenta, prosto i po polsku, o każdej porze.\n\n👉 jembezpiecznie.com' },
 { accent: '#4ff0e0', scenes: [
   { kind: 'hook', eyebrow: 'Newsletter · bezpłatnie', title: 'Wtorek i piątek *w skrzynce*' },
   { kind: 'list', eyebrow: 'W każdym wydaniu', title: 'Co *ważne*', small: 1, items: [{ t: 'Ostrzeżenia GIS' }, { t: 'Nowe przepisy' }, { t: 'Nadchodzące zmiany' }] },
   { kind: 'big', eyebrow: 'Wypisanie', big: '1 *klik*' },
   end('Zapisz się *za darmo*', 'Zapisz się')],
   caption: 'Dwa razy w tygodniu najważniejsze informacje o bezpieczeństwie żywności w Polsce. 📬\n\nOstrzeżenia GIS, nowe przepisy i zmiany, które dopiero nadchodzą. Z linkiem do każdego źródła.\n\n👉 Zapisz się na jembezpiecznie.com' },
 { accent: '#e9d6a8', scenes: [
   { kind: 'hook', eyebrow: 'Ważne strony', title: 'Tylko *oryginalne* źródła' },
   { kind: 'chips', eyebrow: 'Polska', title: 'Urzędy i *inspekcje*', small: 1, items: ['GIS', 'IJHARS', 'Inspekcja Weterynaryjna', 'PIORiN'] },
   { kind: 'chips', eyebrow: 'UE i certyfikacja', title: 'Europa i *GFSI*', small: 1, items: ['EFSA', 'RASFF', 'Komisja Europejska', 'BRCGS', 'IFS', 'FSSC 22000'] },
   end('Wszystko *w jednym* miejscu', 'Zobacz listę')],
   caption: 'Gdzie szukać pewnych informacji o żywności? 🔗\n\nZebraliśmy tylko oryginalne strony: polskie urzędy i inspekcje, instytucje UE oraz programy certyfikacji uznane przez GFSI.\n\n👉 Sekcja „Ważne strony” na jembezpiecznie.com' },
 { accent: '#4ff0e0', scenes: [
   { kind: 'hook', eyebrow: 'Portal członka', title: 'Jedno *logowanie*' },
   { kind: 'list', eyebrow: 'Dostęp do', title: 'Trzech *miejsc*', small: 1, items: [{ t: 'Strona', d: 'Raporty, analizy, asystent' }, { t: 'Aplikacja QASUPPORT', d: 'Dokumenty, szkolenia, Copilot' }, { t: 'Grupy na Telegramie', d: 'Twój nick i tag pakietu' }] },
   { kind: 'big', eyebrow: 'Start', big: '0 *zł*' },
   end('Załóż *konto*', 'Załóż konto')],
   caption: 'Jedno konto, trzy miejsca. 🔑\n\nLogujesz się w Portalu na jembezpiecznie.com i masz dostęp do strony, aplikacji QASUPPORT i grup na Telegramie. Zaczynasz za darmo.\n\n👉 jembezpiecznie.com' },
 { accent: '#e9d6a8', scenes: [
   { kind: 'hook', eyebrow: 'Pakiety członkowskie', title: 'Wybierz *swój* poziom' },
   { kind: 'tiers', eyebrow: 'Miesięcznie', items: [{ k: 'free', p: '0 zł', d: 'Alerty, asystent, grupa FREE' }, { k: 'basic', p: '49,99', u: 'zł', d: 'Dokumenty, HACCP, szkolenia' }, { k: 'pro', p: '149,99', u: 'zł', d: 'BRCGS, IFS, audyty, CAPA' }, { k: 'vip', p: '399,99', u: 'zł', d: 'Strefa ekspercka' }] },
   { kind: 'big', eyebrow: 'Bez zobowiązań', big: 'zmień *kiedy chcesz*', small: 1 },
   end('Jedno konto, *cztery* pakiety', 'Wybierz pakiet')],
   caption: 'FREE, BASIC, PRO czy VIP? 🔑\n\nFREE 0 zł · BASIC 49,99 zł · PRO 149,99 zł · VIP 399,99 zł miesięcznie. Jedno konto działa na stronie, w aplikacji QASUPPORT i w grupach na Telegramie.\n\n👉 Portal na jembezpiecznie.com' },
 { accent: '#6fa8ff', scenes: [
   { kind: 'hook', eyebrow: 'Raporty Jem Bezpiecznie', title: 'Cztery *rodzaje* treści' },
   { kind: 'list', eyebrow: 'Na stronie znajdziesz', title: 'Od komunikatu do *analizy*', small: 1, items: [{ t: 'Komunikat', d: 'Szybka informacja' }, { t: 'Analiza', d: 'Produkt pod lupą' }, { t: 'Raport', d: 'Temat w szczegółach' }, { t: 'Alert', d: 'Wycofanie z rynku' }] },
   { kind: 'chips', eyebrow: 'Zawsze', title: 'Ze *źródłem*', small: 1, items: ['GIS', 'EFSA', 'Przepisy UE', 'Prawo polskie'] },
   end('Czytaj *na stronie*', 'Wejdź na stronę')],
   caption: 'Komunikaty, analizy, raporty i alerty. 📑\n\nNa jembezpiecznie.com każda treść ma podane źródło: komunikat GIS, opinię EFSA albo konkretny przepis.\n\n👉 jembezpiecznie.com' },
 { accent: '#5fe3a1', scenes: [
   { kind: 'hook', eyebrow: 'Dla firm', title: 'Wsparcie *jakości*' },
   { kind: 'list', eyebrow: 'Pomagamy w', title: 'Konkretnych *zadaniach*', small: 1, items: [{ t: 'Przygotowanie do certyfikacji' }, { t: 'Weryfikacja etykiet' }, { t: 'Wdrożenie HACCP' }, { t: 'Szkolenia' }, { t: 'Wycofania i reklamacje' }] },
   { kind: 'big', eyebrow: 'Wycena', big: '*indywidualna*', small: 1 },
   end('Porozmawiajmy *o zakładzie*', 'Oferta dla firm')],
   caption: 'Prowadzisz zakład spożywczy? 🏭\n\nPomagamy w przygotowaniu do certyfikacji, weryfikacji etykiet, wdrożeniu HACCP, szkoleniach oraz przy wycofaniach i reklamacjach. Wycena indywidualna.\n\n👉 jembezpiecznie.com' },
];

export const TGB = [
 { accent: '#c08bff', ...TG, scenes: [
   { kind: 'hook', eyebrow: 'Grupy na Telegramie', title: 'Twoja *społeczność* jakości' },
   { kind: 'tags', eyebrow: 'Przy nicku tag pakietu', items: [{ k: 'vip', nick: 'Kasia', m: 'Audyt BRCGS za tydzień' }, { k: 'pro', nick: 'Tomek', m: 'CAPA po niezgodności' }, { k: 'basic', nick: 'Ola', m: 'Wzór rejestru temperatur' }, { k: 'free', nick: 'Marek', m: 'Nowy alert GIS' }] },
   { kind: 'big', eyebrow: 'Codziennie', big: 'nowe *materiały*', small: 1, sub: 'w każdym wątku każdej grupy' },
   end('Dołącz *za darmo*', 'Załóż konto')],
   caption: 'Dział jakości nie musi działać w pojedynkę. 💬\n\nW grupach QASUPPORT na Telegramie codziennie pojawiają się nowe materiały w każdym wątku. Przy nicku widzisz kolorowy tag pakietu.\n\n👉 Darmowe konto: jembezpiecznie.com' },
 { accent: '#cfd6f2', ...TG, scenes: [
   { kind: 'hook', eyebrow: 'Grupa FREE', title: 'Zacznij *od zera* złotych' },
   { kind: 'list', eyebrow: 'Wątki', title: 'Co jest *w grupie*', small: 1, items: [{ t: '👋 Powitalnia' }, { t: '📢 Ogłoszenia' }, { t: '🚨 Alerty GIS i wycofania' }, { t: '💬 Pytania ogólne' }, { t: '🎮 Myszka Audytorka' }] },
   end('Dołącz *do grupy*', 'Załóż konto')],
   caption: 'Bezpłatna grupa FREE na Telegramie. 👋\n\nPowitalnia, ogłoszenia, alerty GIS i wycofania, pytania ogólne oraz gra Myszka Audytorka. Wystarczy darmowe konto w Portalu.\n\n👉 jembezpiecznie.com' },
 { accent: '#5fe3a1', ...TG, scenes: [
   { kind: 'hook', eyebrow: 'Grupa BASIC', title: 'Solidne *podstawy*' },
   { kind: 'list', eyebrow: 'Wątki', title: 'Na co *dzień*', small: 1, items: [{ t: '📄 Dokumenty i wzory' }, { t: '🧪 HACCP w praktyce' }, { t: '🎓 Szkolenia podstawowe' }, { t: '❓ Pytania BASIC' }] },
   { kind: 'big', eyebrow: 'Pakiet BASIC', big: '49,99 *zł*', sub: 'miesięcznie, bez zobowiązań' },
   end('Wejdź *na poziom* BASIC', 'Wybierz pakiet')],
   caption: 'Grupa BASIC dla tych, którzy budują podstawy systemu jakości. 🌱\n\nDokumenty i wzory, HACCP w praktyce, szkolenia podstawowe i pytania. Pakiet BASIC: 49,99 zł miesięcznie.\n\n👉 jembezpiecznie.com' },
 { accent: '#6fa8ff', ...TG, scenes: [
   { kind: 'hook', eyebrow: 'Grupa PRO', title: 'Wątki dla *praktyków*' },
   { kind: 'list', eyebrow: 'Wątki', title: 'Standardy i *audyty*', small: 1, items: [{ t: '🏆 BRCGS' }, { t: '🛡 IFS Food' }, { t: '🔍 Audyty i niezgodności' }, { t: '🛠 CAPA' }, { t: '🤝 Dostawcy i reklamacje' }, { t: '🏷 Etykiety i prawo' }] },
   end('Dołącz *do PRO*', 'Wybierz pakiet')],
   caption: 'Grupa PRO dla osób, które na co dzień pilnują standardów. 🏆\n\nBRCGS, IFS Food, audyty i niezgodności, CAPA, dostawcy i reklamacje, etykiety i prawo.\n\n👉 Pakiet PRO w Portalu na jembezpiecznie.com' },
 { accent: '#c08bff', ...TG, scenes: [
   { kind: 'hook', eyebrow: 'Grupa VIP', title: 'Strefa *ekspercka*' },
   { kind: 'list', eyebrow: 'Wątki', title: 'Dla managerów *jakości*', small: 1, items: [{ t: '💎 Strefa ekspercka' }, { t: '📘 Quality Manager Playbook' }, { t: '🧭 Konsultacje i case study' }, { t: '🚑 Emergency – audyt za chwilę' }, { t: '📈 Briefy branżowe' }] },
   end('Poziom *VIP*', 'Wybierz pakiet')],
   caption: 'Grupa VIP dla managerów jakości, którzy chcą więcej. 💎\n\nStrefa ekspercka, Quality Manager Playbook, konsultacje i case study, pomoc przed audytem i briefy branżowe.\n\n👉 Pakiet VIP w Portalu na jembezpiecznie.com' },
 { accent: '#c08bff', ...TG, scenes: [
   { kind: 'hook', eyebrow: 'Jak dołączyć', title: 'Trzy *kroki*' },
   { kind: 'list', eyebrow: 'Krok po kroku', title: 'Od konta do *grupy*', small: 1, items: [{ t: 'Załóż konto w Portalu' }, { t: 'Połącz Telegram' }, { t: 'Wybierz nick' }, { t: 'Wejdź do grup pakietu' }] },
   { kind: 'big', eyebrow: 'Zmienisz pakiet?', big: 'dostęp *zmieni się sam*', small: 1 },
   end('Zacznij *dziś*', 'Załóż konto')],
   caption: 'Jak dołączyć do grup QASUPPORT? 👇\n\n1. Załóż darmowe konto w Portalu\n2. Połącz Telegram jednym kliknięciem\n3. Wybierz nick – dostaniesz tag pakietu\n4. Wchodzisz do grup swojego pakietu\n\n👉 jembezpiecznie.com' },
 { accent: '#e9d6a8', ...TG, scenes: [
   { kind: 'hook', eyebrow: 'Nick i tag', title: 'Widać, *kto jest kim*' },
   { kind: 'tags', eyebrow: 'Przykłady', items: [{ k: 'vip', nick: 'Mario', m: 'VIP Mario' }, { k: 'pro', nick: 'Ania', m: 'PRO Ania' }, { k: 'basic', nick: 'Piotr', m: 'BASIC Piotr' }] },
   { kind: 'big', eyebrow: 'Nick', big: 'wybierasz *sam*', small: 1 },
   end('Dołącz *z nickiem*', 'Załóż konto')],
   caption: 'W grupach QASUPPORT nick wybierasz sam, a obok niego pojawia się kolorowy tag pakietu: FREE, BASIC, PRO albo VIP. 🏷\n\n👉 Załóż konto na jembezpiecznie.com' },
 { accent: '#ff8a8a', ...TG, scenes: [
   { kind: 'hook', eyebrow: 'Alerty na Telegramie', title: 'Wycofania *od razu*' },
   { kind: 'list', eyebrow: 'W grupie FREE', title: 'Alert *krok po kroku*', small: 1, items: [{ t: 'Komunikat GIS' }, { t: 'Opracowanie redakcji' }, { t: 'Post w wątku 🚨 Alerty' }] },
   { kind: 'big', eyebrow: 'Koszt', big: '0 *zł*' },
   end('Bądź *na bieżąco*', 'Dołącz za darmo')],
   caption: 'Alerty o wycofaniach prosto na telefon. 🚨\n\nW bezpłatnej grupie FREE publikujemy ostrzeżenia GIS opracowane przez redakcję Jem Bezpiecznie.\n\n👉 Darmowe konto: jembezpiecznie.com' },
 { accent: '#6fa8ff', ...TG, scenes: [
   { kind: 'hook', eyebrow: 'Codzienne wątki', title: 'Każdy dzień *inny format*' },
   { kind: 'chips', eyebrow: 'W tygodniu', title: 'Praktyka, case, *quiz*', small: 1, items: ['Wymóg w praktyce', 'Case study', 'Checklista', 'Błąd audytowy', 'Quiz'] },
   { kind: 'big', eyebrow: 'Dla każdej grupy', big: 'osobne *tematy*', small: 1 },
   end('Ucz się *codziennie*', 'Dołącz')],
   caption: 'W grupach QASUPPORT codziennie jest coś nowego: wymóg w praktyce, case study, checklista, typowy błąd audytowy albo quiz. 📅\n\n👉 jembezpiecznie.com' },
 { accent: '#5fe3a1', ...TG, scenes: [
   { kind: 'hook', eyebrow: 'Pytanie do społeczności', title: 'Zapytaj *praktyków*' },
   { kind: 'chat', eyebrow: 'W wątku pytań', items: [{ me: 'Jak często weryfikować plan HACCP?' }, { as: 'Przy każdej zmianie procesu, produktu lub sprzętu – i *regularnie*, zgodnie z Twoim systemem.' }] },
   end('Twoje pytanie *czeka*', 'Dołącz za darmo')],
   caption: 'Masz pytanie o HACCP, audyt albo etykietę? Zadaj je w grupie. 💬\n\nW każdej grupie QASUPPORT jest wątek pytań, a odpowiadają osoby, które robią to na co dzień.\n\n👉 jembezpiecznie.com' },
];

export const APP = [
 { accent: '#6fa8ff', ...QA, scenes: [
   { kind: 'hook', eyebrow: 'Aplikacja QASUPPORT', title: 'Jakość w *jednym* panelu' },
   { kind: 'chips', eyebrow: 'Quality Cockpit', title: 'Wszystko *pod ręką*', small: 1, items: ['Plan', 'Dokumenty', 'Copilot', 'Szkolenia', 'Audyt'] },
   end('Otwórz *QASUPPORT*', 'Otwórz aplikację', Q)],
   caption: 'Quality Cockpit: plan, dokumenty, Copilot i szkolenia w jednym panelu. 🧭\n\n👉 qasupport.jembezpiecznie.com' },
 { accent: '#5fe3a1', ...QA, scenes: [
   { kind: 'hook', eyebrow: 'Biblioteka dokumentów', title: 'Nie zaczynaj *od zera*' },
   { kind: 'list', eyebrow: 'Gotowe wzory', title: 'Do *dopasowania*', small: 1, items: [{ t: 'Procedury' }, { t: 'Instrukcje' }, { t: 'Formularze i rejestry' }] },
   { kind: 'big', eyebrow: 'Dostęp', big: 'od *BASIC*', small: 1 },
   end('Dokumenty *gotowe*', 'Zobacz bibliotekę', Q)],
   caption: 'Procedury, instrukcje i formularze systemu jakości gotowe do dopasowania do Twojego zakładu. 📄 Od pakietu BASIC.\n\n👉 qasupport.jembezpiecznie.com' },
 { accent: '#c9b3ff', ...QA, scenes: [
   { kind: 'hook', eyebrow: 'Akademia Jakości', title: 'Szkolenia, *które widać*' },
   { kind: 'list', eyebrow: 'W Akademii', title: 'Nauka *krok po kroku*', small: 1, items: [{ t: 'Ścieżki szkoleń' }, { t: 'Moduły i ćwiczenia' }, { t: 'Śledzenie postępów' }] },
   end('Zacznij *naukę*', 'Otwórz Akademię', Q)],
   caption: 'Akademia Jakości: ścieżki szkoleń, moduły i ćwiczenia ze śledzeniem postępów. 🎓\n\n👉 qasupport.jembezpiecznie.com' },
 { accent: '#6fa8ff', ...QA, scenes: [
   { kind: 'hook', eyebrow: 'Quality Copilot 360°', title: 'Pytanie *przed audytem?*', small: 1 },
   { kind: 'chat', eyebrow: 'Przykład', items: [{ me: 'Jak opisać CAPA?' }, { as: 'Korekta → *przyczyna źródłowa* → działanie korygujące → *weryfikacja skuteczności*.' }] },
   { kind: 'chips', eyebrow: 'Obszary', title: 'Cały *dział jakości*', small: 1, items: ['HACCP', 'BRCGS', 'IFS', 'CAPA', 'Dostawcy', 'Etykiety'] },
   end('Wypróbuj *Copilota*', 'Otwórz aplikację', Q)],
   caption: 'Quality Copilot 360° pomaga w audytach, HACCP, BRCGS, IFS, CAPA, sprawach dostawców, reklamacjach, etykietach i prawie. 🧭\n\n👉 qasupport.jembezpiecznie.com' },
 { accent: '#e9d6a8', ...QA, scenes: [
   { kind: 'hook', eyebrow: 'Myszka Audytorka', title: 'Masz *oko audytora?*' },
   { kind: 'chips', eyebrow: 'Szukaj niezgodności w', title: 'Czterech *miejscach*', small: 1, items: ['🥖 Piekarnia', '🍽 Restauracja', '🏭 Fabryka', '❄ Chłodnia'] },
   end('Zagraj *za darmo*', 'Zagraj', Q)],
   caption: 'Myszka Audytorka: gra, w której szukasz niezgodności w piekarni, restauracji, fabryce i chłodni. 🐭🔍 Dostępna na darmowym koncie.\n\n👉 qasupport.jembezpiecznie.com' },
 { accent: '#ff8a8a', ...QA, scenes: [
   { kind: 'hook', eyebrow: 'Emergency Support', title: 'Audyt *za 7 dni?*' },
   { kind: 'list', eyebrow: 'Przez 7 dni', title: 'Plan *ratunkowy*', small: 1, items: [{ t: 'Analiza GAP' }, { t: 'Checklisty i harmonogram' }, { t: 'CAPA i audyt próbny' }, { t: 'Evidence Pack' }] },
   { kind: 'big', eyebrow: 'Koszt', big: '199 *zł*' },
   end('Zdążysz *na audyt*', 'Emergency Support', Q)],
   caption: 'Audyt za tydzień? 🚑 Emergency Support: 7 dni przygotowania – analiza GAP, checklisty, harmonogram, CAPA, audyt próbny i Evidence Pack. 199 zł.\n\n👉 qasupport.jembezpiecznie.com' },
 { accent: '#c08bff', ...QA, scenes: [
   { kind: 'hook', eyebrow: 'VIP Expert Zone', title: 'Poziom *ekspercki*' },
   { kind: 'list', eyebrow: 'W strefie VIP', title: 'Więcej *możliwości*', small: 1, items: [{ t: 'Scenariusze eksperckie' }, { t: 'Playbook' }, { t: 'Wyższe limity' }, { t: 'Priorytetowe ścieżki' }] },
   end('Dołącz *do VIP*', 'Wybierz pakiet', Q)],
   caption: 'VIP Expert Zone: scenariusze eksperckie, playbook, wyższe limity i priorytetowe ścieżki. 💎\n\n👉 qasupport.jembezpiecznie.com' },
 { accent: '#c08bff', ...QA, scenes: [
   { kind: 'hook', eyebrow: 'E-booki', title: 'Wiedza *na półce*' },
   { kind: 'chips', eyebrow: 'Tytuły dla pakietów', title: 'BASIC, PRO, *VIP*', small: 1, items: ['Podstawy systemu jakości', 'Standardy i audyty', 'Quality Manager Playbook'] },
   end('Czytaj *w aplikacji*', 'Zobacz e-booki', Q)],
   caption: 'E-booki dla pakietów BASIC, PRO i VIP, w tym Quality Manager Playbook. 📚 Czytasz w aplikacji, kiedy chcesz.\n\n👉 qasupport.jembezpiecznie.com' },
 { accent: '#4ff0e0', ...QA, scenes: [
   { kind: 'hook', eyebrow: 'Wsparcie i pomysły', title: 'Masz *pomysł?*' },
   { kind: 'list', eyebrow: 'Ze swojego konta', title: 'Piszesz *bezpośrednio*', small: 1, items: [{ t: 'Zgłoś problem' }, { t: 'Zaproponuj ulepszenie' }, { t: 'Śledź odpowiedź' }] },
   end('Budujemy *razem*', 'Otwórz aplikację', Q)],
   caption: 'W QASUPPORT zgłosisz problem albo zaproponujesz ulepszenie prosto ze swojego konta, w każdym pakiecie. 💡\n\n👉 qasupport.jembezpiecznie.com' },
 { accent: '#e9d6a8', ...QA, scenes: [
   { kind: 'hook', eyebrow: 'Jedno konto', title: 'Strona + aplikacja *+ grupy*', small: 1 },
   { kind: 'tiers', eyebrow: 'Pakiety', items: [{ k: 'free', p: '0 zł', d: 'Na start' }, { k: 'basic', p: '49,99', u: 'zł', d: 'Dokumenty' }, { k: 'pro', p: '149,99', u: 'zł', d: 'Standardy' }, { k: 'vip', p: '399,99', u: 'zł', d: 'Eksperci' }] },
   end('Wybierz *pakiet*', 'Portal członka', S)],
   caption: 'Jedno konto otwiera stronę, aplikację QASUPPORT i grupy na Telegramie. Pakiety od 0 zł. 🔑\n\n👉 jembezpiecznie.com' },
];

const F = (eyebrow, title, big, src, sub, caption) => ({ accent: '#4ff0e0', scenes: [
  { kind: 'hook', eyebrow: 'Wiesz, co jesz?', title, small: 1 },
  big ? { kind: 'big', eyebrow, big, src, sub, small: 1 } : { kind: 'hook', eyebrow, title: sub, small: 1, src },
  end('Więcej *na stronie*', 'Zapytaj asystenta')], caption: caption + '\n\n👉 Więcej wyjaśnień: jembezpiecznie.com' });

export const FACT = [
 F('Data bezpieczeństwa', '„Należy spożyć *do*”', 'po tej dacie *nie jemy*', 'rozporządzenie (UE) nr 1169/2011', null, '„Należy spożyć do” to data bezpieczeństwa – po niej produktu nie jemy. „Najlepiej spożyć przed” to data minimalnej trwałości: po niej produkt może być nadal dobry, jeśli był dobrze przechowywany. 📅'),
 F('Alergeny', 'Ile alergenów *trzeba wyróżnić?*', '*14*', 'załącznik II do rozporządzenia (UE) 1169/2011', 'np. gluten, mleko, jaja, orzeszki ziemne, seler, gorczyca', 'Przepisy UE wymieniają 14 alergenów, które muszą być wyróżnione w składzie, np. pogrubieniem: m.in. zboża z glutenem, mleko, jaja, ryby, orzeszki ziemne, soja, orzechy, seler, gorczyca, sezam, łubin, mięczaki, skorupiaki i dwutlenek siarki. ⚠️'),
 F('Kolejność', 'Co jest *pierwsze* w składzie?', 'najwięcej *na początku*', 'art. 18 rozporządzenia (UE) 1169/2011', 'składniki wymienia się malejąco według masy', 'Składniki na etykiecie są wymienione w kolejności malejącej masy. To, co na początku listy, jest w produkcie najwięcej. 🔎'),
 F('QUID', 'Truskawka *na opakowaniu?*', 'musi być *%*', 'art. 22 rozporządzenia (UE) 1169/2011', 'gdy składnik jest w nazwie lub na grafice', 'Jeśli składnik jest w nazwie produktu albo na obrazku na opakowaniu, producent musi podać jego procentową zawartość. To tzw. QUID. 🍓'),
 F('Wartość odżywcza', 'Na co *przeliczać?*', '*100 g*', 'art. 32 rozporządzenia (UE) 1169/2011', 'lub 100 ml – zawsze, dla porównania', 'Wartość odżywczą podaje się obowiązkowo w przeliczeniu na 100 g lub 100 ml. Dzięki temu łatwo porównasz dwa produkty, niezależnie od wielkości opakowania. ⚖️'),
 F('Dodatki', 'Co znaczy *litera E?*', 'E = *dopuszczony* w UE', 'rozporządzenie (WE) nr 1333/2008', 'dodatek oceniony i dopuszczony do stosowania', 'Numer E oznacza dodatek do żywności oceniony i dopuszczony do stosowania w Unii Europejskiej, z określonymi warunkami użycia. 🧪'),
 F('„Może zawierać”', 'Ślady *alergenów*', 'informacja *dobrowolna*', 'art. 36 rozporządzenia (UE) 1169/2011', 'ostrzega przed możliwym przeniesieniem', '„Może zawierać…” to dobrowolna informacja o możliwym niezamierzonym przeniesieniu alergenu. Dla osób z alergią to ważny sygnał. ⚠️'),
 F('Temperatura', 'Gdzie bakterie *rosną najszybciej?*', '5–60 *°C*', 'zalecenia instytucji bezpieczeństwa żywności', 'dlatego ciepłe danie nie powinno długo stać', 'Bakterie namnażają się najszybciej mniej więcej między 5 a 60°C. Dlatego gotowe danie nie powinno długo stać w temperaturze pokojowej. 🌡'),
 F('Lodówka', 'Ile stopni *w lodówce?*', 'do *5 °C*', 'zalecenia instytucji bezpieczeństwa żywności', 'sprawdź termometrem – pokrętło to nie stopnie', 'Lodówka powinna utrzymywać temperaturę do około 5°C. Warto sprawdzić to termometrem, bo cyfry na pokrętle to nie stopnie. ❄'),
 F('Rozmrażanie', 'Blat czy *lodówka?*', '*lodówka*', 'zalecenia instytucji bezpieczeństwa żywności', 'na blacie zewnętrzna warstwa szybko się ogrzewa', 'Najbezpieczniej rozmrażać mięso w lodówce. Na blacie zewnętrzna warstwa szybko się ogrzewa, a środek jest jeszcze zamrożony. 🧊'),
 F('Surowy kurczak', 'Myć *przed gotowaniem?*', '*nie*', 'zalecenia instytucji bezpieczeństwa żywności', 'woda rozpryskuje bakterie po kuchni', 'Surowego kurczaka nie myjemy pod kranem. Krople wody roznoszą bakterie, np. Campylobacter, po zlewie i blacie. Bakterie zabija odpowiednia obróbka cieplna. 🍗'),
 F('Listeria', 'Czy lodówka *zatrzyma Listerię?*', '*nie zawsze*', 'GIS · EFSA', 'Listeria może rosnąć w temperaturze lodówki', 'Listeria monocytogenes potrafi rosnąć nawet w temperaturze lodówki. Dlatego tak ważne są daty „należy spożyć do” i komunikaty o wycofaniach. 🦠'),
 F('Resztki', 'Kiedy do *lodówki?*', 'jak najszybciej', 'zalecenia instytucji bezpieczeństwa żywności', 'najlepiej w ciągu 2 godzin od przygotowania', 'Resztki jedzenia schładzaj i wkładaj do lodówki jak najszybciej, najlepiej w ciągu 2 godzin od przygotowania. 🍲'),
 F('Odgrzewanie', 'Jak odgrzewać *bezpiecznie?*', 'gorące *w środku*', 'zalecenia instytucji bezpieczeństwa żywności', 'parujące w całej objętości, wymieszane', 'Odgrzewane danie powinno być gorące i parujące w całej objętości. W mikrofalówce wymieszaj je w połowie, żeby nie zostały zimne miejsca. ♨'),
 F('Deski', 'Jedna deska *do wszystkiego?*', '*osobne*', 'zasady higieny żywności', 'surowe mięso i gotowe produkty osobno', 'Surowe mięso i produkty gotowe do jedzenia krój na osobnych deskach. To najprostszy sposób na uniknięcie zanieczyszczenia krzyżowego. 🔪'),
 F('Mycie rąk', 'Ile myć *ręce?*', '*20* sekund', 'WHO', 'z mydłem, także między palcami', 'Ręce myjemy wodą z mydłem przez co najmniej 20 sekund, także między palcami i pod paznokciami. 🧼'),
 F('HACCP', 'Ile zasad *ma HACCP?*', '*7*', 'Codex Alimentarius', 'od analizy zagrożeń do dokumentacji', 'HACCP opiera się na 7 zasadach Codex Alimentarius: od analizy zagrożeń i krytycznych punktów kontroli po weryfikację i dokumentację. 📋'),
 F('Obowiązek', 'Kto musi *mieć HACCP?*', '*każda* firma spożywcza', 'art. 5 rozporządzenia (WE) nr 852/2004', 'procedury oparte na zasadach HACCP', 'Przedsiębiorstwa sektora spożywczego w UE muszą stosować procedury oparte na zasadach HACCP – wynika to z rozporządzenia (WE) nr 852/2004. 🏭'),
 F('GFSI', 'Jakie standardy *uznaje GFSI?*', null, 'Global Food Safety Initiative', 'BRCGS, IFS, FSSC 22000, SQF i inne', 'GFSI uznaje programy certyfikacji bezpieczeństwa żywności, m.in. BRCGS, IFS, FSSC 22000 i SQF. Certyfikat uznany przez GFSI to często warunek współpracy z dużymi sieciami. 🏆'),
 F('RASFF', 'Jak UE *ostrzega się nawzajem?*', '*RASFF*', 'Komisja Europejska', 'system szybkiego ostrzegania o żywności i paszach', 'RASFF to unijny system szybkiego ostrzegania o niebezpiecznej żywności i paszach. Dzięki niemu kraje UE szybko wymieniają informacje o zagrożeniach. 🇪🇺'),
 F('Jaja', 'Co znaczy *pierwsza cyfra?*', '0 · 1 · 2 · *3*', 'oznakowanie jaj w UE', '0 eko · 1 wolny wybieg · 2 ściółka · 3 klatki', 'Pierwsza cyfra kodu na jajku to sposób chowu: 0 – ekologiczny, 1 – wolny wybieg, 2 – ściółkowy, 3 – klatkowy. Potem jest kod kraju, np. PL. 🥚'),
 F('Suplementy', 'Suplement to *lek?*', '*żywność*', 'ustawa o bezpieczeństwie żywności i żywienia', 'suplement diety jest środkiem spożywczym', 'Suplement diety to w świetle prawa żywność, a nie lek. Nie leczy chorób i nie przechodzi badań jak leki. 💊'),
 F('Mrożone mięso', 'Jaka data *na mrożonce?*', '„zamrożono *dnia*”', 'załącznik III do rozporządzenia (UE) 1169/2011', 'dla mięsa, wyrobów mięsnych i ryb nieprzetworzonych', 'Na mrożonym mięsie, mrożonych wyrobach mięsnych i nieprzetworzonych produktach rybołówstwa musi być podana data zamrożenia. ❄'),
 F('Kofeina', 'Kiedy *ostrzeżenie?*', 'ponad *150 mg/l*', 'załącznik III do rozporządzenia (UE) 1169/2011', '„Wysoka zawartość kofeiny”', 'Napoje z kofeiną powyżej 150 mg/l muszą mieć ostrzeżenie „Wysoka zawartość kofeiny” i informację, że nie są zalecane dzieciom i kobietom w ciąży. ☕'),
 F('Aspartam', 'Co oznacza *ten dopisek?*', 'źródło *fenyloalaniny*', 'załącznik III do rozporządzenia (UE) 1169/2011', 'ważne dla osób z fenyloketonurią', 'Produkty z aspartamem muszą mieć informację „zawiera źródło fenyloalaniny”. To ważne dla osób z fenyloketonurią. 🧃'),
 F('Tłuszcze trans', 'Ile *wolno?*', 'do *2 g*', 'rozporządzenie (UE) 2019/649', 'na 100 g tłuszczu w produkcie', 'Zawartość tłuszczów trans innych niż naturalnie występujące w tłuszczu zwierzęcym nie może przekraczać 2 g na 100 g tłuszczu. 🧈'),
 F('Kraj pochodzenia', 'Skąd *jest mięso?*', 'kraj *chowu i uboju*', 'rozporządzenie (UE) nr 1337/2013', 'dla świeżej wieprzowiny, drobiu, baraniny, koziny', 'Na świeżym mięsie wieprzowym, drobiowym, baranim i kozim trzeba podać kraj chowu i kraj uboju. 🌍'),
 F('Wycofanie', 'Co zrobić z *wycofanym produktem?*', 'sprawdź *partię*', 'komunikaty GIS', 'nie jedz, porównaj numer partii i datę', 'Wycofanie dotyczy zwykle konkretnej partii. Porównaj numer partii i datę z komunikatem. Jeśli się zgadzają – nie jedz produktu i postępuj zgodnie z zaleceniami komunikatu. 🔎'),
];

export const ALERT_FALLBACK = [
 { accent: '#ff8a8a', scenes: [
   { kind: 'hook', eyebrow: 'Jak czytać alert', title: 'Wycofanie? *Sprawdź partię*', small: 1 },
   { kind: 'recall', sev: 'WZÓR', rh: 'Co jest w komunikacie', items: [{ k: 'Produkt', v: 'Nazwa, gramatura' }, { k: 'Partia', v: 'Porównaj z opakowaniem' }, { k: 'Zagrożenie', v: 'Np. Listeria, szkło, alergen' }] },
   end('Alerty *codziennie*', 'Zobacz alerty')],
   caption: 'Jak czytać komunikat o wycofaniu? 🔎 Liczy się produkt, numer partii i data. Porównaj je z opakowaniem w domu.\n\n👉 Aktualne alerty: jembezpiecznie.com' },
];
