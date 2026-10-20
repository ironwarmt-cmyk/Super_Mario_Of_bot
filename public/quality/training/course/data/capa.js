window.QA_COURSES=window.QA_COURSES||{};window.QA_COURSES.capa = {
  tier: "pro",
  title: "RCA i CAPA bez pozorów",
  lead: "Analiza przyczyny źródłowej, działania korygujące i zapobiegawcze oraz sprawdzanie skuteczności. Kurs pokazuje, jak odróżnić naprawę objawu od usunięcia przyczyny.",
  mods: [
    "Od niezgodności do decyzji",
    "Analiza przyczyny źródłowej (RCA)",
    "Działania korygujące i zapobiegawcze",
    "Skuteczność i zamknięcie CAPA",
    "Przykład: powtarzająca się niezgodność"
  ],
  lessons: [
    {
      p: [
        "Niezgodność to każde odstępstwo od wymagania: produktowe, procesowe lub systemowe. Pierwszym krokiem jest opisanie jej faktów: co, gdzie, kiedy, ile produktu, kto zauważył i jakie działanie natychmiastowe zostało podjęte.",
        "Decyzja o produkcie niezgodnym (zwolnienie, przerób, zniszczenie, wstrzymanie) musi być podjęta przez osobę upoważnioną i zapisana. Dopiero po tej decyzji można przejść do analizy przyczyny.",
        "Zgłoszenie powinno być zrobione bez obawy o konsekwencje. Kultura, w której pracownicy ukrywają problemy, uniemożliwia skuteczne CAPA."
      ],
      pitfall: "Działanie natychmiastowe zapisane jako „poprawiono” bez opisu tego, co dokładnie zrobiono, uniemożliwia późniejszą analizę."
    },
    {
      p: [
        "Analiza przyczyny źródłowej (RCA) szuka tego, co doprowadziło do niezgodności, a nie tego, kto ją popełnił. Najczęściej stosuje się metodę 5 Why (pięciokrotne pytanie „dlaczego”) lub diagram Ishikawy, który grupuje przyczyny w kategorie: ludzie, metody, maszyny, materiały, pomiary, środowisko.",
        "Każda przyczyna wymaga dowodu. Jeśli zespół twierdzi, że przyczyną był pośpiech, trzeba pokazać, że tak było, np. na podstawie grafiku, obsady i zapisów z tej zmiany.",
        "RCA powinna zakończyć się wskazaniem przyczyny, którą da się kontrolować. „Błąd ludzki” jest początkiem analizy, a nie jej końcem."
      ],
      pitfall: "Zatrzymanie się na „pracownik nie uważał” oznacza, że system nie zapobiega błędom. Warto zapytać, dlaczego sytuacja pozwoliła na ten błąd."
    },
    {
      p: [
        "Działanie korygujące usuwa skutek i przywraca zgodność tu i teraz, np. wymiana wadliwej partii czy naprawa urządzenia. Działanie zapobiegawcze usuwa przyczynę, żeby problem nie wrócił, a także w innych miejscach systemu.",
        "Dobre działanie ma właściciela, termin, zakres i sposób weryfikacji. Działanie typu „szkolenie personelu” bez określenia, co ma się zmienić w praktyce, nie jest wystarczające.",
        "Działania powinny być proporcjonalne do ryzyka. Dla niezgodności krytycznej wymagane są szersze działania niż dla drobnego odchylenia."
      ],
      pitfall: "Szkolenie jako jedyne działanie po każdej niezgodności sugeruje, że przyczyną zawsze jest człowiek, co rzadko jest prawdą."
    },
    {
      p: [
        "Skuteczność CAPA sprawdza się na podstawie danych po określonym czasie: czy niezgodność wróciła, czy wskaźniki się poprawiły, czy zmiana została utrzymana. Kryterium skuteczności powinno być ustalone przed wdrożeniem działania.",
        "Zamknięcie CAPA wymaga decyzji osoby odpowiedzialnej za system i zapisu z uzasadnieniem. Brak nawrotu w krótkim okresie nie zawsze oznacza sukces, jeśli warunki produkcji się zmieniły.",
        "Jeśli CAPA nie była skuteczna, wraca się do analizy przyczyny. To nie jest porażka, tylko część procesu doskonalenia."
      ],
      pitfall: "CAPA zamykana po wykonaniu działania, a nie po sprawdzeniu efektu, to pozorne zarządzanie. Problem wraca, a system wygląda na poprawny."
    },
    {
      p: [
        "Przykład: na jednej linii co kilka tygodni pojawia się ciało obce w postaci fragmentu uszczelki. Pierwsza reakcja to wymiana uszczelki i zapis. Analiza RCA pokazuje, że uszczelka pęka po zmianie dostawcy i przy wyższej temperaturze mycia.",
        "Działanie zapobiegawcze obejmuje weryfikację specyfikacji nowej uszczelki, kontrolę przed i po mycie oraz wpis do przeglądu dostawców. Skuteczność sprawdza się przez trzy miesiące: liczba zgłoszeń, wyniki kontroli wizualnej i reklamacje.",
        "Ten przykład pokazuje, że CAPA łączy analizę, zmianę w systemie i pomiar efektu. Bez tego każde zgłoszenie wygląda jak nowy problem."
      ],
      pitfall: "Wymiana uszczelki co tydzień, bez pytania o przyczynę, jest kosztowna i nie zapobiega powrotowi problemu."
    }
  ],
  quiz: [
    ["Co powinien zrobić zespół w pierwszej kolejności po wykryciu niezgodności?", ["Zamknąć sprawę bez zapisu", "Opisać fakty, podjąć działanie natychmiastowe i zapisać decyzję o produkcie", "Zapytać klienta, czy problem go dotyczy"], 1],
    ["Metoda 5 Why służy do:", ["Szybkiego znalezienia winnego", "Dojścia do przyczyny źródłowej przez kolejne pytania „dlaczego”", "Obliczenia kosztów naprawy"], 1],
    ["Różnica między działaniem korygującym a zapobiegawczym to:", ["Korygujące usuwa skutek, zapobiegawcze usuwa przyczynę", "Nie ma różnicy, to dwa słowa na to samo", "Zapobiegawcze dotyczy tylko dokumentów"], 0],
    ["Kiedy CAPA można uznać za skuteczną?", ["Gdy została zamknięta w terminie", "Gdy przyczyna została usunięta i nie ma nawrotu w ustalonym okresie", "Gdy ma dużo załączników"], 1],
    ["Po zmianie dostawcy uszczelki pojawia się ciało obce. Co jest najlepszym działaniem zapobiegawczym?", ["Kupowanie większej liczby uszczelek", "Weryfikacja specyfikacji i kontrola nowego materiału w procesie", "Zwiększenie kontroli wizualnej bez zmian"], 1]
  ]
};
