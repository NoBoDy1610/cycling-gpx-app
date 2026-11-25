# Analiza tras rowerowych

Aplikacja webowa do analizy zapisanych przejazdów rowerowych w formacie GPX. Po zalogowaniu możesz importować ślady GPX 1.1, przeglądać historię, otwierać mapę i statystyki oraz usuwać zapisane trasy. Zakres kolejnych etapów opisuje [ROADMAP.md](ROADMAP.md).

## Wymagania

- Node.js 24 LTS z npm. Jeśli używasz `nvm`, uruchom `nvm install` przy pierwszej konfiguracji i `nvm use` w nowym terminalu.
- Uruchomiony Docker Desktop z Docker Compose.

## Uruchomienie lokalne

Wszystkie polecenia wykonuj z głównego katalogu projektu. Plik `.env` utwórz przy pierwszym uruchomieniu.

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

Po zalogowaniu w sekcji **Importuj GPX** wybierz plik i kliknij **Dodaj do historii**. Otwarcie trasy w historii pokazuje mapę i statystyki. Syntetyczna próbka zawiera dwa ślady z przerwą między segmentami i brakującymi pomiarami. [Próbka GPX](apps/api/test/fixtures/multiple-tracks.gpx) · [API importu](docs/api/gpx-import.md) · [API historii i szczegółów](docs/api/routes.md)

Mapa domyślnie korzysta z kafelków OpenStreetMap. Źródło kafelków i atrybucję można ustawić w `.env` przez `VITE_MAP_TILE_URL` i `VITE_MAP_TILE_ATTRIBUTION`. Te wartości są publiczną konfiguracją frontendu. Przeglądarka pobiera kafelki dla widocznego obszaru, a linie trasy rysuje lokalnie z danych aplikacji. [Zasady użycia kafelków OSM](https://operations.osmfoundation.org/policies/tiles/)

## Weryfikacja

```bash
npm run typecheck
npm test
npm run build
```

Vitest sprawdza parser, obliczenia oraz kontrakt HTTP endpointu stanu. Testy integracyjne kont i importu uruchom w osobnej bazie PostgreSQL. Domyślny port testowy to `5433`. Możesz go zmienić przez `POSTGRES_TEST_PORT`.

```bash
docker compose --profile test up -d --wait postgres-test
npm run test:integration
docker compose --profile test stop postgres-test
```

`test:integration` stosuje migracje w bazie testowej i sprawdza API przez HTTP. Dane bazy testowej są przechowywane tymczasowo i znikają po zatrzymaniu kontenera.

Po zbudowaniu projektu możesz uruchomić skompilowane API poleceniem `npm run start:api` i podgląd frontendu w osobnym terminalu poleceniem `npm run preview:web`, po zwolnieniu portu API przez serwer deweloperski.

Wymagania i metodologia są w [PROJECT.md](PROJECT.md), a decyzje techniczne w [ARCHITECTURE.md](ARCHITECTURE.md).
