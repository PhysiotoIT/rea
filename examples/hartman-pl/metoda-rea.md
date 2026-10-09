# Co rzeczywiście robi tutaj REA

## Zakres

Badany obiekt to publicznie opisany model ruchu. Odczytano materiały autora, opisy wybranych odcinków, wskazane fragmenty transkrypcji rozmowy oraz pełne angielskie napisy dwóch filmów YouTube. Obraz tych nagrań nie załadował się w sesji, dlatego demonstracje pozostają nieocenione. Nie analizowano prywatnych materiałów kursowych.

Podstawa pracy: fork `PhysiotoIT/rea`, commit `6e4535c1011f1982e9ab07b7ebcd600c19cd494d`. Instrukcje: [workflow](../../skills/reverse-engineer-anything/SKILL.md) i [Evidence workflows](../../skills/reverse-engineer-anything/references/evidence-workflows.md).

## Przełożenie workflow

| REA                 | W tym opracowaniu                                                   |
| ------------------- | ------------------------------------------------------------------- |
| Tożsamość artefaktu | Konkretny indeks źródeł i wniosków, identyfikowany sumą SHA-256.    |
| Obserwacja          | Metadane i zakres odczytu publicznego materiału.                    |
| Wniosek             | Parafraza stanowiska autora albo jawnie oznaczona interpretacja.    |
| Evidence links      | Odnośniki łączące wniosek z rekordami źródeł.                       |
| Residual unknown    | Osobny rekord pytania, którego materiały nie rozstrzygają.          |
| Weryfikacja         | Spójność pakietu, identyfikatorów, odnośników i zakresu deklaracji. |

`build-evidence.mjs` importuje prawdziwe moduły REA: `createEvidence`, `createEvidenceBundle`, `createResidualUnknown` i ich walidatory. Generuje rekordy z deterministycznymi identyfikatorami. Wnioski kliniczne mają `confidence: inferred` oraz `authority: analyst-inference`; nazwa dostawcy jawnie wskazuje na ręczną analizę. Nie pochodzą z Ghidry, Hoppera ani pomiaru pacjenta.

Pakiet można następnie wczytać rzeczywistą komendą `rea evidence-import`. Sprawdza to format i integralność danych. Nie uruchamiano analizatorów binarnych, nie zmieniano MCP i nie wykonywano `rea setup`.

[Narzędzie YouTube](youtube.md) dodaje rzeczywistą ścieżkę importu napisów, zachowuje znaczniki czasu i SHA-256, a następnie wiąże ręcznie opracowane wnioski z fragmentami. Pakiet REA zawiera także metadane tego wykonania i osobne rekordy interpretacji filmów. Suma kontrolna identyfikuje przeczytany plik, nie gwarantuje poprawnego rozpoznania mowy. Pełne transkrypcje pozostają lokalnie.

## Granica wiarygodności

W rejestrze źródeł rozróżniono pełniejszy odczyt fragmentów transkrypcji, abstrakt badania i opis odcinka. Opis odcinka pozwala ustalić temat i stanowisko deklarowane przez autora. Nie wystarcza do odtworzenia wszystkich szczegółów wykonania ćwiczenia.

Przeszukanie sieci pod hasłami łączącymi nazwisko Hartmana, ISA, validation/reliability/study nie stanowi przeglądu systematycznego. Brak znalezionego potwierdzenia w tym ograniczonym wyszukiwaniu nie dowodzi, że badania nie istnieją. Trafność pełnej klasyfikacji i przewaga kliniczna UHPC pozostają w tym projekcie niewiadomymi.

W szczególności eksperymenty z udziałem przepony nie są testem skuteczności interwencji Hartmana. Także techniczna poprawność pakietu Evidence nie rozstrzyga jego klinicznych hipotez.
