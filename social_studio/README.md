# Jem Bezpiecznie — przygotowanie automatycznego studia 7+7

Status: **DRAFT ENGINE / NIE WDROŻONO PUBLICZNEJ PUBLIKACJI**.

Workflow tworzy **codziennie jedną karuzelę o 12:30 i jedną rolkę o 18:30** w strefie Europe/Warsaw, czyli 7+7 w tygodniu. Używa standardowego GitHub Actions Ubuntu, Pillow i FFmpeg. Generuje 3 zdjęcia 1080×1350 albo rolkę 1080×1920 o długości 18 sekund oraz plik manifestu i podpis ze źródłem. Materiały trafiają do artefaktu GitHub na 1 dzień. Brak płatnych kluczy i wywołań API.

## Ograniczenia — bez udawania

- **Nie jest to jeszcze studio filmów AI premium**: MP4 ma trzy plansze, brak filmowych ujęć B-roll i polskiego lektora.
- Tematy pochodzą z **14 przygotowanych redakcyjnie pozycji** WHO / EFSA / Komisja Europejska. Nie ma jeszcze autonomicznej analizy nowych badań ani oceny źródeł w czasie rzeczywistym. Zawartość powtarza się w cyklu 14 dni. Produkcja automatyczna nie zastępuje audytu merytorycznego.
- **Instagram i TikTok NIE publikują automatycznie**: nie ma jeszcze zweryfikowanego, przekazanego do GitHub Actions dostępu do oficjalnych API. Istniejące połączenie Windsor.ai w ChatGPT nie jest tokenem konta Meta dla GitHub Actions.
- Z powodu braku autoryzacji **publishing_enabled=false**. Nie używaj nieoficjalnych automatów logujących się hasłem.

## Docelowe darmowe rozszerzenia do wdrożenia

- Pexels API (z darmowym kluczem użytkownika i prawidłową atrybucją) — licencjonowane ujęcia; nie pobierać plików bez klucza, nie udawać oryginalnego generowania AI.
- Lokalny polski neural TTS z potwierdzoną licencją głosu i stabilnymi modelami — lektor.
- Moduł redakcyjny: oficjalne źródła EFSA, GIS, KE, lista artykułów, daty, duplikaty, kontrola faktów i blokowanie publikacji niezweryfikowanych twierdzeń.
- Meta Graph API i TikTok Content Posting API z prawidłowymi uprawnieniami i zatwierdzeniem. Potrzebne bezpieczne przechowywanie sekretów oraz publiczne URL dla materiałów, zgodnie z wymaganiami API.
- Trwały dziennik publishing idempotency i niezależny Quality Gate. Włączyć dopiero po testach E2E.

## Uruchomienie testowe

```sh
pip install -r social_studio/requirements.txt
python social_studio/studio.py --kind carousel --preview
python social_studio/studio.py --kind reel --preview
```

Wymagania systemowe: ffmpeg i DejaVuSans. Publiczny standardowy GitHub-hosted runner jest bezpłatny; artefakty i limity przechowywania podlegają zasadom GitHub. Nie konfigurować płatnych runnerów.

Materiał ma status `READY_FOR_QA`, a jego publikacja `DISABLED`. Nie oznaczać jako opublikowany bez odpowiedzi z zewnętrznej platformy.
