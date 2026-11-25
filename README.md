# Analiza tras rowerowych

Aplikacja webowa do analizy zapisanych przejazdów rowerowych w formacie GPX. Po zalogowaniu możesz importować ślady GPX 1.1, przeglądać historię, otwierać mapę i statystyki oraz porównywać opisy tras. [Plan realizacji](ROADMAP.md) · [Scenariusz demonstracji dla promotora](docs/demo.md)

## Wymagania

- Node.js 24 LTS z npm. Jeśli używasz `nvm`, uruchom `nvm install` przy pierwszej konfiguracji i `nvm use` w nowym terminalu.
- Uruchomiony Docker Desktop z Docker Compose.

## Uruchomienie lokalne

Wszystkie polecenia wykonuj z głównego katalogu projektu. Jeśli używasz `nvm`, wybierz wersję Node.js poleceniem `nvm use` również w terminalach uruchamiających API i frontend. Plik `.env` utwórz przy pierwszym uruchomieniu.

```bash
npm ci
test -f .env || cp .env.example .env
npm run db:generate
```

W `.env` ustaw lokalne hasło PostgreSQL przed utworzeniem kontenera. Domyślnie PostgreSQL nasłuchuje na porcie `5432`, a API na `3000`. Gdy któryś port jest zajęty, zmień odpowiednio `POSTGRES_PORT` lub `API_PORT` w `.env`.

Uruchom bazę i zaczekaj na pozytywny wynik sprawdzenia jej stanu.

```bash
docker compose up -d --wait
npm run db:migrate
```

Następnie uruchom API i frontend w osobnych terminalach.

```bash
npm run dev:api
```

```bash
npm run dev:web
```

Otwórz [http://127.0.0.1:5173](http://127.0.0.1:5173). Vite przekazuje `/api` do Expressa. Endpoint stanu wykonuje `SELECT 1` i zwraca HTTP `200` przy działającym połączeniu albo `503` przy niedostępnej bazie. Możesz sprawdzić odpowiedź przez proxy Vite.

```bash
curl -i http://127.0.0.1:5173/api/health
```

Aby zatrzymać środowisko, zatrzymaj oba procesy npm przez `Ctrl+C` i użyj `docker compose stop`. Wolumin PostgreSQL zachowa dane. Zmiana wartości `POSTGRES_PASSWORD` w `.env` po pierwszym uruchomieniu wymaga również zmiany hasła roli w istniejącej bazie.

Domyślne dozwolone adresy frontendu to `http://127.0.0.1:5173` i `http://127.0.0.1:4173`. Przy własnym adresie ustaw `APP_ORIGIN` na pełny origin z protokołem i portem, bez ścieżki i końcowego ukośnika. W trybie `NODE_ENV=production` API wymaga originu HTTPS i ustawia atrybut `Secure` ciasteczka sesji. Kontrakt endpointów opisuje [docs/api/authentication.md](docs/api/authentication.md).

Po zalogowaniu w sekcji **Importuj GPX** wybierz plik i kliknij **Dodaj do historii**. Link **Pobierz przykład z wysokością (Ojców)** daje ślad o długości ok. 14 km, z ok. 195 m podjazdów i 102 m zjazdów. Każdy punkt ma wysokość i znacznik czasu. Wysokości oszacowano z Numerycznego Modelu Terenu GUGiK, próbkując ślad co ok. 30 m i interpolując wysokości między próbkami. Czas przejazdu jest symulowany przy 16 km/h. [Próbka z Ojcowa](apps/web/public/samples/ojcow-cycling-route.gpx) · [Źródło wysokości](https://services.gugik.gov.pl/nmt/)

Link **Przykład bez wysokości (Kraków i Warszawa)** daje dwa ślady w jednym pliku. Możesz na nim sprawdzić import wielu tras i komunikat **Brak danych** dla podjazdów i zjazdów. Czasy tych śladów symulowano przy 17 km/h. [Próbka z Krakowa i Warszawy](apps/web/public/samples/poland-cycling-routes.gpx) · [API importu](docs/api/gpx-import.md) · [API historii i szczegółów](docs/api/routes.md)

Przebieg wszystkich śladów demonstracyjnych wyznaczył profil rowerowy OSRM serwisu FOSSGIS na podstawie dróg i ścieżek z danych © OpenStreetMap contributors. [Źródło routingu](https://routing.openstreetmap.de/about.html) · [Licencja danych ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/) · [Zgłoś błąd mapy](https://www.openstreetmap.org/fixthemap)

Mapa domyślnie korzysta z kafelków OpenStreetMap. Źródło kafelków i atrybucję można ustawić w `.env` przez `VITE_MAP_TILE_URL` i `VITE_MAP_TILE_ATTRIBUTION`. Te wartości są publiczną konfiguracją frontendu. Przeglądarka pobiera kafelki dla widocznego obszaru, a linie trasy rysuje lokalnie z danych aplikacji. [Zasady użycia kafelków OSM](https://operations.osmfoundation.org/policies/tiles/)

Pod statystykami trasy w sekcji **Opisy trasy** możesz wygenerować opis regułowy lub wybrać **Porównaj z AI**. W porównaniu oba warianty używają tej samej wersji statystyk. Najnowszy zapis pojawia się ponownie po otwarciu trasy. [API opisów](docs/api/descriptions.md)

## Model lokalny

Jeśli Ollama jeszcze nie działa, uruchom usługę w osobnym terminalu. Aplikacja Ollama na macOS może już udostępniać ją na domyślnym porcie `11434`. Sprawdź listę zainstalowanych modeli przez `ollama list`. Pobierz Bielika, jeśli nie ma go na liście. [Ollama dla macOS](https://docs.ollama.com/macos) · [Tryb lokalny](https://docs.ollama.com/faq) · [Bielik w rejestrze Ollama](https://ollama.com/SpeakLeash/bielik-1.5b-v3.0-instruct/tags)

```bash
OLLAMA_NO_CLOUD=1 ollama serve
```

```bash
ollama pull SpeakLeash/bielik-1.5b-v3.0-instruct:Q8_0
```

W lokalnym `.env` ustaw poniższe wartości i uruchom ponownie API.

```dotenv
AI_PROVIDER=ollama
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=SpeakLeash/bielik-1.5b-v3.0-instruct:Q8_0
AI_TIMEOUT_MS=45000
```

Pusty `AI_PROVIDER` pozwala korzystać z opisu regułowego. Przy błędzie modelu aplikacja zachowuje opis regułowy i pokazuje stan próby AI. Do adaptera modelu trafiają wyłącznie statystyki dostępne dla opisu przejazdu.

## Weryfikacja

```bash
npm run typecheck
npm test
npm run build
```

Vitest sprawdza parser, obliczenia, reguły opisów i kontrakt HTTP endpointu stanu. Testy integracyjne kont, tras i opisów uruchom w osobnej bazie PostgreSQL. Domyślny port testowy to `5433`. Możesz go zmienić przez `POSTGRES_TEST_PORT`.

```bash
docker compose --profile test up -d --wait postgres-test
npm run test:integration
docker compose --profile test stop postgres-test
```

`test:integration` stosuje migracje w bazie testowej i sprawdza API przez HTTP. Dane bazy testowej są przechowywane tymczasowo i znikają po zatrzymaniu kontenera.

Po zbudowaniu projektu możesz uruchomić skompilowane API poleceniem `npm run start:api` i podgląd frontendu w osobnym terminalu poleceniem `npm run preview:web`, po zwolnieniu portu API przez serwer deweloperski.

Wymagania i metodologia są w [PROJECT.md](PROJECT.md), a decyzje techniczne w [ARCHITECTURE.md](ARCHITECTURE.md).
