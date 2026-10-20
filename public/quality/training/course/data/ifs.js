window.QA_COURSES=window.QA_COURSES||{};window.QA_COURSES.ifs = {
  tier: "pro",
  title: "IFS Food — podejście procesowe",
  lead: "Zarządzanie procesem, ryzykiem, zasobami, pomiarami i działaniami doskonalącymi. Kurs opiera się na IFS Food w wersji 8, która jest jedyną wersją stosowaną w audytach od 1 stycznia 2024 r.",
  mods: [
    "Governance i zaangażowanie zarządu",
    "HACCP i zarządzanie ryzykiem",
    "Zarządzanie zasobami",
    "Procesy operacyjne",
    "Pomiary, analiza i CAPA",
    "Warsztat oceny punktowej"
  ],
  lessons: [
    {
      p: [
        "IFS Food kładzie nacisk na odpowiedzialność zarządu za bezpieczeństwo i jakość żywności. Polityka firmy musi być zrozumiała dla pracowników, a cele muszą być mierzalne i przeglądane przez kierownictwo.",
        "Governance oznacza też strukturę odpowiedzialności: kto zatwierdza dokumenty, kto nadzoruje HACCP, kto podejmuje decyzje o wstrzymaniu produkcji i jak ta struktura działa w weekendy i na zmianach nocnych.",
        "Audytor oceni, czy zarząd zna wyniki systemu, a nie tylko podpisuje dokumenty. Przykładem jest przegląd zarządzania z realnymi decyzjami i zapisanymi działaniami."
      ],
      pitfall: "Polityka jakości wiszą na ścianie, której nikt nie potrafi streścić, świadczy o tym, że zarząd nie jest zaangażowany w system."
    },
    {
      p: [
        "IFS wymaga systemu HACCP zgodnego z zasadami Codex Alimentarius. Analiza zagrożeń musi uwzględniać surowce, proces, środowisko produkcji, personel, opakowania i dystrybucję.",
        "Podejście oparte na ryzyku oznacza, że zakład ustala priorytety działań według prawdopodobieństwa i dotkliwości zagrożenia, a nie według tego, co jest najłatwiejsze do udokumentowania.",
        "Zmiany w produkcji, dostawcach lub wymaganiach klientów są sygnałami do ponownej oceny ryzyka. Przegląd HACCP powinien być zapisany wraz z uzasadnieniem decyzji."
      ],
      pitfall: "Analiza ryzyka, która nie zmieniła się od wdrożenia systemu, sugeruje, że nikt nie przegląda jej przy zmianach w zakładzie."
    },
    {
      p: [
        "Zarządzanie zasobami obejmuje personel, infrastrukturę, sprzęt, wodę i energię oraz zewnętrznych dostawców usług. Standard wymaga, aby zakład wiedział, jakie zasoby są potrzebne do bezpiecznej produkcji i je zapewniał.",
        "Kompetencje personelu muszą być planowane i weryfikowane. Dotyczy to szkoleń w zakresie higieny, alergenów, obsługi sprzętu i reakcji na niezgodności, a także kompetencji zastępstw.",
        "Dostawcy usług, np. firmy sprzątające lub laboratoria, powinni być oceniani i nadzorowani. Umowa nie zastępuje nadzoru nad ich pracą."
      ],
      pitfall: "Firma zewnętrzna wykonująca sprzątanie linii bez przeszkolenia z zasad zakładu jest źródłem ryzyka, za które odpowiada producent."
    },
    {
      p: [
        "Procesy operacyjne to wszystkie działania, które bezpośrednio wpływają na produkt: przyjęcie surowca, przechowywanie, produkcja, pakowanie, etykietowanie i wysyłka. Każdy proces ma parametry, odpowiedzialności i zapisy.",
        "Kontrola procesu polega na tym, że parametry są utrzymywane w zdefiniowanych granicach, a odchylenia są wykrywane i obsługiwane. Dotyczy to temperatur, czasu, masy, ciśnienia, pH i innych wartości istotnych dla bezpieczeństwa.",
        "Traceability, czyli możliwość prześledzenia partii od surowca do klienta, jest wymagana w IFS i w prawie UE (art. 18 rozporządzenia 178/2002). Test identyfikowalności powinien być wykonywany okresowo i zapisywany."
      ],
      pitfall: "Test identyfikowalności, który trwa kilka godzin i nie obejmuje wszystkich etapów, pokazuje realne luki, zanim zrobi to audytor."
    },
    {
      p: [
        "Pomiary są podstawą zarządzania. Zakład ustala, co mierzy, jak często i jak interpretuje wyniki. Dane z reklamacji, audytów, badań i kontroli procesu tworzą obraz skuteczności systemu.",
        "CAPA (corrective and preventive action) zaczyna się od analizy przyczyny, np. metodą 5 Why lub diagramem Ishikawy. Działanie korygujące usuwa skutek, a zapobiegawcze eliminuje przyczynę w innych miejscach systemu.",
        "Skuteczność CAPA sprawdza się po czasie, na podstawie danych. Jeśli ten sam problem wraca, działanie nie było skuteczne i trzeba wrócić do analizy przyczyny."
      ],
      pitfall: "Zamknięcie CAPA po wykonaniu działania, bez sprawdzenia, czy problem zniknął, jest najczęstszą przyczyną powtarzających się niezgodności."
    },
    {
      p: [
        "IFS stosuje system oceny punktowej dla każdego wymagania, który zależy od stopnia jego spełnienia. Ocena wymaga dowodów dla każdego punktu, a nie tylko deklaracji, że procedura istnieje.",
        "W warsztacie ćwiczy się przejście przez jeden rozdział standardu: co wymaga, jakie dowody istnieją, jaka jest ocena i co zrobić, żeby poprawić wynik realnie, a nie tylko na papierze.",
        "Najczęstszy błąd to ocena zawyżona przez brak rzetelnego sprawdzenia praktyki. Audytor sprawdza na hali, czy opis z dokumentu odpowiada temu, co się dzieje."
      ],
      pitfall: "Samoocena oparta na dokumentach bez sprawdzenia na stanowisku pracy zwykle kończy się rozbieżnością z audytorem w kilku punktach."
    }
  ],
  quiz: [
    ["Która wersja IFS Food jest stosowana w audytach?", ["Wersja 6", "Wersja 8", "Wersja 5, bo jest prostsza"], 1],
    ["Podejście procesowe wymaga przede wszystkim:", ["Patrzenia na wejścia, działania, odpowiedzialność i wynik procesu", "Oceniania wyłącznie dokumentów", "Unikania wskaźników"], 0],
    ["Dostawca usług sprzątających pracuje na linii. Co powinien zrobić producent?", ["Nic, bo to firma zewnętrzna", "Przeszkolić i nadzorować pracę zgodnie z zasadami zakładu", "Zlecić sprzątanie tylko w nocy"], 1],
    ["CAPA jest skuteczna, gdy:", ["Została zamknięta w terminie", "Usunięto przyczynę i potwierdzono brak nawrotu", "Ma dużo załączników"], 1],
    ["Analiza przyczyny źródłowej (np. 5 Why) służy do:", ["Znalezienia winnego pracownika", "Ustalenia, dlaczego problem wystąpił, żeby zapobiec jego powrotowi", "Uzasadnienia kosztów"], 1],
    ["Audytor pyta o działanie zapisane w dokumencie. Co jest najlepszą odpowiedzią?", ["Pokazanie dokumentu bez sprawdzenia praktyki", "Pokazanie dokumentu i realnego wykonania na stanowisku", "Odesłanie do konsultanta"], 1]
  ]
};
