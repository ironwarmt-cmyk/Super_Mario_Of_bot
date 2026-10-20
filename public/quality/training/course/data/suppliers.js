window.QA_COURSES=window.QA_COURSES||{};window.QA_COURSES.suppliers = {
  tier: "vip",
  title: "Dostawcy i surowce",
  lead: "Ocena i zatwierdzanie dostawców, specyfikacje surowców, certyfikaty uznawane przez GFSI oraz nadzór nad jakością tego, co wchodzi do zakładu.",
  mods: [
    "Program zatwierdzania dostawców",
    "Specyfikacje surowców i opakowań",
    "Certyfikaty i weryfikacja",
    "Przyjęcie surowca i kontrola wejściowa",
    "Nadzór, ocena i zmiana dostawcy"
  ],
  lessons: [
    {
      p: [
        "Zakład odpowiada za bezpieczeństwo produktów, nawet jeśli część składników dostarczają inni. Program zatwierdzania dostawców określa kryteria wyboru, sposób oceny, zakres nadzoru i warunki, przy których dostawca jest akceptowany lub wykluczony.",
        "Kryteria oceny obejmują systemy jakości i bezpieczeństwa dostawcy, certyfikaty, historię dostaw, reklamacje, zdolność do realizacji zamówień i reakcję na niezgodności. Ocena powinna być udokumentowana i aktualizowana.",
        "Dla surowców krytycznych, np. alergennych lub wysokiego ryzyka mikrobiologicznego, wymagania są bardziej szczegółowe i obejmują audyt u dostawcy lub zdalną ocenę dokumentów."
      ],
      pitfall: "Dostawca dodany do listy na podstawie ceny i jednego certyfikatu, bez oceny ryzyka, to słaby punkt systemu."
    },
    {
      p: [
        "Specyfikacja surowca opisuje wymagania: skład, parametry fizykochemiczne, parametry mikrobiologiczne, alergeny, pochodzenie, warunki transportu i przechowywania, opakowanie oraz dokumenty, które dostawca przekazuje.",
        "Specyfikacja opakowania powinna uwzględniać kontakt z żywnością: materiał dopuszczony do kontaktu z żywnością, zgodność z przepisami i brak migracji substancji do produktu w przewidywanych warunkach.",
        "Specyfikacja musi być zatwierdzona i aktualizowana przy każdej zmianie u dostawcy, np. zmianie receptury, źródła surowca lub linii produkcyjnej."
      ],
      pitfall: "Specyfikacja, która nie zmieniła się od kilku lat, a dostawca zmienił proces, nie opisuje już surowca, który faktycznie przychodzi do zakładu."
    },
    {
      p: [
        "Certyfikaty systemów bezpieczeństwa żywności powinny pochodzić ze schematów uznanych przez GFSI, np. BRCGS, IFS, FSSC 22000 lub SQF. Certyfikat sam w sobie nie gwarantuje, że dostawca wykonuje wszystkie wymagania w praktyce.",
        "Weryfikacja obejmuje sprawdzenie ważności certyfikatu, zakresu (czy obejmuje dany produkt i lokalizację), jednostki certyfikującej i wyników ostatniego audytu. Dane można sprawdzić w rejestrach udostępnianych przez schematy.",
        "Certyfikat nie zastępuje własnej oceny dostawcy i kontroli przyjęcia. Zakład decyduje, jaki poziom nadzoru stosuje wobec każdego dostawcy."
      ],
      pitfall: "Kopia certyfikatu bez sprawdzenia zakresu i ważności może dotyczyć innego produktu lub już wygasłego dokumentu."
    },
    {
      p: [
        "Kontrola wejściowa to sprawdzenie dostawy przed przyjęciem: dokumenty przewozowe, temperatura, stan opakowania, czystość pojazdu, etykieta, numer partii i zgodność z zamówieniem. Dla surowców wysokiego ryzyka wykonuje się badania laboratoryjne.",
        "Surowiec niezgodny powinien być odizolowany i oznaczony jako wstrzymany. Decyzję o zwolnieniu lub odrzuceniu podejmuje osoba upoważniona, a dostawca jest informowany na piśmie.",
        "Identyfikowalność surowca musi być zachowana: numer partii, data dostawy i dokument przewozowy łączą surowiec z produktem gotowym."
      ],
      pitfall: "Przyjęcie dostawy „na słowo kierowcy” bez sprawdzenia temperatury i etykiety to najkrótsza droga do niezgodności, które wychodzą dopiero u klienta."
    },
    {
      p: [
        "Nadzór nad dostawcami obejmuje monitorowanie reklamacji, wyników badań, terminowości i zmian. Ocena dostawcy jest powtarzana okresowo i po każdym istotnym zdarzeniu.",
        "Zmiana dostawcy wymaga oceny: czy nowy surowiec jest zgodny ze specyfikacją, czy zmienia się ryzyko alergenowe lub mikrobiologiczne, czy trzeba zaktualizować plan HACCP i etykietę. Zmiana bez oceny jest zmianą bez kontroli.",
        "Dostawca, który wielokrotnie nie spełnia wymagań, powinien być objęty planem naprawczym, a przy braku poprawy wykluczony z listy zatwierdzonych."
      ],
      pitfall: "Zmiana dostawcy surowca w środku sezonu, bez aktualizacji specyfikacji i mapy alergenów, to jeden z częstszych źródeł reklamacji alergenowych."
    }
  ],
  quiz: [
    ["Dlaczego zakład odpowiada za surowce od dostawców?", ["Bo musi kupować tylko od dużych firm", "Bo odpowiada za bezpieczeństwo gotowego produktu, niezależnie od źródła składników", "Bo tak wymaga umowa z bankiem"], 1],
    ["Co powinna zawierać specyfikacja surowca?", ["Tylko cenę i termin dostawy", "Skład, parametry, alergeny, warunki przechowywania i wymagane dokumenty", "Wyłącznie nazwę dostawcy"], 1],
    ["Certyfikat dostawcy powinien być sprawdzony pod kątem:", ["Tylko koloru logo", "Ważności, zakresu i jednostki certyfikującej", "Tego, czy jest w języku polskim"], 1],
    ["Kierowca dostarcza surowiec bez zapisu temperatury. Co zrobić?", ["Przyjąć, bo termin jest pilny", "Wstrzymać dostawę do weryfikacji i ocenić zgodność", "Przyjąć po podpisaniu przez kierowcę"], 1],
    ["Dostawca zmienił proces produkcji surowca. Co jest konieczne?", ["Nic, bo to tylko zmiana dostawcy", "Ocena wpływu na specyfikację, alergeny, HACCP i etykietę", "Zmiana dostawcy na kolejnego z listy"], 1]
  ]
};
