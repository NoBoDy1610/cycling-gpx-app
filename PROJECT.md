# Projekt aplikacji do analizy tras rowerowych

## Temat pracy magisterskiej

„Projekt i implementacja aplikacji webowej do analizy tras rowerowych na podstawie plików GPX z wykorzystaniem sztucznej inteligencji”.

Zakres podstawowy, architektura i główny stos technologiczny są zatwierdzone. Priorytetem jest działający przepływ od importu śladu do statystyk i porównania opisów. Funkcje dodatkowe wymagają osobnego uzgodnienia.

## Cel i zakres podstawowy

Rowerzysta zakłada konto, importuje zapis przejazdu, odczytuje przebieg i statystyki trasy, a potem może wrócić do niej w historii. Dla zapisanej trasy może wygenerować i porównać dwa opisy po polsku. Pierwszy tworzą zdefiniowane reguły, a drugi model językowy. Oba otrzymują identyczne fakty obliczone po stronie serwera.

| Obszar | Kryterium ukończenia |
| --- | --- |
| Konto | Użytkownik może się zarejestrować, zalogować, wylogować, zmienić adres e-mail i hasło oraz usunąć konto. Dostęp do tras i opisów jest ograniczony do właściciela. |
| Import | Użytkownik przesyła GPX i otrzymuje wynik walidacji z czytelnym komunikatem w razie błędu. Na start obsługujemy zapisane ślady GPX 1.1 (`trk`), w tym pliki z wieloma śladami i segmentami. Po pomyślnej walidacji pliku każdy ślad staje się osobną trasą w ramach jednego importu. |
| Mapa i statystyki | Widok szczegółów pokazuje przebieg na interaktywnej mapie, dystans, sumę podjazdów i zjazdów, czas trwania oraz średnią prędkość. Przy braku wymaganych danych widok wskazuje niedostępność danej miary. |
| Historia | Użytkownik wraca do zapisanych tras, otwiera szczegóły i może usunąć wybraną trasę. |
| Opisy | Użytkownik uruchamia oba generatory dla tej samej analizy i ogląda ich wyniki obok siebie. Po ponownym otwarciu trasy może odczytać zapisaną parę. |

## Ocena proponowanego stosu

Poniższe wybory określają sposób użycia zatwierdzonego stosu. Wersje pakietów utrwalimy w pliku blokady przy dodawaniu danej zależności.

| Technologia | Ocena i zastosowanie |
| --- | --- |
| React, TypeScript, Vite | Pasują do aplikacji z formularzami, historią, mapą i widokiem porównania. Vite zapewnia serwer deweloperski i budowanie frontendu. TypeScript w trybie `strict` ułatwi kontrolę przepływu danych. [React](https://react.dev/learn) · [Vite](https://vite.dev/guide/) |
| Node.js 24 LTS, Express, TypeScript | Jedno środowisko językowe dla obu części. Express obsłuży HTTP, sesje i przesyłanie plików, a reguły domenowe można utrzymać w modułach TypeScript. [Cykl wydań Node.js](https://nodejs.org/en/about/previous-releases) · [Express](https://expressjs.com/) |
| PostgreSQL 17, Prisma ORM | PostgreSQL przechowuje teraz konta i sesje. Geometria tras będzie zapisywana w `jsonb`. Prisma 7 zapewnia migracje oraz typowany dostęp przez adapter `pg`. Endpoint stanu korzysta z tej samej puli połączeń. [Wsparcie PostgreSQL](https://www.postgresql.org/support/versioning/) · [Bazy obsługiwane przez Prisma 7](https://www.prisma.io/docs/orm/v7/reference/supported-databases) · [Status wydań Prisma](https://www.prisma.io/docs/orm/release-status) |
| Leaflet, OpenStreetMap | Leaflet narysuje segmenty jako polilinie. Kafelki OpenStreetMap posłużą jako podkład przy małej skali, zgodnie z zasadami usługi i z widoczną atrybucją. [Leaflet](https://leafletjs.com/reference.html) · [Zasady użycia kafelków OSM](https://operations.osmfoundation.org/policies/tiles/) |
| Tailwind CSS | Ułatwi zbudowanie spójnych, responsywnych widoków i integruje się z Vite. [Integracja z Vite](https://tailwindcss.com/docs/installation/using-vite) |
| Vitest i testy integracyjne API | Vitest posłuży do testów parsera, obliczeń i reguł. Testy integracyjne sprawdzą żądania HTTP na odrębnej bazie PostgreSQL. [Vitest](https://vitest.dev/guide/) |
| Git i prywatne repozytorium GitHub | Repozytorium będzie przechowywać kod, migracje, decyzje i materiały dopuszczone do wersjonowania. [Widoczność repozytorium GitHub](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/managing-repository-settings/setting-repository-visibility) |
| Integracja AI | Backend korzysta z kontraktu niezależnego od dostawcy. Adapter Ollama przeszedł próbę techniczną z Bielikiem 1.5B v3.0 Instruct Q8_0 na przykładowych trasach Krakowa i Warszawy. Model pozostaje kandydatem do badań. [Bielik](https://www.bielik.ai/) |

## Pytanie badawcze

Czy rowerzyści oceniają opisy generowane przez model językowy jako bardziej przydatne i bardziej zrozumiałe od opisów regułowych, gdy oba warianty korzystają z tych samych danych? Przydatność i zrozumiałość będą oceniane osobno. Porównanie obejmie także poprawność informacji oraz czas generowania.

### Procedura porównania

Przygotujemy wersjonowany zbiór tras o różnym dystansie, profilu wysokościowym i kompletności czasu oraz wysokości. Użyjemy tras syntetycznych lub z udokumentowanym prawem do wykorzystania. Trasy do dostrojenia reguł i promptu będą oddzielone od tras do oceny. Dla każdej trasy oba generatory dostaną te same dane, język, zakres faktów i oczekiwaną długość.

Uczestnik zobaczy parę opisów jednej trasy oznaczoną jako A i B. Kolejność zostanie zrównoważona między uczestnikami i zapisana dla każdej pary. Uczestnik odpowie na te same pytania o każdy wariant. Przydatność i zrozumiałość oceni oddzielnie w skali od 1 do 5. Pilotaż sprawdzi, czy uczestnicy podobnie rozumieją pytania.

### Kryteria oceny

| Kryterium | Sposób oceny |
| --- | --- |
| Przydatność | „Na ile opis pomaga Ci ocenić trasę przed przejazdem?” `1` oznacza brak pomocy, `3` częściową pomoc, a `5` możliwość oceny trasy na podstawie opisu i dostępnych faktów. |
| Zrozumiałość | „Jak łatwo możesz zrozumieć opis trasy?” `1` oznacza opis niezrozumiały, `3` opis wymagający ponownego przeczytania, a `5` opis jasny przy pierwszym czytaniu. |
| Poprawność i kompletność | Oceniający przypisze twierdzeniom status `correct`, `incorrect` albo `unsupported` względem referencyjnych statystyk. Wynik liczbowy porówna po przeliczeniu jednostek z tolerancją połowy jednostki ostatniej cyfry przewidzianej we wspólnym formacie. Pominięte dostępne fakty policzy osobno dla dystansu, podjazdów, zjazdów, czasu i średniej prędkości. Miary niedostępne nie zmniejszają kompletności. Algorytmy GPX zweryfikujemy oddzielnie na trasach o znanych wynikach. |
| Czas i niezawodność | Backend mierzy każdą próbę od wywołania generatora do zwalidowanego wyniku lub błędu. Dla AI pomiar obejmuje komunikację z usługą. Raport obejmie medianę czasu prób udanych i udział prób zakończonych błędem lub przekroczeniem limitu wśród wszystkich rozpoczętych prób. Próby przerwane raportujemy osobno. Warunki pomiaru obejmą sprzęt, liczbę powtórzeń i rozgrzanie modelu. |

### Rejestr wyników i analiza

W [architekturze](ARCHITECTURE.md#generowanie-opisów-i-powtarzalność) określono identyfikatory i pola prób, ocen oraz weryfikacji twierdzeń. Wynik podstawowy dla każdej skali to różnica między ocenami AI i reguł dla tego samego uczestnika i trasy. Analiza uwzględni powtarzające się oceny uczestników i tras. Niepełne pary oraz błędy będą liczone i raportowane. Raport poda liczebności, wielkości efektów i przedziały niepewności.

Liczebność próby, liczbę powtórzeń, sposób obsługi brakujących ocen, ostateczną analizę statystyczną i zasady udziału ustalimy z promotorem przed zbieraniem ocen. Widok porównania i metadane generowania należą do aplikacji. Narzędzia rekrutacji, przydział par, formularz, eksport i eksperyment są zaplanowane na później.

## Funkcje dodatkowe do osobnego uzgodnienia

- Profil wysokościowy zsynchronizowany z mapą.
- Filtrowanie historii według dystansu, daty i sumy podjazdów.
- Wykrywanie ponownego importu tego samego pliku.
- Obsługa GPX 1.0 oraz zaplanowanych tras (`rte`).

## Dokumentacja projektu

| Artefakt | Zawartość i moment aktualizacji |
| --- | --- |
| `PROJECT.md`, `ARCHITECTURE.md`, `ROADMAP.md` | Wymagania, projekt systemu i etapy. Aktualizacja przy zatwierdzonej zmianie zakresu lub architektury. |
| `README.md` | Uruchomienie, konfiguracja, polecenia testowe i przykładowy przebieg importu. Powstanie z konfiguracją środowiska. |
| `docs/decisions/` | Krótkie ADR z kontekstem, rozważanymi opcjami, decyzją i jej konsekwencjami, np. `0001-gpx-storage.md`. |
| `docs/api/` | Kontrakt HTTP z przykładami odpowiedzi, błędów i reguł dostępu, rozwijany wraz z API. |
| `docs/research/` | Wersjonowany protokół, opis zbioru tras i kryteriów doboru, słownik danych oraz plan analizy. Po badaniu także instrukcja odtworzenia analizy na zbiorze dopuszczonym do udostępnienia. |

Materiały badawcze pozwalające rozpoznać uczestników lub prywatne przejazdy będą przechowywane poza repozytorium. Do wersjonowania trafią wyłącznie zatwierdzona dokumentacja, kod i dopuszczone zbiory przykładowe lub wyniki zagregowane.
