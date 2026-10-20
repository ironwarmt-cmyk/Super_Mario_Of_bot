window.QA_COURSES=window.QA_COURSES||{};window.QA_COURSES.defense = {
  tier: "vip",
  title: "Food Defense & Food Fraud",
  lead: "Ochrona produktu przed celowym zanieczyszczeniem (food defense) i przed oszustwami, takimi jak podmiana, rozcieńczanie lub fałszywe deklaracje (food fraud). Kurs opiera się na podejściu ryzyka i praktycznych kontrolach.",
  mods: [
    "Food defense vs food fraud: różnica i zakres",
    "Ocena podatności zakładu",
    "Kontrole dostępu i nadzór nad surowcami",
    "Wykrywanie fałszerstw i weryfikacja autentyczności",
    "Plan reakcji i komunikacja"
  ],
  lessons: [
    {
      p: [
        "Food defense dotyczy celowego działania, którego celem jest zaszkodzenie konsumentom lub firmie, np. sabotażu, wprowadzenia substancji do produktu lub zakłócenia dostaw. Food fraud to działanie w celu zysku, np. podmiana składnika na tańszy, rozcieńczanie, fałszowanie pochodzenia lub deklaracji.",
        "Oba obszary różnią się motywacją, ale wymagają podobnych narzędzi: oceny ryzyka, kontroli dostępu, nadzoru nad dostawcami i procedur reakcji. Dlatego są często obsługiwane razem.",
        "Zakres obejmuje surowce, opakowania, produkcję, magazyn, transport i systemy informatyczne, np. zmiany w recepturach lub etykietach wprowadzane bez autoryzacji."
      ],
      pitfall: "Traktowanie food defense jako tematu wyłącznie dla ochrony fizycznej pomija ryzyko wewnętrzne i zmiany dokumentów, które są częstsze niż sabotaż."
    },
    {
      p: [
        "Ocena podatności zakładu polega na przejściu przez każdy etap i zadaniu pytania: gdzie ktoś mógłby celowo wprowadzić zagrożenie, jak szybko by to wykryto i jakie byłyby skutki. Ocena uwzględnia dostęp do zbiorników, linii, magazynów i danych.",
        "Ryzyko ocenia się przez prawdopodobieństwo i skutek, z uwzględnieniem tego, czy kontrola istnieje i działa. Priorytety wynikają z oceny, a nie z tego, co jest najłatwiejsze do zabezpieczenia.",
        "Ocenę powtarza się przy zmianach w zakładzie, nowych dostawcach, zmianie personelu lub po zdarzeniach w branży."
      ],
      pitfall: "Ocena wykonana raz i zapomniana nie uwzględnia zmian w zakładzie, np. nowego magazynu tymczasowego albo zewnętrznej firmy transportowej."
    },
    {
      p: [
        "Kontrola dostępu obejmuje rejestrowanie wejść do stref produkcyjnych i magazynowych, zamykanie zbiorników i zaworów, plomby na partiach i kontrolę kluczy. Dostęp powinien być ograniczony do osób, które go potrzebują.",
        "Nadzór nad surowcami oznacza weryfikację, że dostarczany produkt jest tym, który zamówiono. Dotyczy to dokumentów, etykiet, certyfikatów pochodzenia i zgodności partii z zamówieniem.",
        "Zmiany w systemie IT, recepturach i etykietach wymagają autoryzacji i śladu audytowego. Kto zmienił dane, kiedy i na podstawie jakiej decyzji, musi być możliwe do ustalenia."
      ],
      pitfall: "Plomba założona na beczce i nigdy nie sprawdzona przy odbiorze nie chroni przed zamianą zawartości, jeśli nikt nie porównuje numeru plomby z dokumentem."
    },
    {
      p: [
        "Wykrywanie food fraud zaczyna się od analizy ryzyka dla surowców: cena znacznie poniżej rynku, zmiana dostawcy pośrednika, brak pełnej dokumentacji pochodzenia, nietypowy wygląd lub zapach, rozbieżności w specyfikacji.",
        "Weryfikacja autentyczności może obejmować badania laboratoryjne na konkretny marker (np. gatunek ryby, pochodzenie miodu), kontrolę dokumentów i porównanie z historią dostaw. Badania wykonuje się w oparciu o ocenę ryzyka.",
        "Wyniki badań i decyzje o dalszym zakupie są zapisywane. Jeśli dostawca nie może udokumentować pochodzenia, surowiec nie jest przyjmowany."
      ],
      pitfall: "Badanie jednego parametru, np. białka, nie wykrywa każdego rodzaju oszustwa. Ważne jest zrozumienie, co może zostać zmienione, i dobór testów do tego ryzyka."
    },
    {
      p: [
        "Plan reakcji określa, co zrobić w razie podejrzenia celowego zanieczyszczenia lub fałszerstwa: kto zgłasza, kto decyduje o wstrzymaniu partii, jakie dane są zbierane i kiedy powiadamia się organy nadzoru i klientów.",
        "Komunikacja musi być szybka i spójna. Zakład przygotowuje wcześniej szablony, listy kontaktów i informację o tym, kto mówi w imieniu firmy.",
        "Po zdarzeniu przeprowadza się analizę i aktualizuje ocenę podatności oraz kontrole. Ćwiczenie planu reakcji przynajmniej raz w roku pokazuje, czy działa w praktyce."
      ],
      pitfall: "Plan reakcji, którego nikt nie zna, nie działa w sytuacji stresu. Dlatego warto go przećwiczyć zanim coś się stanie."
    }
  ],
  quiz: [
    ["Czym różni się food fraud od food defense?", ["Food fraud to działanie w celu zysku, food defense to celowe zaszkodzenie", "To ten sam pojęciowo obszar", "Food fraud dotyczy wyłącznie transportu"], 0],
    ["Która zmiana najczęściej wymaga oceny podatności?", ["Zmiana koloru opakowania bez zmiany składu", "Nowy dostawca, nowy magazyn tymczasowy lub zmiana personelu", "Zmiana godzin pracy kantyny"], 1],
    ["Plomba na beczce jest zrywana przy odbiorze, ale nikt nie porównuje numeru z dokumentem. Dlaczego to problem?", ["Bo plomba jest zbyt droga", "Bo kontrola nie potwierdza, że zawartość jest tą zamówioną", "Bo plomby nie są potrzebne"], 1],
    ["Surowiec ma cenę znacznie poniżej rynku i brak dokumentacji pochodzenia. Co zrobić?", ["Przyjąć, bo to okazja", "Wstrzymać przyjęcie i wyjaśnić pochodzenie zanim decyzja zostanie podjęta", "Przyjąć i dopisać pochodzenie później"], 1],
    ["Co powinien zawierać plan reakcji na podejrzenie zanieczyszczenia celowego?", ["Tylko listę przeprosin dla klienta", "Osoby zgłaszające, decyzje o wstrzymaniu i ścieżkę powiadomień", "Wyłącznie informację o ubezpieczeniu"], 1]
  ]
};
