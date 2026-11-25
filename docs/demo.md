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
2. W sekcji **Importuj GPX** wybierz **Pobierz przykład z Polski**. Wgraj pobrany plik i kliknij **Dodaj do historii**. W historii pojawią się dwa wpisy z jednego pliku. [Próbka GPX](../apps/web/public/samples/poland-cycling-routes.gpx)
3. Otwórz **Kraków – z Dębnik do Tyńca** (ok. 10,1 km), przybliż mapę i pokaż statystyki. Następnie przełącz się na **Warszawa – nad Wisłą z Powiśla na Żoliborz** (ok. 4,2 km). Geometria pochodzi z danych OpenStreetMap, czasy są symulowane, a obie próbki mają status **Brak danych** dla sumy podjazdów i zjazdów.
4. Kliknij **Porównaj z AI**. Pokaż **Opis regułowy** i **Opis AI** obok siebie. Obie metody korzystają z tego samego utrwalonego zestawu statystyk. Odśwież stronę lub wróć do trasy z historii, żeby pokazać zapis porównania. Tekst modelu i czas generowania mogą się różnić między próbami. Ocenę poprawności, przydatności i zrozumiałości przewidziano na etap badawczy. [Metodologia](../PROJECT.md#pytanie-badawcze)
5. Wybierz **Usuń trasę** i **Potwierdź usunięcie trasy**. Drugi wpis pozostanie w historii. Po pokazie możesz usunąć konto demonstracyjne z poziomu **Konto** → **Usuń konto**.

Jeśli model jest chwilowo niedostępny, aplikacja pokazuje komunikat o błędzie próby AI i zachowuje opis regułowy. Możesz go też wygenerować przyciskiem **Wygeneruj opis regułowy**. Jeśli kafelki mapy są niedostępne, linia śladu i statystyki nadal są widoczne.
