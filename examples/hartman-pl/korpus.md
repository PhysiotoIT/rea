# Analiza dużego korpusu filmów

Na kanale `@BillHartmanPT` 9 października 2026 r. zaobserwowano **937 unikalnych filmów**: 852 w zakładce Wideo, 80 Shorts i 5 transmisji. Liczba odpowiadała nagłówkowi kanału. Tytuły są takie, jak wyświetlił je YouTube, często po automatycznej lokalizacji; nie przedstawiamy ich jako oryginalnych tytułów angielskich.

Dokładne liczby pozyskanych i przetworzonych transkrypcji są w `korpus.json`. Cały tekst dostępnych napisów trafia do prywatnego indeksu. Publiczny raport zawiera metadane, skróty SHA-256, wyniki zliczeń i lokalizacje fragmentów. Pełnych cudzych transkrypcji nie publikujemy w repo.

`korpus.json` zachowuje historyczny etap 310 tekstów. Po utracie wcześniejszych plików roboczych ponownie pozyskano źródła partii najdłuższych filmów. Jej osobny raport `korpus-dlugich-filmow.json` obejmuje 24 teksty oraz odczyt wybranych fragmentów z 15 filmów. Zbiory mają wspólne identyfikatory i mogą mieć różne wersje napisów; nie sumujemy ich liczebności. Nowe ustalenia i sposób użycia kolejki są w [rozwinięciu z długich filmów](dlugie-filmy.md).

## Trzy różne zakresy analizy

| Zakres                           | Co rzeczywiście wykonano                                                                                                                                              | Czego z tego nie wyprowadzamy                                                                                   |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Inwentaryzacja                   | Odczyt pozycji z widocznych zakładek kanału, deduplikacja po identyfikatorze filmu.                                                                                   | Obecność filmu nie oznacza dostępności napisów.                                                                 |
| Analiza całego dostępnego tekstu | Import wypowiedzi z czasami, sprawdzenie tożsamości, indeks pojęć PL/EN, współwystępowanie w oknach 60 sekund, wykrywanie identycznego tekstu.                        | Dopasowanie słowa nie oznacza potwierdzenia mechanizmu ani pełnego zrozumienia filmu.                           |
| Analiza znaczenia                | Czytanie źródłowych fragmentów i zapisywanie parafraz z czasami oraz skrótem dokładnie użytej transkrypcji. Pole `scope` rozróżnia cały tekst napisów i wybrane okna. | Sprawdzenie wybranych fragmentów nie oznacza przeczytania całego filmu. Tekst nie zastępuje oceny demonstracji. |

Rezultat dydaktyczny: [model po ludzku](model-po-ludzku.md). Sprawdzone znaczeniowo ustalenia: [przegląd korpusu](przeglad-korpusu.json). Wcześniejsze szczegółowe analizy dwóch filmów: [filmy](filmy.md).

## Co zlicza indeks?

| Grupa                  | Szukane rodziny pojęć                                          |
| ---------------------- | -------------------------------------------------------------- |
| Ruch względny          | relative motion/movement, ruch względny/relatywny              |
| Orientacja             | orientation/oriented, orientacja                               |
| Kompresja i ekspansja  | compression/expansion, kompresja/ekspansja                     |
| Oddech i ciśnienie     | breath, pressure, diaphragm oraz polskie odpowiedniki          |
| Propulsja              | propulsion, gait, midstance, propulsja/chód                    |
| ISA i archetypy        | ISA, infrasternal, archetype, wide/narrow oraz szeroki/wąski   |
| Warunki ruchu          | constraint, contact, gravity, ground oraz polskie odpowiedniki |
| Uczenie i interwencje  | learning, adaptation, intervention, representation, retest     |
| Strategie i kompromisy | strategy, compensation, trade-off                              |
| Siła i prędkość        | force, velocity, athlete, sprint, deceleration                 |

Grupy są szerokimi filtrami do wyszukiwania. Na przykład „szeroki” może dotyczyć czegoś innego niż ISA, a „siła” nie musi oznaczać konkretnego rodzaju treningu. Błędy rozpoznawania mowy, tłumaczenia i granice okien mogą powodować fałszywe dopasowania lub pominięcia. Liczymy filmy, nie powtórzenia słowa w kolejnych napisach. Współwystępowanie dwóch pojęć oznacza znalezienie ich w tym samym oknie; nie oznacza relacji przyczynowej.

## Odtworzenie analizy offline

Potrzebne: Node.js 24, zaobserwowany katalog JSON i prywatny folder eksportów `.txt`. Każdy plik musi nazywać się `<video_id>.txt` i mieć nagłówek `Video ID:` zgodny z katalogiem. Powtarzające się czasy z powodu zaokrąglenia do sekund są zachowane. Koniec takiej wypowiedzi jest wywnioskowany z następnego późniejszego czasu; ostatni koniec może pozostać nieznany.

```sh
node examples/hartman-pl/corpus.mjs \
  --catalog /path/to/catalog.json \
  --captions /path/to/private/transcripts \
  --manifest /path/to/acquisition.json \
  --reviews examples/hartman-pl/przeglad-korpusu.json \
  --out /path/to/new-run
```

`private-index.json` zawiera cały tekst do dalszej pracy. `report.json` nie zawiera pełnych napisów. Folder wyjściowy musi być nowy; poprzedni wynik nie jest nadpisywany. Parametry `--manifest` i `--reviews` są opcjonalne. Adnotacje odnoszą się do skrótu konkretnego eksportu; inny język lub ponowne wygenerowanie napisów może wymagać ponownego sprawdzenia ustaleń.

Pozyskiwanie napisów pojedynczego filmu przez opcjonalny `yt-dlp` jest opisane w [instrukcji narzędzia](youtube.md). W tej sesji ten transport nie pozwolił na masowe pobieranie: klient API został odrzucony, a próba `yt-dlp` zakończyła się błędem zaufania TLS. Dostępne dane pozyskiwano przez udokumentowany eksport przeglądarkowy. Nie wyłączano weryfikacji TLS i nie stosowano proxy do obchodzenia blokady.

## Jak czytać niepowodzenia

`not_attempted` znaczy, że pozycji jeszcze nie próbowano pobrać. `export_unavailable` oznacza komunikat eksportera, nie dowód trwałego braku napisów. `error` zachowuje konkretny błąd. `blocked` oznacza zaobserwowaną blokadę, po której sterownik zatrzymuje dalszą nawigację. Żadnej z tych pozycji nie liczymy jako przeczytanej.

Test `verify-corpus.mjs` używa 1000 **syntetycznych, samodzielnie napisanych** pozycji. Sprawdza skalę, tożsamość, duplikaty, znaczenie zliczeń oraz nienadpisywanie plików. Liczba testowych pozycji nie jest liczbą rzeczywiście pozyskanych filmów Hartmana.

## Wyszukiwanie fragmentów do interpretacji

```sh
node examples/hartman-pl/corpus.mjs search \
  --index /path/to/new-run/private-index.json \
  --query "relative motion" \
  --out /path/to/new-private-packet.json
```

Paczka zawiera wszystkie dopasowane okna, tekst i identyfikatory wypowiedzi. Jest prywatnym materiałem roboczym. Do publicznego rejestru trafiają krótkie parafrazy, zakres czasowy i SHA-256 źródła.

`browser-corpus.mjs` jest sterownikiem do użycia wewnątrz `cua_repl` z istniejącymi uchwytami kart. Korzysta wyłącznie z udokumentowanego eksportu, nawigacji i odczytu stanu strony. Zapisuje manifest, kolejkę i kursor wznowienia; nie jest samodzielnym downloaderem Node.js. `restoreCopies` odtwarza brakującą kopię z zachowanego lokalnego eksportu bez nowego zapytania do serwisu. Wykrycie sygnału blokady wstrzymuje kolejne operacje i wymaga sprawdzenia widocznej strony, zgodnie z zasadami przeglądarki.

## Pakiet REA dla korpusu

Pakiet `rea-corpus-evidence.json` jest oddzielny od wcześniejszego `rea-evidence.json`. Zawiera obserwację katalogu, pokrycie, wyniki filtrów, pochodzenie sprawdzonych fragmentów, parafrazy i otwarte pytania.

```sh
node examples/hartman-pl/build-corpus-evidence.mjs
node scripts/rea.mjs evidence-import examples/hartman-pl/rea-corpus-evidence.json
node examples/hartman-pl/verify-corpus.mjs
node examples/hartman-pl/verify-browser-corpus.mjs
node examples/hartman-pl/verify-corpus-report.mjs
```

Poprawny import REA sprawdza strukturę i powiązania danych. Nie weryfikuje biomechaniki ani skuteczności klinicznej modelu.
