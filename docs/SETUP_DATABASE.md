# Podłączenie bazy danych

Projekt Supabase jest już utworzony i schemat bazy został wdrożony.

## Architektura

Vercel nie potrzebuje klucza `service_role`.

Backend bota łączy się z bezpieczną funkcją Supabase Edge Function:

`https://ixivedtgqgryawxsxnqd.supabase.co/functions/v1/creator-platform-db`

Edge Function ma serwerowy dostęp do bazy i weryfikuje żądania skrótem pochodzącym z istniejącego `TELEGRAM_BOT_TOKEN`.

## Wymagane zmienne w Vercel

Wystarczy istniejąca zmienna:

- `TELEGRAM_BOT_TOKEN`

Opcjonalnie:

- `PUBLIC_BASE_URL=https://supermarioofbot-iron-war.vercel.app`
- `SUPABASE_EDGE_URL=https://ixivedtgqgryawxsxnqd.supabase.co/functions/v1/creator-platform-db`

Jeśli `SUPABASE_EDGE_URL` nie jest ustawione, kod używa powyższego adresu domyślnie.

## Pierwsza inicjalizacja

Po wdrożeniu otwórz:

`/api/setup`

Endpoint:

1. potwierdzi token bota z Telegramem,
2. zainicjalizuje bezpieczne połączenie z bazą,
3. ustawi webhook Telegrama.

## Test

Endpoint:

`/api/telegram`

powinien zwrócić między innymi:

```json
{
  "tokenConfigured": true,
  "databaseConfigured": true
}
```

Po tym:

1. wpisz w bocie `/start`,
2. kliknij „Plany”,
3. kliknij „Dodaj plan”,
4. podaj nazwę,
5. podaj cenę w Stars,
6. podaj liczbę dni.

Plan zostanie zapisany w Supabase.
