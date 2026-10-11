# Narzędzie: plan z jawnie wybranych ćwiczeń

`prescription.mjs` eksportuje lokalny JSON do czytelnego planu Markdown. Działa niezależnie od kompilacji REA i nie wymaga dostępu do internetu. To narzędzie dokumentacji, nie algorytm diagnozowania lub wyboru leczenia. Nie zostało połączone z działającą stroną ani generatorem PDF.

## Użycie

```bash
node examples/hartman-pl/prescription.mjs \
  examples/hartman-pl/prescription-przyklad.json \
  /tmp/moj-plan.md
```

Wybierz nową nazwę pliku docelowego: istniejący plik nie zostanie nadpisany. Wynik komendy podaje liczbę wyeksportowanych ćwiczeń i ścieżkę pliku.

[Dane fikcyjnego przykładu](prescription-przyklad.json) i [jego plan](prescription-przyklad.md) zawierają dwa ćwiczenia z jawnymi dawkami. Te dawki są przykładami naszego opracowania, a nie informacjami odzyskanymi od Hartmana. Dla rzeczywistego pacjenta wpisz własny plan po badaniu.

## Co wpisujesz

| Poziom | Wymagane dane |
| --- | --- |
| Plan | `schema_version: 1`, tytuł, cel, monitorowanie reakcji, sposób przeglądu planu, lista ćwiczeń |
| Ćwiczenie | Unikalne ID, nazwa, strona, ustawienie, lista wskazówek, dawka, częstotliwość, progresja, regresja |
| Opcjonalny film | `video` z `label_pl` i `url`; URL HTTPS bez danych logowania |
| Opcjonalne notatki terapeuty | `clinical_notes_pl` jako lista tekstów |

Każde pole tekstowe jest pojedynczą, niepustą linią; wiele wskazówek wpisz jako osobne elementy `cues_pl`. Dokładne nazwy pól pokazuje plik przykładu. Nieobsługiwane pola są odrzucane, aby nie ignorować po cichu danych takich jak `selected`.

## Wybór ćwiczeń i widoczność notatek

- Eksport obejmuje **dokładnie `exercises`**, w podanej kolejności. Nie dodaje automatycznie przygotowania ani innych ćwiczeń z biblioteki.
- Usuń z listy elementy, których nie chcesz wysłać. Jeśli wpiszesz pięć ćwiczeń, wynik ma pięć sekcji ćwiczeń.
- Brak dawki powoduje błąd. Narzędzie nie uzupełnia jej przykładem z karty klinicznej.
- Notatki terapeuty są domyślnie pomijane. Możesz jawnie dołączyć je flagą:

```bash
node examples/hartman-pl/prescription.mjs \
  examples/hartman-pl/prescription-przyklad.json \
  /tmp/moj-plan-z-notatkami.md --include-clinical-notes
```

Nie ma automatycznego wydzielania informacji wrażliwych: pacjent zobaczy treści, które wpiszesz do pól planu. Klasyfikację ISA i hipotezy mechanizmu możesz zachować w opcjonalnych notatkach zamiast w instrukcji ćwiczenia. W repozytorium przechowuj puste szablony i fikcyjne przykłady; plany rzeczywistych pacjentów trzymaj w swojej dokumentacji.

Film dodawaj jako instrukcję ćwiczenia dopiero po sprawdzeniu, że pokazuje właściwy wariant i stronę. W przykładzie pole `video` jest pominięte, ponieważ odnośniki Hartmana w opracowaniu nie mają jeszcze zakończonej kontroli wizualnej. Walidacja HTTPS sprawdza format adresu, nie dostępność ani treść filmu.

## Weryfikacja

```bash
node examples/hartman-pl/verify-prescription.mjs
```

Sprawdza rzeczywisty eksport jednej i kilku wybranych pozycji, brak automatycznych dodatków, obowiązkowe dawkowanie, widoczność notatek, błędne adresy, bezpieczny zapis tekstów w Markdown oraz zachowanie istniejącego pliku przez CLI. Nie ocenia trafności klinicznej prescription ani zgodności filmu z instrukcją.
