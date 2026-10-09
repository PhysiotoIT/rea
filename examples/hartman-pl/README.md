# Hartman po ludzku

Niezależne opracowanie publicznie opisanego modelu UHPC Billa Hartmana dla fizjoterapeuty. Celem jest zrozumienie jego sposobu podejmowania decyzji: co obserwuje, jak tworzy hipotezę, dlaczego zmienia pozycję i jak sprawdza wynik.

**Punkt wyjścia:** człowiek może wykonać podobny ruch na różne sposoby. Hartman próbuje rozpoznać, które możliwości są dostępne, a następnie zmienia warunki zadania, żeby udostępnić kolejne. W swoim modelu łączy to z budową ciała, zmianami kształtu tułowia, oddychaniem i rozkładem sił. [Źródło: opis UHPC](https://billhartmanpt.com/learn-from-bill/).

## Zacznij tutaj

1. Zacznij od [prostej rekonstrukcji modelu](model-po-ludzku.md). Następnie przeczytaj [przewodnik](przewodnik.md). Osiem krótkich lekcji buduje pojęcia od podstaw.
2. Zajrzyj do [słownika](slownik.md), gdy trafisz na ISA, relative motion, compression lub propulsion.
3. Przejdź przez [cztery przykłady](przypadki.md): biodro, bark, hamstring i powrót do piłki po ACL.
4. Użyj [karty rozumowania](karta-rozumowania.md) do opisania jednej hipotezy i jej sprawdzenia.
5. Przejdź przez [dwa rzeczywiście przeanalizowane filmy](filmy.md), korzystając z odnośników do konkretnych momentów.
6. Przeczytaj [rozwinięcie na podstawie długich filmów](dlugie-filmy.md): 24 pełne teksty zindeksowane, wybrane fragmenty 15 filmów odczytane i 60 nowych wniosków.

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

W zbudowanym checkoutcie REA:

```bash
node examples/hartman-pl/build-evidence.mjs
node examples/hartman-pl/verify.mjs
node scripts/rea.mjs evidence-import examples/hartman-pl/rea-evidence.json
```

Budowanie CLI opisuje główne [README REA](../../README.md). Te komendy nie instalują silników analizy ani nie zmieniają konfiguracji agenta.

Stan opracowania: 9 października 2026. Dwa filmy opisane w `filmy.md`, historyczny korpus 310 tekstów i partia najdłuższych filmów mają oddzielne zakresy oraz wersje źródeł. Dokumentacja każdego etapu podaje jego rzeczywiste pokrycie.
