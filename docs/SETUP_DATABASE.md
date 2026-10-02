# Podłączenie bazy danych

Kod MVP jest przygotowany pod Supabase/PostgreSQL.

## 1. Utwórz projekt Supabase

Po utworzeniu projektu uruchom zawartość pliku:

`supabase/schema.sql`

w SQL Editor.

## 2. Dodaj zmienne środowiskowe w Vercel

W projekcie Vercel dodaj:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Opcjonalnie:

- `PUBLIC_BASE_URL=https://supermarioofbot-iron-war.vercel.app`

Istniejący token Telegrama pozostaje jako:

- `TELEGRAM_BOT_TOKEN`

## 3. Bezpieczeństwo

`SUPABASE_SERVICE_ROLE_KEY` jest sekretem serwerowym.

Nie wolno:
- wpisywać go do kodu,
- wrzucać go do GitHuba,
- wysyłać go użytkownikom,
- używać go w kodzie klienta / przeglądarce.

## 4. Co zacznie działać po podłączeniu

Po dodaniu bazy:

1. użytkownik otwierający bota zostanie zapisany,
2. twórca dostanie własny rekord,
3. przycisk „Plany” pobierze jego realne plany,
4. „Dodaj plan” uruchomi kreator:
   - nazwa,
   - cena w Telegram Stars,
   - liczba dni dostępu,
5. plan zostanie zapisany w PostgreSQL.

## 5. Test

Po wdrożeniu endpoint:

`/api/telegram`

powinien pokazywać:

```json
{
  "tokenConfigured": true,
  "databaseConfigured": true
}
```
