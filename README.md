# Analiza tras rowerowych

Aplikacja webowa do analizy zapisanych przejazdów rowerowych w formacie GPX. Na etapie konfiguracji frontend pokazuje stan API i połączenia z PostgreSQL. Zakres kolejnych etapów opisuje [ROADMAP.md](ROADMAP.md).

## Wymagania

- Node.js 24 LTS z npm. Jeśli używasz `nvm`, uruchom `nvm install` przy pierwszej konfiguracji i `nvm use` w nowym terminalu.
- Uruchomiony Docker Desktop z Docker Compose.

## Uruchomienie lokalne

Wszystkie polecenia wykonuj z głównego katalogu projektu. Plik `.env` utwórz przy pierwszym uruchomieniu.

```bash
npm ci
test -f .env || cp .env.example .env
```

W `.env` ustaw lokalne hasło PostgreSQL przed utworzeniem kontenera. Domyślnie PostgreSQL nasłuchuje na porcie `5432`, a API na `3000`. Gdy któryś port jest zajęty, zmień odpowiednio `POSTGRES_PORT` lub `API_PORT` w `.env`.

Uruchom bazę i zaczekaj na pozytywny wynik sprawdzenia jej stanu.

```bash
docker compose up -d --wait
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

## Weryfikacja

```bash
npm run typecheck
npm test
npm run build
```

Vitest sprawdza kontrakt HTTP endpointu stanu w scenariuszach dostępnej i niedostępnej bazy z podstawionym sprawdzeniem połączenia. Rzeczywiste połączenie weryfikuje uruchomiona aplikacja. Po zbudowaniu projektu możesz uruchomić skompilowane API poleceniem `npm run start:api` i podgląd frontendu w osobnym terminalu poleceniem `npm run preview:web`, po zwolnieniu portu API przez serwer deweloperski.

Wymagania i metodologia są w [PROJECT.md](PROJECT.md), a decyzje techniczne w [ARCHITECTURE.md](ARCHITECTURE.md).
