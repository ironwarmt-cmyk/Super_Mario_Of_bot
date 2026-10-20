window.QA_COURSES=window.QA_COURSES||{};window.QA_COURSES.haccp = {
  tier: "basic",
  title: "HACCP od zera",
  lead: "Od zespołu i opisu produktu, przez analizę zagrożeń, punkty krytyczne i limity, po monitoring, działania korygujące i weryfikację systemu.",
  mods: [
    "Zespół HACCP i opis produktu",
    "Schemat procesu i weryfikacja na zakładzie",
    "Analiza zagrożeń",
    "CCP, OPRP i limity krytyczne",
    "Monitoring i działania korygujące",
    "Walidacja i weryfikacja"
  ],
  lessons: [
    {
      p: [
        "HACCP (Hazard Analysis and Critical Control Points) to systematyczne podejście do zapobiegania zagrożeniom bezpieczeństwa żywności. Zgodnie z art. 5 rozporządzenia (WE) nr 852/2004 przedsiębiorca spożywczy ma wdrożoną i utrzymywaną procedurę opartą na zasadach HACCP. Zasady te opracowano w ramach Codex Alimentarius.",
        "Pierwszym krokiem jest zespół HACCP: osoby z różnych obszarów, które znają produkt i proces, np. jakość, produkcja, utrzymanie ruchu i technolog. Jedna osoba nie jest w stanie opisać całego procesu realnie.",
        "Każdy produkt lub grupa produktów wymaga opisu: skład, surowce, opakowanie, warunki przechowywania, okres przydatności, sposób dystrybucji oraz grupa odbiorców, w tym grupy wrażliwe. Opis jest punktem wyjścia do wszystkich dalszych analiz."
      ],
      pitfall: "Zespół złożony tylko z osób z działu jakości opisuje proces, który znają z dokumentów, a nie z hali. Włączenie produkcji zwykle ujawnia różnice między procedurą a praktyką."
    },
    {
      p: [
        "Schemat procesu opisuje każdy etap, od przyjęcia surowca do wysyłki produktu, z parametrami i przepływami. Schemat powinien obejmować także etapy pomocnicze, np. przygotowanie wody, mycie opakowań i odpady.",
        "Schemat musi zostać zweryfikowany na zakładzie. Zespół idzie drogą produktu i porównuje rzeczywisty przebieg z dokumentem. Różnice trzeba opisać i poprawić, zanim zacznie się analiza zagrożeń.",
        "Dobrym testem jest pytanie, czy każdy etap z schematu da się wskazać na hali i czy każdy etap na hali jest w schemacie. Rozbieżności w jedną stronę oznaczają zwykle brakujące kroki w analizie."
      ],
      pitfall: "Schemat przepisany z poprzedniego zakładu lub z szablonu nie odzwierciedla rzeczywistego procesu i unieważnia całą dalszą analizę."
    },
    {
      p: [
        "Analiza zagrożeń obejmuje identyfikację zagrożeń biologicznych (np. Salmonella, Listeria monocytogenes), chemicznych (np. pozostałości środków czyszczących, pestycydy, mykotoksyny) i fizycznych (np. metal, szkło, plastik). Zagrożeniem jest czynnik, który może spowodować niedopuszczalny skutek dla konsumenta, a nie samo jego występowanie.",
        "Dla każdego zagrożenia ocenia się prawdopodobieństwo wystąpienia i dotkliwość skutku. Na tej podstawie decyduje się, które zagrożenia wymagają kontroli w punkcie krytycznym lub w programie wymagań wstępnych.",
        "Ocena musi uwzględniać zarówno surowiec, jak i proces. Ten sam surowiec może nieść inne ryzyko przy przechowywaniu w temperaturze pokojowej i przy przechowywaniu w chłodni."
      ],
      pitfall: "Analiza zagrożeń robiona „na biurku” często pomija zagrożenia fizyczne i chemiczne z myjni i wyposażenia, które nie pojawiają się w opisie receptury."
    },
    {
      p: [
        "Punkt krytyczny (CCP) to etap, na którym można zastosować kontrolę istotną dla zapobieżenia zagrożeniu lub jego wyeliminowania albo ograniczenia do poziomu dopuszczalnego. Przykładem jest pasteryzacja, która eliminuje patogeny, jeśli osiągnięto zdefiniowaną temperaturę i czas.",
        "OPRP (operational prerequisite programme) to działanie operacyjne, które kontroluje zagrożenie, ale nie jest krytycznym punktem według definicji zespołu. Dla każdego CCP wyznacza się limit krytyczny, czyli wartość oddzielającą produkt bezpieczny od niebezpiecznego.",
        "Limit krytyczny musi być mierzalny, np. temperatura, pH, aktywność wody, czas, stężenie środka. Opis typu „produkt dobrze wygląda” nie jest limitem."
      ],
      pitfall: "Wyznaczenie CCP wszędzie, gdzie jest ważny proces, rozmywa system. Zbyt wiele punktów krytycznych oznacza, że nikt nie kontroluje ich naprawdę."
    },
    {
      p: [
        "Monitoring to zaplanowana obserwacja lub pomiar parametrów CCP i OPRP. Określa się, co jest mierzone, jak często, kto mierzy, jakim przyrządem i gdzie zapisuje się wynik. Przyrząd musi być sprawdzony metrologicznie lub skalibrowany.",
        "Gdy wynik wykracza poza limit, uruchamiane jest działanie korygujące zdefiniowane wcześniej: zatrzymanie linii, wstrzymanie partii, ponowne przetworzenie tam, gdzie jest to dozwolone, lub zniszczenie. Działanie musi zapobiec dostaniu się niebezpiecznego produktu do konsumenta.",
        "Każde odchylenie i działanie korygujące są zapisywane. Zapis pokazuje, że system działa, a nie tylko istnieje na papierze."
      ],
      pitfall: "Powtarzanie pomiaru aż do uzyskania dobrego wyniku bez zbadania przyczyny jest fałszowaniem monitoringu. Pierwszy wynik zawsze zostaje w zapisie."
    },
    {
      p: [
        "Walidacja to dowód, że wybrane środki kontroli są w stanie osiągnąć zakładany wynik, np. że pasteryzacja w danych warunkach redukuje Salmonellę o wymagany poziom. Opiera się na literaturze naukowej, badaniach zakładowych lub danych od dostawcy urządzenia.",
        "Weryfikacja to sprawdzenie, czy system działa w praktyce: audyty wewnętrzne, przeglądy zapisów, wyniki badań laboratoryjnych produktu i środowiska, reklamacje oraz zmiany w produkcji. Weryfikację planuje się w harmonogramie i zapisuje.",
        "Przegląd systemu HACCP jest konieczny przy każdej istotnej zmianie: nowy surowiec, nowa linia, zmiana receptury, nowe dostawy lub nowe wymagania odbiorcy."
      ],
      pitfall: "Badanie gotowego wyrobu raz w roku nie jest weryfikacją całego systemu. Weryfikacja obejmuje decyzje i działania, nie tylko wyniki."
    }
  ],
  quiz: [
    ["Dlaczego zespół HACCP powinien obejmować osoby z produkcji i utrzymania ruchu?", ["Bo tylko one mogą podpisać dokumenty", "Bo znają rzeczywisty proces i jego odchylenia", "Bo to wymaga przepisy o zatrudnieniu"], 1],
    ["Schemat procesu został przepisany z poprzedniego zakładu. Co z nim zrobić?", ["Zostawić, bo jest zgodny z branżą", "Zweryfikować na zakładzie i poprawić rozbieżności", "Skrócić, żeby był czytelniejszy"], 1],
    ["Co jest punktem krytycznym (CCP)?", ["Każdy etap, który wymaga czasu", "Etap, na którym kontrola zapobiega zagrożeniu lub je eliminuje", "Miejsce, gdzie stoi najwięcej pracowników"], 1],
    ["Limit krytyczny powinien być:", ["Opisowy, np. produkt dobrze wygląda", "Mierzalny, np. określona temperatura i czas", "Ustalany na podstawie opinii operatora"], 1],
    ["Wynik monitoringu CCP jest poza limitem krytycznym. Co dalej?", ["Powtórzyć pomiar i usunąć pierwszy wynik", "Uruchomić zdefiniowane działania, zabezpieczyć produkt i udokumentować decyzję", "Kontynuować do końca zmiany"], 1],
    ["Kiedy należy przeprowadzić przegląd systemu HACCP?", ["Tylko raz w roku, przy audycie", "Przy każdej istotnej zmianie w produkcie lub procesie", "Wyłącznie po reklamacji konsumenta"], 1]
  ]
};
