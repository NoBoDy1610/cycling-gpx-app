# Plan realizacji

Zakres podstawowy i architektura są zatwierdzone. Prace koncentrują się na podstawowej funkcjonalności aplikacji. Każdy kolejny większy etap rozpoczyna się po uzgodnieniu jego zakresu.

## Narzędzia na macOS

Sprawdzenie środowiska na Macu z Apple Silicon i macOS 26.4 wykonano 24 listopada 2026 r.

| Narzędzie | Stan i potrzebne działanie |
| --- | --- |
| Git | Dostępny w wersji 2.50.1. Dane autora są skonfigurowane. Lokalne repozytorium używa gałęzi `main`. |
| Node.js i npm | Doinstalowano Node.js 24.22.3 LTS przez `nvm`. Szkielet zweryfikowano z dołączonym npm 11.19.1. Użyj `nvm use` w katalogu projektu, aby wybrać linię Node.js zadeklarowaną w `.nvmrc`. [Node.js](https://nodejs.org/en/about/previous-releases) · [nvm](https://github.com/nvm-sh/nvm) |
| Docker Desktop dla Apple Silicon z Compose | Zweryfikowano działanie silnika 28.5.1 oraz Compose 2.40.0. Kontener PostgreSQL 17 wystartował i przeszedł sprawdzenie gotowości. Osobna baza do testów z migracjami będzie potrzebna od etapu kont. [Docker Desktop dla macOS](https://docs.docker.com/desktop/setup/install/mac-install/) |
| Visual Studio Code lub inny edytor | Polecenie `code` jest dostępne. Możesz używać obecnego edytora. |
| Konto GitHub | Potrzebne do założenia prywatnego repozytorium. Przeglądarka wystarczy do jego utworzenia, a Git do pracy z repozytorium. GitHub CLI jest opcjonalny. [Tworzenie repozytorium](https://docs.github.com/en/repositories/creating-and-managing-repositories/creating-a-new-repository) |
| Ollama | Potrzebna dopiero przy próbie lokalnego Bielika, jeśli ten wariant zostanie wybrany. Wtedy sprawdzimy pamięć, miejsce na dysku i czas odpowiedzi dla konkretnego modelu. [Ollama dla macOS](https://docs.ollama.com/macos) |

TypeScript, Vite, Tailwind CSS, Vitest i Prisma są lokalnymi zależnościami projektu. PostgreSQL uruchamiamy w Dockerze. Moduł kont ma osobną bazę integracyjną w profilu Compose `test`.

## Etapy i kryteria ukończenia

| Etap | Zakres | Jak sprawdzimy ukończenie | Propozycja commita |
| --- | --- | --- | --- |
| 0. Analiza i plan | Wymagania, architektura, metodologia, rubryka oceny i projekt zapisu wyników. | Dokumentacja opisuje zatwierdzone założenia, ryzyka, kryteria oceny i sposób rejestrowania prób oraz ocen. | `docs: outline project architecture and roadmap` |
| 1. Środowisko i szkielet | Ustalenie wersji, lokalny Git, npm workspaces, frontend Vite, API Express, PostgreSQL w Compose, TypeScript, Vitest i przykładowe zmienne. Powstaje `README.md`. | Instalacja z pliku blokady, kompilacja, testy i uruchomiony frontend, który pokazuje stan API i bazy na podstawie rzeczywistego sprawdzenia połączenia. | `chore: scaffold cycling GPX application` |
| 2. Konta i sesje | Konfiguracja Prisma i pierwsze migracje dla kont i sesji, rejestracja, logowanie, wylogowanie, zmiana adresu i hasła oraz usunięcie konta. Formularze i obsługa sesji w interfejsie. | Testy API pokrywają rejestrację, duplikat adresu, poprawne i błędne logowanie, wygaszenie sesji oraz autoryzację zmian konta. Ręcznie sprawdzimy podstawowy przepływ w przeglądarce. | `feat: add user accounts and sessions` |
| 3. Import i analiza GPX | Parser, walidacja, normalizacja, algorytmy statystyk, zapis transakcyjny oraz endpoint importu. | Testy jednostkowe obejmują znane wartości, wiele segmentów, brak czasu i wysokości oraz niespójny czas. Testy API potwierdzają zapis pliku z wieloma śladami i brak częściowego zapisu po błędzie. | `feat: parse and analyze GPX uploads` |
| 4. Historia, mapa i statystyki | Interfejs importu, historia, usuwanie tras i ekran szczegółów z Leaflet i statystykami. | Testy API sprawdzają izolację tras między kontami i stronicowanie. Ręcznie sprawdzimy import do historii, wyświetlenie przerw między segmentami, brakujące miary i dużą trasę. | `feat: display saved routes and statistics` |
| 5. Opisy regułowe | Wspólny kontrakt faktów, wersjonowane szablony, utrwalanie wejścia i rezultat regułowy. | Dla tej samej wersji i danych test otrzymuje ten sam tekst. Braki są obsługiwane, wynik można odczytać po powrocie do trasy. | `feat: generate rule-based route descriptions` |
| 6. Model AI i porównanie | Kontrakt niezależny od dostawcy, adapter dla wybranego modelu, walidacja odpowiedzi, rejestr prób i widok obu opisów. Bielik jest kandydatem do próby technicznej. | Test z podstawionym adapterem potwierdza wspólne wejście oraz obsługę limitu czasu i błędnej odpowiedzi. Próba z modelem sprawdza pełny przepływ z zapisem wyników. | `feat: compare AI and rule-based descriptions` |
| 7. Weryfikacja i uruchomienie demonstracyjne | Pełny przegląd aplikacji, instrukcja uruchomienia i uzgodnione środowisko demonstracji. | Budowanie, sprawdzanie typów, testy jednostkowe i integracyjne oraz ręczne przejście od rejestracji do porównania opisów i usunięcia danych. Weryfikacja limitów, prywatności, zachowania mapy i awarii modelu. | `chore: prepare the application for demonstration` |
| 8. Przygotowanie badań | Uzgodnienie szczegółów protokołu z promotorem, przygotowanie zbioru tras i pilotażu. Po akceptacji zakresu powstaną potrzebne narzędzia do generowania prób, prezentacji i eksportu ocen zgodnie z projektową rubryką. | Próba na danych testowych potwierdza odtworzenie wejścia, przypisanie wyników do par, zapis kolejności i połączenie plików eksportu według słownika danych. Pilotaż odbywa się po uzgodnieniu udziału uczestników. | `feat: prepare the experiment workflow` |

## Praca z Git i zamknięcie etapu

1. Przed rozpoczęciem uzgadniamy zakres, kryteria odbioru i proponowane zmiany technologiczne.
2. Po wdrożeniu uruchamiamy testy właściwe dla etapu i sprawdzamy zmiany. Dla etapu dokumentacyjnego wystarczy przegląd treści i spójności plików.
3. Podsumowujemy zmiany, wyniki weryfikacji i ograniczenia. Proponujemy komunikat commita w języku angielskim.
4. Commit i push wykonujemy po uzyskaniu zgody na daną operację. Początkowa widoczność repozytorium na GitHubie jest prywatna.

Utworzenie prywatnego repozytorium na GitHubie jest odłożone do osobnej decyzji użytkownika.
