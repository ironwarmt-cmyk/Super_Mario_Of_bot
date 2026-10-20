window.QA_COURSES=window.QA_COURSES||{};window.QA_COURSES.audit = {
  tier: "pro",
  title: "Audyt wewnętrzny",
  lead: "Planowanie, dobór próby, pytania, dowody, klasyfikacja i raportowanie ustaleń. Audyt wewnętrzny ma wykryć problemy zanim zrobi to audytor zewnętrzny lub klient.",
  mods: [
    "Program audytów",
    "Plan audytu i próbka",
    "Pytania audytowe",
    "Dowody obiektywne",
    "Niezgodności i raport"
  ],
  lessons: [
    {
      p: [
        "Program audytów wewnętrznych określa, które obszary, procesy i wymagania są audytowane, jak często i przez kogo. Podstawą są ryzyko, wyniki poprzednich audytów, reklamacje i zmiany w zakładzie. Zasady audytowania opisuje norma ISO 19011.",
        "Audytor wewnętrzny powinien być niezależny od audytowanego obszaru, przynajmniej w zakresie oceny. Nie musi być z zewnątrz, ale nie może oceniać własnej pracy.",
        "Program jest zatwierdzany przez kierownictwo i przeglądany przy zmianach. Wyniki audytów wracają do przeglądu zarządzania i do planowania CAPA."
      ],
      pitfall: "Program, w którym audytuje się zawsze te same, łatwe obszary, daje fałszywe poczucie kontroli nad systemem."
    },
    {
      p: [
        "Plan audytu określa cel, zakres, kryteria (np. wymagania standardu i procedury), datę, skład zespołu i harmonogram. Plan jest przekazywany audytowanemu przed audytem.",
        "Próba audytowa to część dokumentów, zapisów i procesów, które audytor sprawdza. Dobór próby powinien być oparty na ryzyku i na tym, czy pozwala ocenić działanie procesu, a nie tylko jego istnienie.",
        "Przy audytach procesu warto obserwować pracę w kilku zmianach i na różnych stanowiskach. Jeden poranek nie pokazuje, jak system działa przez cały tydzień."
      ],
      pitfall: "Próba złożona wyłącznie z najnowszych zapisów pomija okresy, w których problemy mogły się pojawić."
    },
    {
      p: [
        "Dobre pytanie audytowe jest otwarte i dotyczy działania, np. „Jak postępujecie, gdy temperatura w chłodni przekroczy limit?”. Pytanie zamknięte, np. „Czy macie procedurę?”, daje tylko odpowiedź tak lub nie.",
        "Audytor zadaje pytania pracownikom z różnych poziomów, a odpowiedzi konfrontuje z dokumentami i obserwacją. Rozbieżność między tym, co mówi kierownik, a tym, co robi operator, jest istotną informacją.",
        "Pytania powinny wynikać z wymagań, a nie z ogólnych przekonań audytora. Każde pytanie musi mieć powiązanie z kryterium."
      ],
      pitfall: "Audytor, który pyta głównie o to, co jest w dokumencie, nie sprawdza systemu. Dobre pytanie zaczyna się od „co się dzieje, kiedy…”."
    },
    {
      p: [
        "Dowód obiektywny to informacja, którą można zweryfikować: zapis, obserwacja, wynik pomiaru, wywiad z pracownikiem potwierdzony zapisem. Opinia audytora sama w sobie nie jest dowodem.",
        "Dowody muszą być spójne. Jeśli zapis temperatury pokazuje wartości w normie, a termometr pokazuje inne, różnica wymaga wyjaśnienia, a nie zignorowania.",
        "Audytor zapisuje dowody w notatkach z datą, miejscem i źródłem. Dzięki temu ustalenia można odtworzyć i obronić."
      ],
      pitfall: "Ustalenie oparte na pamięci lub przekazie, bez zapisu i bez weryfikacji, jest słabe i łatwo je podważyć."
    },
    {
      p: [
        "Niezgodność to brak spełnienia wymagania. Klasyfikacja zależy od wpływu na bezpieczeństwo żywności i na zgodność z systemem. Typowy podział to niezgodność krytyczna, większa i mniejsza, choć nazwy mogą się różnić w zależności od schematu.",
        "Raport audytu zawiera zakres, kryteria, daty, osoby, ustalenia z dowodami i klasyfikacją oraz zalecenia. Audytowany przygotowuje plan działań korygujących z terminami i osobami odpowiedzialnymi.",
        "Skuteczność działań sprawdza się przy kolejnym audycie lub przez weryfikację po terminie. Zamknięcie niezgodności bez weryfikacji nie kończy sprawy."
      ],
      pitfall: "Raport, w którym ustalenia są ogólne i bez dowodów, nie daje kierownictwu podstaw do działania, a audytowany nie wie, co naprawić."
    }
  ],
  quiz: [
    ["Na czym powinien opierać się program audytów wewnętrznych?", ["Na wygodzie zespołu audytującego", "Na ryzyku, wynikach poprzednich audytów i reklamacjach", "Wyłącznie na wymaganiach klienta"], 1],
    ["Dobra próba audytowa powinna:", ["Być zawsze największa możliwa", "Być dobrana do ryzyka i pozwalać ocenić działanie procesu", "Obejmować tylko dokumenty"], 1],
    ["Które pytanie audytowe jest najlepsze?", ["Czy macie procedurę?", "Jak postępujecie, gdy temperatura w chłodni przekroczy limit?", "Czy wszystko jest w porządku?"], 1],
    ["Dowód obiektywny to:", ["Opinia audytora", "Informacja, którą można zweryfikować, np. zapis lub obserwacja", "Ustne zapewnienie kierownika"], 1],
    ["Niezgodność powinna odnosić się do:", ["Opinii audytora", "Wymagania i obiektywnego dowodu", "Preferencji kierownika"], 1]
  ]
};
