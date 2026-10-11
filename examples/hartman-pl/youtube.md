# Praca na filmach Hartmana

`youtube.mjs` przygotowuje materiał do analizy: wczytuje napisy, zachowuje czas i tekst, wyszukuje fragmenty, dzieli materiał na okna i wiąże opracowane wnioski z odpowiednimi odcinkami. Wnioski pisze analizujący po przeczytaniu kontekstu. Narzędzie sprawdza ich pochodzenie i zakres czasowy; nie rozpoznaje samodzielnie mechanizmów fizjologicznych.

## Co już zostało wykonane

Przeanalizowano pełne angielskie napisy automatyczne dwóch publicznych filmów z kanału Billa Hartmana. Łącznie zaimportowano 163 fragmenty: 82 z filmu o chodzie i 81 z filmu o miednicy. Napisy wyeksportowano z YouTube w przeglądarce, a następnie przetworzono poniższym narzędziem. Wyniki znajdują się w [analizach](filmy.md) i [danych z powiązaniami](analizy-filmow.json).

Obraz właściwych nagrań nie załadował się w sesji analitycznej. Nie oceniono demonstracji na modelu anatomicznym. Rozróżniono interpretację wypowiedzi od oceny widocznego ruchu.

## Wczytanie napisów

Potrzebny jest Node.js zgodny z wymaganiami repozytorium. Import, wyszukiwanie i przygotowanie analizy nie wymagają dodatkowych pakietów, klucza API ani płatnej usługi.

Formaty wejściowe: VTT, SRT, YouTube JSON3 oraz tekst z wierszami `[m:ss] treść`. Eksport przeglądarkowy może zawierać nagłówek `Video ID`, `Language` i `Captions`. Gdy identyfikator istnieje, musi zgadzać się z adresem filmu. VTT i SRT często nie zawierają identyfikatora: wtedy związek pliku z filmem jest deklaracją osoby importującej, co wynik wyraźnie zapisuje.

Uruchamiaj komendy z głównego katalogu repozytorium. W poniższych przykładach `work/` to istniejący lokalny katalog roboczy; nazwy plików wejściowych zastąp swoimi.

```bash
node examples/hartman-pl/youtube.mjs import \
  --url 'https://www.youtube.com/watch?v=PQZRlndm4cw' \
  --transcript work/captions.txt \
  --duration 431 \
  --out work/transcript.json

node examples/hartman-pl/youtube.mjs search \
  --input work/transcript.json --query 'respiration'

node examples/hartman-pl/youtube.mjs pack \
  --input work/transcript.json --window 60 --out work/pack.json
```

`duration` jest opcjonalne i pochodzi z odtwarzacza albo metadanych. Dla tekstu zawierającego tylko początek wiersza koniec fragmentu wyznacza kolejny znacznik czasu. Koniec ostatniego pozostaje nieznany, jeżeli nie podano długości. Nakładające się napisy są zachowywane; wnioskowanie wymaga przeczytania ich w kontekście. Nie poprawiamy automatycznie błędnie rozpoznanych nazw anatomicznych.

## Pobranie dostępnych napisów

Opcjonalne `fetch` korzysta z zainstalowanego przez użytkownika [yt-dlp](https://github.com/yt-dlp/yt-dlp#installation). Pobiera napisy i metadane jednego filmu, bez pobierania wideo. Argumenty napisów odpowiadają [dokumentacji projektu](https://github.com/yt-dlp/yt-dlp#subtitle-options).

```bash
node examples/hartman-pl/youtube.mjs fetch \
  --url 'https://www.youtube.com/watch?v=PQZRlndm4cw' \
  --lang 'en.*' --out work/download-01
```

Wynik podaje rzeczywiste ścieżki napisów do przekazania do `import`. Katalog wyjściowy musi być nowy. Brak napisów, narzędzia albo błąd usługi kończy polecenie jawnym błędem. Dostęp z YouTube może zależeć od aktualnych ograniczeń serwisu. Ta ścieżka pobierania nie została sprawdzona z działającym `yt-dlp` w tej sesji; dwa rzeczywiste eksporty uzyskano przez przeglądarkę.

## Jak z fragmentów powstaje wiedza

Przy każdej wypowiedzi ustalamy: czego dotyczy, co dokładnie twierdzi autor, jak wyjaśnić to zwykłymi słowami, czego wypowiedź nie dowodzi i czy trzeba obejrzeć obraz. Twierdzenia autora, nasze interpretacje i niewiadome mają osobne oznaczenia.

Po przeczytaniu okien przygotuj plik `findings.json`:

```json
{
  "video_id": "PQZRlndm4cw",
  "transcript_sha256": "dokładna wartość z transcript.json",
  "findings": [
    {
      "id": "F1",
      "kind": "author_claim",
      "start": 225,
      "end": 240,
      "summary_pl": "Tutaj wpisz własne krótkie opracowanie fragmentu.",
      "visual_review": "not_required"
    }
  ],
  "unknowns": []
}
```

`kind`: `author_claim`, `educational_interpretation` lub `unknown`. `visual_review`: `not_required`, `pending` lub `reviewed`. Ostatni status wymaga `visual_review_note` opisującego rzeczywiście wykonaną ocenę obrazu. Sam status jest deklaracją analityka, nie wynikiem automatycznej analizy wideo.

```bash
node examples/hartman-pl/youtube.mjs annotate \
  --input work/transcript.json --findings work/findings.json \
  --out work/analysis.json
```

Walidacja odrzuca inny film, zmieniony skrót transkrypcji, powtórzone identyfikatory i przedziały poza materiałem. Dodaje identyfikatory fragmentów i odnośnik do czasu w YouTube. Nie sprawdza, czy streszczenie logicznie wynika z tekstu — za to odpowiada analiza źródła. Wynik nie zawiera pełnej transkrypcji.

## Obraz i ruch

Jeżeli mamy lokalny plik wideo, `frames` korzysta z `ffmpeg` i `ffprobe`, aby wyciągnąć obrazy z wybranych momentów. Zapisuje skrót pliku, żądane czasy oraz manifest. Nie domyśla się, z jakiego filmu YouTube pochodzi lokalny plik.

```bash
node examples/hartman-pl/youtube.mjs frames \
  --video work/video.mp4 --times '4:30,5:25,5:55' --out work/frames-01
```

Pojedyncza klatka nie pokazuje przebiegu ruchu ani sił. Do oceny demonstracji należy obejrzeć cały właściwy fragment. Czasy uzyskane przez przewijanie `ffmpeg` nie służą do pomiarów biomechanicznych.

## Kontrola i przechowywanie

```bash
node examples/hartman-pl/verify-youtube.mjs
```

Kontrola obejmuje cztery formaty napisów, identyfikator filmu, przedziały, nieaktualne adnotacje oraz rzeczywistą ścieżkę CLI od importu do wniosku. Dodatkowo sprawdzono generowanie klatek przez lokalny `ffmpeg` na własnym dwusekundowym nagraniu testowym. Nie jest to weryfikacja obrazu filmów Hartmana.

Nowe pliki wyjściowe nie nadpisują istniejących. Pełne napisy, paczki do analizy i nagrania przechowuj lokalnie poza katalogiem publikowanych opracowań. Do repozytorium trafiają kod, odnośniki, krótkie opracowania, zakres odczytu i niewiadome.

## Wznawianie pobierania przez przeglądarkę

`browser-corpus.mjs` jest sterownikiem dla już wybranych kart w `cua_repl` i dokumentowanego eksportu transkrypcji. Przed pominięciem wcześniej pozyskanego filmu sprawdza, czy lokalna kopia faktycznie istnieje i ma właściwy identyfikator. Wpis w historycznym rejestrze bez pliku nie jest kompletnym źródłem; sterownik ponawia eksport zamiast oznaczać go jako zachowany. Jeśli istniejący plik różni się od nowego eksportu, zatrzymuje zapis i zachowuje wcześniejszą wersję.

Po przejściu do następnej partii sprawdza również tożsamość otwartych filmów. Nieoczekiwane przekierowanie zatrzymuje kolejkę do oceny aktualnej strony. Samo przekierowanie nie jest automatycznym rozpoznaniem blokady botów; takie rozpoznanie wymaga komunikatu strony. Zatrzymana partia nie uruchamia dalszych prób automatycznie.

```bash
node examples/hartman-pl/verify-browser-corpus.mjs
```

Kontrola wykorzystuje własne dane testowe: brak kopii przy zachowanych metadanych, właściwy identyfikator, konflikt wersji, przywracanie kopii, komunikat weryfikacyjny i nieoczekiwane przekierowanie. Nie dowodzi aktualnej dostępności napisów YouTube. Stan ostatniej próby i nieotwartą część kolejki zapisuje [rejestr dalszych analiz](progresje-filmy.json).
