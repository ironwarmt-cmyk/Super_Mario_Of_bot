# Creator Platform MVP — wzorzec funkcjonalny

## Główny wzorzec

Budujemy własny produkt inspirowany funkcjonalnie dwoma sprawdzonymi usługami:

1. **InviteMember** — główny wzorzec obsługi płatnych społeczności.
2. **Tribute** — wzorzec prostego panelu twórcy, sprzedaży produktów i linków sprzedażowych.

Nie kopiujemy kodu, nazwy, tekstów, logo ani layoutu 1:1. Odtwarzamy mechanikę biznesową i przepływy użytkownika.

## MVP

### Użytkownik końcowy
- /start i menu
- lista planów
- zakup dostępu
- status subskrypcji
- przycisk wejścia do kanału/grupy
- przypomnienie o końcu dostępu
- automatyczne odebranie dostępu po wygaśnięciu
- /paysupport

### Twórca / sprzedawca
- tworzenie planów
- przypisywanie kanałów i grup do planów
- produkty jednorazowe
- lista klientów
- podstawowe statystyki
- broadcast
- linki polecające

### Administrator platformy
- lista twórców
- lista transakcji
- prowizje
- blokady / moderacja
- refundy obsługiwane zgodnie z metodą płatności

## Płatności

Dobra i usługi cyfrowe sprzedawane wewnątrz Telegrama muszą używać Telegram Stars. Fizyczne towary/usługi mogą korzystać z innych obsługiwanych operatorów płatności zgodnie z zasadami Telegrama i operatora.

## Kolejność wdrożenia

1. Telegram webhook i menu
2. baza danych
3. model twórca / klient / plan / subskrypcja
4. Telegram Stars
5. automatyczny dostęp do kanałów i grup
6. przypomnienia i wygasanie
7. panel twórcy
8. produkty jednorazowe
9. afiliacja
10. analityka
