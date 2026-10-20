window.QA_COURSES=window.QA_COURSES||{};window.QA_COURSES.complaints = {
  tier: "vip",
  title: "Reklamacje i trendy",
  lead: "Przyjmowanie i obsługa reklamacji, ocena ryzyka, analiza trendów i wykorzystanie danych do zapobiegania kolejnym zgłoszeniom.",
  mods: [
    "Przyjęcie i klasyfikacja reklamacji",
    "Reakcja i ochrona konsumenta",
    "Analiza przyczyn i dane",
    "Trendy i sygnały ostrzegawcze",
    "Komunikacja z klientem i zarządem"
  ],
  lessons: [
    {
      p: [
        "Reklamacja to zgłoszenie niezgodności od klienta lub konsumenta: obce ciało, zmiana smaku, zapach, uszkodzone opakowanie, objawy po spożyciu czy błąd na etykiecie. Każda reklamacja jest informacją o systemie, nawet jeśli wydaje się błahą.",
        "Przyjęcie zgłoszenia obejmuje zapis danych: kto zgłasza, co, kiedy, gdzie, numer partii, zdjęcia, próbki i kontakt. Brak numeru partii uniemożliwia identyfikowalność i może oznaczać, że problem nie zostanie rozwiązany.",
        "Klasyfikacja określa priorytet: zagrożenie zdrowia, niezgodność jakościowa czy zgłoszenie informacyjne. Od tej klasyfikacji zależy czas reakcji i zakres działań."
      ],
      pitfall: "Reklamacja zapisana bez numeru partii i bez próbki nie pozwala ustalić przyczyny. Rozmowa telefoniczna bez zapisu jest tak samo bezużyteczna."
    },
    {
      p: [
        "Reakcja zaczyna się od oceny, czy produkt może zaszkodzić konsumentowi. Jeśli tak, wstrzymuje się sprzedaż i rozważa wycofanie z obrotu oraz odzyskanie produktu od konsumentów (recall), zgodnie z procedurą i art. 19 rozporządzenia 178/2002.",
        "Zakład powinien umieć szybko zidentyfikować partie w obrocie, a także wskazać, komu je wysłano. Testowanie tej zdolności, np. symulacją wycofania, jest częścią dobrej praktyki.",
        "Komunikacja z klientem powinna być rzeczowa i oparta na ustaleniach, a nie na domysłach. Obietnice, których nie da się dotrzymać, są gorsze niż krótka informacja o trwającym badaniu."
      ],
      pitfall: "Zwlekanie z decyzją o wstrzymaniu partii do czasu pełnego wyjaśnienia przyczyny może narazić konsumenta na ryzyko i zakład na odpowiedzialność."
    },
    {
      p: [
        "Analiza przyczyn reklamacji łączy zapis zgłoszenia z danymi z produkcji: partia surowca, parametry procesu, wyniki kontroli, zmiany personelu i urządzeń. Bez tych danych zespół zgaduje.",
        "Warto rozróżnić przyczynę zgłoszenia od przyczyny problemu. Konsument może zgłosić zapach, który wynika z przechowywania u sprzedawcy, a nie z produkcji. Dlatego ważne jest zbadanie próbki z partii i z magazynu klienta, jeśli to możliwe.",
        "Wynik analizy zapisuje się i przekazuje do CAPA, jeśli problem dotyczy systemu. Pojedyncza reklamacja z jasną przyczyną może zakończyć się korektą; powtarzająca się wymaga działania zapobiegawczego."
      ],
      pitfall: "Przypisanie reklamacji do „błędu konsumenta” bez zbadania próbki i przechowywania jest wygodne, ale często błędne."
    },
    {
      p: [
        "Trend to powtarzający się wzorzec w danych w czasie: rosnąca liczba reklamacji o tym samym rodzaju, koncentracja problemów na jednej linii, zmiana po wejściu nowego dostawcy. Trendy widać dopiero wtedy, gdy dane są zbierane i porównywane.",
        "Analiza Pareto pokazuje, które kategorie reklamacji generują największy odsetek zgłoszeń. Wykresy kontrolne pozwalają zobaczyć, czy wartość mieści się w zakresie, a jeśli nie, kiedy zaczęło się odchylenie.",
        "Sygnały ostrzegawcze to również dane spoza reklamacji: wyniki badań, wpisy w mediach społecznościowych, zgłoszenia pracowników i wyniki audytów. Warto je łączyć, zanim problem stanie się kryzysem."
      ],
      pitfall: "Raport miesięczny z listą reklamacji bez analizy trendów to tylko archiwum. Decyzje wymagają porównania z poprzednimi okresami."
    },
    {
      p: [
        "Zarząd powinien dostawać zwięzłe informacje: liczbę i rodzaj reklamacji, trend, ryzyko dla konsumenta, otwarte CAPA i decyzje wymagające zgody. Szczegółowe dane są dostępne, ale nie zastępują przeglądu.",
        "Komunikacja z klientem B2B wymaga ustalonych kanałów, terminów odpowiedzi i określenia, kto podpisuje pisma. Odpowiedź powinna zawierać opis ustaleń i działania, a nie tylko przeprosiny.",
        "Każda istotna reklamacja powinna trafić do przeglądu zarządzania, bo to tam decyduje się o zmianach w systemie i zasobach."
      ],
      pitfall: "Przeprosiny bez opisu działań i bez terminu wyjaśnienia nie uspokajają klienta, a mogą pogorszyć relację."
    }
  ],
  quiz: [
    ["Która informacja jest najważniejsza przy przyjęciu reklamacji?", ["Imię i nazwisko zgłaszającego", "Numer partii i dane pozwalające na identyfikowalność produktu", "Opinia zgłaszającego o sklepie"], 1],
    ["Co trzeba zrobić, gdy reklamacja dotyczy zagrożenia zdrowia?", ["Poczekać na kolejny raport", "Ocenić ryzyko i wstrzymać sprzedaż partii zgodnie z procedurą", "Odpowiedzieć, że to błąd konsumenta"], 1],
    ["Konsument zgłasza zapach produktu. Co może być przyczyną poza produkcją?", ["Nic, bo produkcja jest zawsze przyczyną", "Przechowywanie u sprzedawcy lub w domu", "Wyłącznie data produkcji"], 1],
    ["Co pokazuje analiza Pareto reklamacji?", ["Które kategorie generują największą część zgłoszeń", "Dokładną przyczynę każdej reklamacji", "Liczbę pracowników na zmianie"], 0],
    ["Które zdanie najlepiej opisuje rolę trendów w reklamacjach?", ["Trendy są widoczne tylko w danych rocznych", "Trend to powtarzający się wzorzec w czasie, który wymaga reakcji", "Trend to pojedyncza reklamacja z dużym wpływem"], 1]
  ]
};
