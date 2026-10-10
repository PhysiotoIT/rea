# Hartman po ludzku

Niezależne opracowanie publicznie opisanego modelu UHPC Billa Hartmana dla fizjoterapeuty. Celem jest zrozumienie jego sposobu podejmowania decyzji: co obserwuje, jak tworzy hipotezę, dlaczego zmienia pozycję i jak sprawdza wynik.

**Punkt wyjścia:** człowiek może wykonać podobny ruch na różne sposoby. Hartman próbuje rozpoznać, które możliwości są dostępne, a następnie zmienia warunki zadania, żeby udostępnić kolejne. W swoim modelu łączy to z budową ciała, zmianami kształtu tułowia, oddychaniem i rozkładem sił. [Źródło: opis UHPC](https://billhartmanpt.com/learn-from-bill/).

## Zacznij tutaj

**Dobór podparcia i progresji:** [praktyczny przewodnik](podparcie-i-progresja.md) rozdziela pomoc, głębokość, dźwignię, masę i geometrię podparcia stopy. Dodaje konkretną własną próbę obciążania przez przedramię oraz kryteria jej zmiany. Ustalenia **P01–P10** pochodzą z 16 minut kolejnych przedziałów trzech zachowanych tekstów; bez nowych pobrań i bez kontroli obrazu. Dane ścieżek zawierają teraz również wariant podporu.

**Do wdrożenia w gabinecie:** [framework badania i prescription](framework-gabinet.md) prowadzi od celu pacjenta do testu, jednej zmiany, dawki i progresji. Zawiera trzy konkretne ścieżki: ból rzepkowo-udowy, split squat i sięganie ponad głowę, a także zasady stosowania po ACL. Użyj [pustej karty wizyty](karta-wizyty.md) i [danych ścieżek](sciezki-kliniczne.json). To nasza synteza do decyzji terapeuty; dawki nie są przypisane Hartmanowi, a JSON nie jest jeszcze integracją z generatorem.

**Kolejne wizyty i plan dla pacjenta:** [osiem sytuacji decyzyjnych](decyzje-kolejna-wizyta.md) wyjaśnia, co zrobić przy braku transferu, narastaniu objawów z dawką oraz zależności od wskazówek. Nowy przypadek koszykarza i ustalenia **N01–N11** pochodzą z 24,5 minuty kolejnych fragmentów dwóch zachowanych transkrypcji — bez nowych pobrań. [Lokalne narzędzie prescription](prescription.md) eksportuje dokładnie wskazaną listę ćwiczeń z jawnie wpisanymi dawkami; notatki terapeuty można dołączyć opcjonalnie. Nie jest jeszcze podłączone do generatora na stronie.

1. Zacznij od [konkretnych testów i ćwiczeń](konkretne-przypadki.md): 11 kart z ustawieniem, obserwowanym zachowaniem, kryterium sprawdzenia i odnośnikami czasowymi. Przypadek barku prowadzi od pomiaru przez wybór ćwiczenia do testu przy ścianie. Osobny przypadek wstawania określa wysokość siedziska, ustawienie stóp i oczekiwane zmiany.
2. Następnie przejdź do [rekonstrukcji modelu](model-po-ludzku.md) i [przewodnika](przewodnik.md). Osiem krótkich lekcji buduje pojęcia od podstaw.
3. Zajrzyj do [słownika](slownik.md), gdy trafisz na ISA, relative motion, compression lub propulsion.
4. Przejdź przez [cztery przykłady dydaktyczne](przypadki.md): biodro, bark, hamstring i powrót do piłki po ACL.
5. Użyj [karty rozumowania](karta-rozumowania.md) do opisania jednej hipotezy i jej sprawdzenia.
6. Przejdź przez [dwa rzeczywiście przeanalizowane filmy](filmy.md), korzystając z odnośników do konkretnych momentów.
7. Przeczytaj [rozwinięcie na podstawie długich filmów](dlugie-filmy.md): 24 pełne teksty zindeksowane, wybrane fragmenty 15 filmów odczytane i 60 nowych wniosków.

Kolejny krok: [10 dalszych kart i porównania pomiarów](progresje-i-pomiary.md). Obejmują split squat z ciężarem w przeciwnej ręce, goblet vs talerz przed sobą, zmianę podparcia bocznego, cztery kontakty stopy i przypadek po ACL z niejednakową odpowiedzią w kolejnych powtórzeniach. [Rejestr M01–M44](progresje-filmy.json) wiąże 44 nowe ustalenia z wybranymi przedziałami 14 zachowanych tekstów — około 141 minut znaczników czasu. W tej partii **nie pobrano nowych napisów**: przeglądarka została zatrzymana na weryfikacji YouTube. Pozostałe 9 długich nagrań z partii 24 ma teraz również odczyt wybranych fragmentów, zachowany w osobnym rejestrze.

Poprzednia aktualizacja: pozyskano napisy 17 kolejnych filmów; całe dostępne teksty 9 z nich i fragmenty 5 odczytano, 3 były wtedy tylko zindeksowane. Ponownie przeczytano także dwa przypadki ze wcześniejszego długiego nagrania. [Rejestr K01–K43](konkretne-filmy.json) zachowuje zakres tego etapu. **Nie jest to obejrzenie 17 filmów.** Trzy wcześniej tylko zindeksowane teksty mają teraz odczyt wybranych fragmentów w rejestrze M.

Analizę setek transkrypcji opisuje [korpus filmów](korpus.md). Historyczny zapis indeksu 310 tekstów i jego braki są w [raporcie](korpus.json); wnioski sprawdzone w konkretnych fragmentach w [rejestrze przeglądu](przeglad-korpusu.json). Ponownie pozyskana partia 24 najdłuższych filmów ma [osobny raport](korpus-dlugich-filmow.json) i [rejestr fragmentów](dlugie-filmy.json). Zbiory się pokrywają: ich liczebności nie sumujemy.

Do dalszej pracy na filmach służy [narzędzie YouTube](youtube.md): import napisów, wyszukiwanie, paczki do analizy, wnioski ze znacznikami czasu oraz klatki z lokalnego wideo.

Najpierw zrozum różnicę między ruchem jednego segmentu względem drugiego a przemieszczaniem ich razem. Potem poznaj rolę podparcia i obciążenia. ISA zostaw na później — pojedynczy kąt nie wyjaśnia całego pacjenta.

## Jak czytać ocenę źródeł

| Oznaczenie                | Co oznacza                                                                       |
| ------------------------- | -------------------------------------------------------------------------------- |
| Opis autora               | Hartman przedstawia takie wyjaśnienie. To dowód na treść jego modelu.            |
| Badanie podstawowe        | Eksperyment potwierdza węższą zależność fizjologiczną; jego zakres jest opisany. |
| Interpretacja dydaktyczna | Nasz przykład albo sposób uporządkowania materiału.                              |
| Niewiadoma                | Potrzebne są dodatkowe informacje lub badania.                                   |

Rekonstrukcja dotyczy publicznego rdzenia modelu. Nie obejmuje całego płatnego programu, każdej reguły doboru ćwiczeń ani zweryfikowanego protokołu leczenia. Przykłady w `przypadki.md` są fikcyjne i służą nauce rozumowania. Przypadki opowiedziane przez autora w filmach pozostają jego relacjami, bez niezależnej weryfikacji.

## Gdzie tu REA?

Ten katalog jest projektem badawczym w forku `PhysiotoIT/rea`. Wykorzystuje workflow REA oraz jego rzeczywisty format Evidence: zapisuje źródła, powiązania wniosków, ograniczenia i otwarte pytania. Zasady i wykonane operacje opisuje [metoda](metoda-rea.md).

REA bada przede wszystkim oprogramowanie. Tutaj jego moduły porządkują i kontrolują spójność dokumentacji. Ocena fizjoterapeutyczna pochodzi z analizy źródeł; poprawny EvidenceBundle nie potwierdza skuteczności terapii.

## Materiały i odtwarzalność

- [Źródła i zakres odczytu](zrodla.json).
- [Rejestr wniosków](wnioski.json).
- [Otwarte pytania](niewiadome.json).
- `rea-evidence.json` — wygenerowany pakiet Evidence.
- `verification.json` — wynik sprawdzenia odnośników i struktury danych.
- [konkretne-filmy.json](konkretne-filmy.json) — 43 ustalenia o testach, ustawieniach i oczekiwaniach z dokładnym zakresem odczytu.
- `concrete-reviews-verification.json` — zapis kontroli wersji napisów, przedziałów i powiązań z instrukcjami.
- [progresje-filmy.json](progresje-filmy.json) — 44 dalsze ustalenia, zakres odczytu oraz zatrzymana kolejka nowych źródeł.
- `followup-reviews-verification.json` — zapis kontroli drugiej partii konkretnych instrukcji.

Kontrola publicznych metadanych i odnośników nowej partii działa bez budowania REA:

```bash
node examples/hartman-pl/verify-concrete-reviews.mjs
node examples/hartman-pl/verify-concrete-reviews.mjs --followup
node examples/hartman-pl/verify-concrete-reviews.mjs --decisions
node examples/hartman-pl/verify-concrete-reviews.mjs --support
```

Opcja `--captions /ścieżka/do/prywatnych/napisów` dodatkowo weryfikuje dokładne bajty i fragmenty źródeł. Pełne napisy nie są publikowane. Kontrola techniczna nie ocenia trafności klinicznej instrukcji ani obrazu wideo.

W zbudowanym checkoutcie REA:

```bash
node examples/hartman-pl/build-evidence.mjs
node examples/hartman-pl/verify.mjs
node scripts/rea.mjs evidence-import examples/hartman-pl/rea-evidence.json
```

Budowanie CLI opisuje główne [README REA](../../README.md). Te komendy nie instalują silników analizy ani nie zmieniają konfiguracji agenta.

Stan opracowania: 10 października 2026. Dwa filmy opisane w `filmy.md`, historyczny korpus 310 tekstów i partia najdłuższych filmów mają oddzielne zakresy oraz wersje źródeł. Dokumentacja każdego etapu podaje jego rzeczywiste pokrycie.
