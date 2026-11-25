# Architektura aplikacji

Zatwierdzony układ obejmuje frontend React, modularny backend Express i PostgreSQL. Zakres pierwszego importu ogranicza się do śladów GPX 1.1 (`trk`).

## Podział odpowiedzialności

Kod Reacta i Expressa znajduje się w jednym repozytorium zarządzanym przez npm workspaces. React prezentuje dane oraz wysyła żądania do REST API. Express sprawdza sesję i uprawnienia, przetwarza GPX, oblicza statystyki i koordynuje generowanie opisów. PostgreSQL utrwala dane. Na wdrożeniu przeglądarka widzi frontend i `/api` pod tym samym originem. Lokalnie Vite przekazuje żądania `/api` do Expressa przez proxy deweloperskie. [npm workspaces](https://docs.npmjs.com/cli/v11/using-npm/workspaces)

`GET /api/health` wykonuje `SELECT 1` przez sterownik `pg`. Moduł kont uzyskuje dostęp do tej samej puli PostgreSQL przez adapter Prisma 7. Schemat i pierwsza migracja definiują `User` oraz `Session`.

Konfiguracja npm przypina poprawioną wersję `effect` dla zależności Prisma CLI. Przy aktualizacji Prisma sprawdzimy, czy pakiet sam wskazuje wersję z poprawką. [Zgłoszenie Effect](https://github.com/advisories/GHSA-7589-6fvf-x4pw)

```mermaid
flowchart LR
    Browser["Przeglądarka · React i Leaflet"]
    API["Express · REST API"]
    DB[("PostgreSQL")]
    LLM["Usługa modelu językowego"]
    Tiles["Kafelki OpenStreetMap"]
    Browser -->|"/api"| API
    API -->|"Prisma"| DB
    API -->|"Utrwalone statystyki"| LLM
    Browser -->|"Podkład mapowy"| Tiles
```

### Struktura katalogów docelowych

```text
cycling-gpx-app/
├── apps/
│   ├── web/
│   │   └── src/
│   │       ├── app/               # konfiguracja aplikacji i nawigacja
│   │       ├── features/          # auth, routes, descriptions
│   │       └── lib/               # klient HTTP i współdzielona konfiguracja UI
│   └── api/
│       ├── prisma/               # schemat i migracje
│       ├── src/
│       │   ├── app.ts            # instancja Expressa do uruchamiania i testów
│       │   ├── server.ts         # konfiguracja i nasłuchiwanie HTTP
│       │   ├── modules/          # auth, routes, gpx, descriptions
│       │   └── infrastructure/   # połączenie z bazą i konfiguracja środowiska
│       └── test/
│           ├── fixtures/         # syntetyczne próbki GPX
│           └── integration/
├── packages/
│   └── contracts/                # typy DTO przy pierwszym wspólnym kontrakcie
├── docs/
│   ├── decisions/
│   ├── api/
│   └── research/
├── AGENTS.md
├── PROJECT.md
├── ARCHITECTURE.md
├── ROADMAP.md
├── README.md
├── compose.yaml
└── package.json
```

W obrębie modułu handler HTTP waliduje dane wejściowe i przekazuje je do funkcji realizującej operację. Parser, kalkulator statystyk i generator regułowy mają niezależne wejścia i wyjścia, aby można je było testować bez HTTP i bazy. Modele Prisma pozostają wewnątrz API. Wspólne DTO opisują dane przesyłane między API i frontem. Dane z granic systemu, w tym GPX, JSON żądań i odpowiedzi modelu, wymagają walidacji w czasie działania.

## Konto i sesja

Rejestracja tworzy konto i pierwszą sesję w jednej operacji. Logowanie i rejestracja zwracają publiczne dane konta oraz ciasteczko `HttpOnly` z losowym tokenem ważnym przez siedem dni. Baza utrwala skrót SHA-256 tokenu oraz skrót hasła Argon2id. Operacje na koncie wyprowadzają identyfikator użytkownika z aktywnej sesji i wymagają podania bieżącego hasła. Zmiana hasła zapisuje nowy skrót i odwołuje wszystkie sesje w tej samej transakcji. Utworzenie sesji po logowaniu jest synchronizowane na rekordzie użytkownika, aby równoległa zmiana danych logowania nie pozostawiła nowej sesji ze starymi poświadczeniami. Usunięcie konta usuwa sesje przez klucz obcy.

Wszystkie operacje zmieniające stan sprawdzają `Origin` według dozwolonych adresów frontendu. Ciasteczko używa `SameSite=Lax`, a przez produkcyjne HTTPS także `Secure`. Jedna instancja API ogranicza próby podawania poświadczeń ze wspólnego adresu IP. Kontrakt HTTP jest w [docs/api/authentication.md](docs/api/authentication.md).

## Import i obliczenia

1. `POST /api/routes/import` przyjmuje jeden plik `multipart/form-data` od zalogowanego użytkownika. Backend sprawdza limit rozmiaru, rozpoznaje XML 1.0 w UTF-8 i waliduje obsługiwaną strukturę GPX 1.1. Limity to 10 MiB, 100 000 punktów `trkpt`, 100 śladów, 2000 segmentów i 64 poziomy zagnieżdżenia XML. Walidacja obejmuje strukturę i zakresy współrzędnych WGS84. [Specyfikacja GPX 1.1](https://www.topografix.com/GPX/1/1/)
2. Parser zachowuje kolejność śladów, segmentów i punktów. Pomija elementy spoza zakresu analizy, w tym rozszerzenia producentów. Pusty lub jednopunktowy segment zostaje pominięty z ostrzeżeniem. Plik musi zawierać co najmniej jeden ślad. Każdy ślad musi mieć co najmniej jeden segment z przynajmniej dwoma punktami. Nieprawidłowe współrzędne lub niespełnienie wymagań dotyczących struktury skutkują odrzuceniem całego importu. Brak lub uszkodzenie wartości czasu lub wysokości obniża dostępność miar i jest raportowane w ostrzeżeniach.
3. Backend liczy statystyki dla każdego śladu i w jednej transakcji zapisuje import, trasy oraz ich analizy. Odpowiedź zawiera identyfikatory i statystyki. Trwały zapis obejmuje dane znormalizowane. Kontrakt jest w [docs/api/gpx-import.md](docs/api/gpx-import.md).
4. Historia pobiera podsumowania tras przez `GET /api/routes`. API używa kursora opartego na dacie importu, identyfikatorze importu i pozycji śladu w pliku. `GET /api/routes/:routeId` zwraca statystyki i segmenty mapy. `DELETE /api/routes/:routeId` usuwa trasę wraz z analizami. Każde zapytanie do bazy jest ograniczone do właściciela z aktywnej sesji. [Kontrakt historii i szczegółów](docs/api/routes.md)

| Miara | Definicja w wersji `gpx-1` |
| --- | --- |
| Dystans | Suma poziomych odległości metodą Haversine’a między sąsiednimi punktami każdego segmentu. Obliczenia używają promienia 6 371 000 m i pomijają przerwy między segmentami. Wynik w metrach. |
| Suma podjazdów i zjazdów | Oddzielne sumy dodatnich i bezwzględnych ujemnych różnic pomiędzy kolejnymi zapisanymi próbkami wysokości w każdym segmencie. Wahania pomiaru wpływają na wynik. Przy niepełnych danych obie miary mają wartość `null`. |
| Czas trwania | Różnica między ostatnim i pierwszym znacznikiem przejazdu, z uwzględnieniem postojów i przerw. Wymaga prawidłowych znaczników czasu ze strefą dla wszystkich użytych punktów, rosnącej kolejności wewnątrz segmentów, braku nakładania się segmentów w czasie i dodatniego wyniku. Granice kolejnych segmentów mogą się stykać. Przy niespełnieniu warunków wynik to `null`. Znaczniki zapisujemy w UTC z dokładnością do milisekund, a wynik w sekundach. |
| Średnia prędkość | Dystans podzielony przez czas trwania. Przy braku prawidłowego czasu wynik to `null`. API zapisuje metry na sekundę, a interfejs wyświetla kilometry na godzinę. |

Widok szczegółów pokazuje odległość w metrach lub kilometrach, wysokość w metrach, średnią prędkość w km/h oraz czas zaokrąglony do sekundy dla przejazdów co najmniej jednosekundowych. Leaflet rysuje każdy segment jako osobną polilinię ze współrzędnych otrzymanych z API. Od 10 000 punktów używa renderera Canvas. Długości geograficzne przy przekroczeniu południka 180° są dostosowywane do widoku mapy, a zapis i statystyki korzystają z oryginalnych współrzędnych.

## Wstępny model bazy danych

| Encja | Najważniejsze pola i relacje |
| --- | --- |
| `User` | `id` (UUID), `email` (unikalny i normalizowany), `passwordHash`, `createdAt`, `updatedAt`. Właściciel sesji i importów. |
| `Session` | `id` (UUID), `userId`, `tokenHash` (unikalny), `createdAt`, `expiresAt`. Umożliwia wygaśnięcie i odwołanie sesji. |
| `RouteImport` | `id` (UUID), `userId`, `gpxVersion`, `warnings` (`jsonb`, z numerem śladu lub segmentu), `createdAt`. Jeden rekord na przesłany plik. |
| `Route` | `id` (UUID), `importId`, `trackIndex`, `title`, `geometry` (`jsonb`), `geometryVersion`, `pointCount`. Geometria to uporządkowane tablice segmentów zawierające punkty z `latitude`, `longitude`, opcjonalnym `elevationM` i `recordedAt`. |
| `RouteAnalysis` | `id` (UUID), `routeId`, `algorithmVersion`, `distanceM`, `elevationGainM`, `elevationLossM`, `elapsedDurationS`, `averageSpeedMps`, `qualityFlags`, `createdAt`. Wyniki analizy są niezmienne, a przeliczenie tworzy nowy rekord. Brakujące miary są dopuszczalne. |
| `DescriptionComparison` | `id` (UUID), `analysisId`, `inputSnapshot` (`jsonb`), `inputSchemaVersion`, `inputHash`, `createdAt`. Utrwala wspólne wejście i grupuje dwa warianty opisu. |
| `DescriptionRun` | `id` (UUID), `comparisonId`, `method` (`RULE_BASED`, `AI`), `status`, `outputText`, `durationMs`, `generatorVersion`, `provider`, `modelId`, `modelRevision`, `promptVersion`, `parameters` (`jsonb`), `errorCode`, `createdAt`, `deadlineAt`. Pola zależne od metody lub wyniku mogą być puste. |

- Klucze obce wynikają z relacji w tabeli. Własność wynika z `RouteImport.userId`. Indeksy obejmują `RouteImport(userId, createdAt, id)`, `Session(expiresAt)`, `RouteAnalysis(routeId, createdAt)` i `DescriptionComparison(analysisId, createdAt)`. Pary `(importId, trackIndex)` i `(comparisonId, method)` są unikalne.
- Daty tabel zapisujemy jako `timestamptz` i przekazujemy w API w UTC. Miary trasy mogą mieć część ułamkową, a `durationMs` przechowuje czas próby w milisekundach. `qualityFlags` zawiera ustrukturyzowane oznaczenia jakości i kompletności danych.
- Usunięcie trasy usuwa jej analizy, porównania i opisy. Usunięcie konta usuwa sesje, importy i powiązane dane. Zasady przechowywania kopii zapasowych powinny uwzględniać ten cykl życia.
- Przechowywanie geometrii jako `jsonb` daje prosty odczyt całego śladu i zachowuje segmenty. Zapytania przestrzenne i model z oddzielną tabelą punktów można rozważyć po pomiarach, jeśli pojawi się potrzeba odpytywania punktów lub indeksowania obszarów.

## Generowanie opisów i powtarzalność

`POST /api/routes/:routeId/comparisons` tworzy opis regułowy. `POST /api/routes/:routeId/comparisons/ai` tworzy porównanie z najnowszej analizy trasy i utrwala `inputSnapshot` wspólny dla obu metod. Zawiera on statystyki w jednostkach SI i oznaczenia jakości. Kanoniczna serializacja i skrót SHA-256 umożliwiają sprawdzenie zgodności wejść między próbami. [API opisów i format wejścia](docs/api/descriptions.md)

- **Reguły.** Wersja `rules-pl-1` podaje w ustalonej kolejności dystans, czas, średnią prędkość, podjazdy i zjazdy. Wartości `null` są pomijane. Odległość i wysokość są formatowane do dwóch miejsc po przecinku, średnia prędkość jest przeliczana na km/h, a czas przejazdów co najmniej jednosekundowych zaokrąglany do sekundy. Ta sama wersja reguł i wejścia daje ten sam tekst.
- **Model.** Moduł opisów wywołuje `AiDescriptionProvider` ze wspólnym wejściem i sygnałem przerwania. Adapter Ollama wysyła wartości pomiarów sformatowane tak samo jak dla reguł oraz odbiera obiekt JSON z opisem. Wspólna walidacja sprawdza wszystkie dostępne liczby i jednostki, akceptuje równoważne polskie formy jednostek i odrzuca dodatkowe wartości zapisane cyframi. Ocena badawcza obejmie też przypisanie miar do twierdzeń i twierdzenia jakościowe.
- **Zapis prób.** Backend zapisuje wspólne wejście, opis regułowy i rozpoczętą próbę AI przed wywołaniem dostawcy. Czas AI mierzy zegarem monotonicznym od wywołania adaptera do zwalidowania wyniku lub błędu. Po przekroczeniu limitu, błędzie lub przerwaniu próby zachowuje wynik regułowy i status AI. Przy odczycie wygasłe próby pozostawione przez przerwany proces są oznaczane jako `INTERRUPTED`. Każde ponowne wywołanie tworzy osobne porównanie.
- **Konfiguracja.** Próba AI zapisuje dostawcę, model, digest z Ollama, gdy jest dostępny, wersję promptu i parametry, w tym `temperature` i `seed`. Powtarzalność dotyczy wejścia i procedury. Odpowiedź modelu może się różnić mimo identycznych ustawień, zwłaszcza gdy dostawca aktualizuje model.

### Dane dla badania

Projekt danych określa klucze i granularność wyników przed powstaniem narzędzi. Ustalenia metodologii i rubryka są opisane w [PROJECT.md](PROJECT.md#pytanie-badawcze).

| Zbiór | Jeden wiersz zawiera |
| --- | --- |
| Wejścia porównań | `comparisonId`, `datasetRouteId`, `inputSnapshot`, `inputSchemaVersion`, `inputHash` i wersję algorytmu obliczeń. Pozwala odczytać dokładne dane wejściowe i powiązać je z obiema metodami. |
| Próby generowania | `runId`, `comparisonId`, metodę, numer powtórzenia, status (`SUCCEEDED`, `FAILED`, `TIMED_OUT` albo `INTERRUPTED`), tekst lub kod błędu, czas w ms i wersję konfiguracji generatora. Brak pomiaru ma wartość `null`. |
| Prezentacje par | `trialId`, `comparisonId`, identyfikator uczestnika w badaniu, kolejność i mapowanie A/B na konkretne `runId`. Wspólne metadane eksperymentu obejmują wersję protokołu, zbioru i warunki generowania. |
| Oceny uczestników | `trialId`, `runId`, `usefulnessScore`, `clarityScore` i czas zapisu. Brak odpowiedzi zapisujemy jako `null`. Identyfikator uczestnika można dołączyć przez `trialId`. |
| Weryfikacja treści | `runId`, identyfikator ocenianego twierdzenia lub oczekiwanego faktu, wynik rubryki (`correct`, `incorrect`, `unsupported`, `omitted`), klucz miary i uzasadnienie oceny. |

Rekordy generowania są częścią aplikacji. Prezentacje, oceny i weryfikacja treści powstaną na etapie badawczym. Wyniki badań można eksportować do oddzielnych plików CSV z jawnymi kluczami powiązań i wersjonowanym słownikiem danych. Dobór tras do badania i zasady pseudonimizacji oraz przechowywania ocen ustalimy przed rekrutacją.

## Ryzyka i sposób ich ograniczenia

| Ryzyko | Podejście |
| --- | --- |
| Uszkodzone, bardzo duże lub niebezpieczne XML | Busboy ogranicza rozmiar podczas odbioru żądania, a parser zdarzeniowy Saxes sprawdza strukturę i limity treści. Import odrzuca deklaracje DTD i waliduje plik na podstawie zawartości. [Busboy](https://github.com/mscdex/busboy) · [Saxes](https://github.com/lddubeau/saxes) |
| Niedokładność GPS i szum wysokości | Zachowujemy segmentację i wersjonujemy metody obliczeń. Testujemy znane odcinki, braki danych, różne interwały próbkowania i zaszumiony profil. Graniczne wartości prezentujemy z rozsądną precyzją i informacją o ograniczeniach danych. |
| Przecieki danych lub dostęp do cudzej trasy | Używamy Argon2id do haszowania haseł i odwoływalnego identyfikatora sesji w ciasteczku `HttpOnly`, `SameSite=Lax`, z `Secure` przez HTTPS. Weryfikujemy `Origin` dla operacji zmieniających stan, ograniczamy próby logowania oraz sprawdzamy właściciela w każdym zapytaniu o trasę, analizę lub opis. Zmiana e-maila, hasła i usunięcie konta wymagają ponownego podania hasła. [Zalecenia bezpieczeństwa Express](https://expressjs.com/en/advanced/best-practice-security/) · [Zalecenia OWASP dotyczące przechowywania haseł](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html) |
| Mało wydajna historia i mapa dużych tras | Stronicujemy historię, pobieramy punkty na żądanie i dobieramy limit wielkości na podstawie pomiarów. W razie potrzeby uprościmy geometrię tylko w odpowiedzi mapowej. |
| Zależność od publicznych kafelków | Utrzymujemy konfigurowalne źródło kafelków i widoczną atrybucję. Stosujemy cache i zasady ruchu OSM. Zapytania o kafelki ujawniają dostawcy przybliżony oglądany obszar, więc uwzględnimy to w opisie prywatności. [Zasady użycia kafelków OSM](https://operations.osmfoundation.org/policies/tiles/) |
| Błędny opis, limit czasu lub brak dostępu do modelu | Ograniczamy wejście do danych analizy i sprawdzamy odpowiedź. Wynik regułowy pozostaje dostępny niezależnie od modelu. W testach integracyjnych używamy kontrolowanego adaptera, a działanie z wybranym modelem weryfikujemy próbą na docelowym środowisku. |
| Sekrety w kodzie, logach lub historii Git | Ustalenia środowiska dokumentujemy w `.env.example` z wartościami przykładowymi. Sekrety trafiają do lokalnego `.env` ignorowanego przez Git lub do konfiguracji wdrożenia. Logi zawierają identyfikatory żądań i kody błędów z pominięciem haseł, tokenów, GPX i prywatnych współrzędnych. |
