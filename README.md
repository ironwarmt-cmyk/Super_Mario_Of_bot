# @Super_Mario_Official_bot backend

Minimalny backend Telegram webhook pod Vercel.

## Sekret
Dodaj zmienną środowiskową:
- TELEGRAM_BOT_TOKEN

## Endpoint webhooka
- https://TWOJ-PROJEKT.vercel.app/api/telegram

## Po wdrożeniu
Ustaw webhook Telegrama na endpoint powyżej.

## Quality AI
Do działania specjalistów BRC / IFS / HACCP / reklamacje / CAPA / inne ustaw w Vercel:
- OPENAI_API_KEY — sekret API, nigdy nie commituj go do repozytorium
- OPENAI_QUALITY_MODEL — opcjonalnie, domyślnie gpt-6-sol

Asystent korzysta z Responses API, pamięci rozmowy zapisanej w Supabase oraz web search do bieżącej weryfikacji źródeł.
