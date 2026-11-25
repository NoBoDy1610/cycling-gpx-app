# Demonstracja aplikacji

## Przygotowanie przed pokazem

Uruchom PostgreSQL, API i frontend. Przy pokazie porównania uruchom też Ollama z modelem `SpeakLeash/bielik-1.5b-v3.0-instruct:Q8_0`. Jeśli pobierasz model po raz pierwszy, zrób to przed spotkaniem. [Uruchomienie aplikacji](../README.md#uruchomienie-lokalne) · [Konfiguracja modelu](../README.md#model-lokalny)

```bash
curl -fsS http://127.0.0.1:5173/api/health
ollama list
```

Oczekiwana odpowiedź API to `{"status":"ok","database":"connected"}`. Otwórz aplikację, sprawdź widoczność kafelków mapy przy połączeniu z internetem i wygeneruj jedno porównanie na koncie testowym. Do pokazu użyj osobnego konta demonstracyjnego. [Aplikacja lokalna](http://127.0.0.1:5173)

## Przebieg pokazu

1. Otwórz **Rejestracja**, załóż konto demonstracyjne i pokaż pustą historię.
2. W sekcji **Importuj GPX** wybierz **Pobierz przykład z wysokością (Ojców)**. Wgraj pobrany plik i kliknij **Dodaj do historii**. Otwórz **Ojców – przez Pieskową Skałę do Skały**, przybliż mapę i pokaż statystyki. Trasa ma ok. 14 km, 195 m podjazdów i 102 m zjazdów. Wysokości są szacunkami z modelu terenu, a czasy są symulowane. [Próbka z Ojcowa](../apps/web/public/samples/ojcow-cycling-route.gpx) · [Pochodzenie danych](../README.md#uruchomienie-lokalne)
3. Kliknij **Porównaj z AI**. Pokaż **Opis regułowy** i **Opis AI** obok siebie. Obie metody korzystają z tego samego utrwalonego zestawu statystyk. W opisie regułowym każda miara ma własne zdanie, a instrukcja dla modelu zachęca do łączenia powiązanych faktów. Odśwież stronę, żeby pokazać zapis porównania. Tekst modelu i czas generowania mogą się różnić między próbami. Ocenę poprawności, przydatności i zrozumiałości przewidziano na etap badawczy. [Metodologia](../PROJECT.md#pytanie-badawcze)
4. Wgraj **Przykład bez wysokości (Kraków i Warszawa)**, aby pokazać dwa wpisy importowane z jednego pliku i status **Brak danych** przy podjazdach i zjazdach. [Próbka z Krakowa i Warszawy](../apps/web/public/samples/poland-cycling-routes.gpx)
5. Wybierz jedną z tras i kliknij **Usuń trasę**, a następnie **Potwierdź usunięcie trasy**. Pozostałe wpisy zachowają się w historii. Po pokazie możesz usunąć konto demonstracyjne z poziomu **Konto** → **Usuń konto**.

Jeśli model jest chwilowo niedostępny, aplikacja pokazuje komunikat o błędzie próby AI i zachowuje opis regułowy. Możesz go też wygenerować przyciskiem **Wygeneruj opis regułowy**. Jeśli kafelki mapy są niedostępne, linia śladu i statystyki nadal są widoczne.
