# QUALITY ASSURANCE SUPPORT — pakiet 30 dni

Źródło: oryginalny pakiet użytkownika `QUALITY_30_DNI_PAKIET_REALIZACYJNY(1).zip` (109 MB).
**Konto docelowe:** `@jem_bezpiecznie`; **promowany produkt:** Quality Assurance Support.
**Okres:** 12.10–10.11.2026; **czas lokalny:** Europe/Warsaw; **godziny:** post 12:30, rolka 19:00.
**Liczba materiałów:** 30 rolek + 30 postów, w tym 15 karuzel (4 slajdy) i 15 pojedynczych.

## Faktycznie przygotowane

- `campaign/quality30.py` pobiera oryginalne pliki z pakietu i szykuje materiały dnia jako szkice JPG/MP4.
- `.github/workflows/quality-30-dni.yml` definiuje uruchomienie według harmonogramu, ale **działa automatycznie wyłącznie po umieszczeniu na domyślnej gałęzi**.
- Dzienny pakiet trafia do GitHub Actions Artifacts z krótką retencją. Status każdego wpisu: `BLOCKED_QA`.
- Nie używa płatnych API, nie wysyła materiałów na IG/TikTok.

## Istotny blocker dotyczący plików

Pakiet ZIP NIE jest przechowywany w repozytorium. Repo `ironwarmt-cmyk/Super_Mario_Of_bot` jest publiczne.
Z tego powodu nie wolno publikować całego archiwum jako publiczny GitHub Release bez świadomej zgody właściciela.
Workflow używa nazwy Release `quality-30d-assets` i assetu `quality-30-dni.zip`, ale taki Release nie został jeszcze utworzony. Uruchomienie bez niego zakończy się błędem pobierania, nie publikacją.
Przed automatyzacją należy wskazać bezpieczne, dostępne dla harmonogramu miejsce na pliki: najlepiej prywatny repozytorium/kontrolowany zasób, ewentualnie świadomie opublikowany publiczny asset.

## Wymagane QA przed publikacją

1. Wszystkie 30 dni źródłowego arkusza mają `DO_WERYFIKACJI`, a `QA_I_POMIAR` nie zawiera zatwierdzeń.
2. Zweryfikować IFS Food v8 z Doctrine v5 (23.04.2026) oraz BRCGS Food 9 z F926 (10.08.2026). Nie wykorzystywać insygniów certyfikacji.
3. Sfinalizować lektora PL i zsynchronizować SRT. Podglądowe MP4 mają 540×960 i 12 kl./s; docelowo 1080×1920 i 25–30 kl./s, naturalny lektor i dynamiczny montaż.
4. Użyć rzeczywistych zrzutów ekranu aplikacji wyłącznie po sprawdzeniu jej funkcji i danych na ekranie.
5. Każde płatne CTA poprzedzić testem zakupu E2E, inaczej publikować wyłącznie edukacyjnie.
6. Potwierdzić serwerowe uprawnienia Instagram Graph API lub autoryzowane Windsor.ai. TikTok Ads nie zapewnia automatycznej publikacji organicznej.
7. Utrzymywać trwały rejestr publikacji z unikatowymi ID i linkami do postów; blokować duplikaty.

## QA archiwum wykonane lokalnie

- 405 pozycji w ZIP.
- 390 wymaganych odwołań do zasobów skontrolowanych: brak brakujących plików i błędnych proporcji.
- Posty i okładki: 1080×1350 oraz 1080×1920; sceny: 720×1280.
- Wszystkie 30 wersji wideo podglądowych i lektorów są dostarczone.
- QA kompletności ≠ QA merytoryczna i jakości kreatywnej. **Production GO: NIE**.

## Co uruchomić po spełnieniu warunków

1. Przenieść media do bezpiecznego magazynu, podłączyć go do workflow.
2. Ukończyć lektora i montaż, a następnie zweryfikować fakty i aplikację.
3. Przeprowadzić E2E dla pierwszych dwóch publikacji.
4. Dopiero potem włączyć harmonogram do głównej gałęzi i bezpieczne API publikacyjne.

Ten PR nie zmienia produkcyjnej aplikacji ani usług Railway.