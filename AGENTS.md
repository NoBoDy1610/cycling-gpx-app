# Zasady pracy nad projektem

## Zakres i akceptacja

- Przed pracą przeczytaj [PROJECT.md](PROJECT.md), [ARCHITECTURE.md](ARCHITECTURE.md) i [ROADMAP.md](ROADMAP.md).
- Najpierw przeanalizuj wymagania i przedstaw plan. Pracuj etapami. Każdy większy etap implementacji rozpocznij po akceptacji jego zakresu przez użytkownika.
- Istotną zmianę technologii lub architektury najpierw uzasadnij i przedstaw do zatwierdzenia. Dodatkowe funkcje i narzędzia badawcze wdrażaj wyłącznie po odrębnej akceptacji zakresu.
- Priorytetem jest zakres podstawowy aplikacji. Pierwsza obsługiwana odmiana GPX to ślady `trk` w wersji 1.1. Szczegóły usług modeli utrzymuj w adapterach, a wspólny kontrakt AI projektuj niezależnie od dostawcy.
- Istniejące pliki usuwaj wyłącznie po przedstawieniu uzasadnienia i uzyskaniu akceptacji. Szanuj zmiany użytkownika.

## Implementacja i dokumentacja

- Używaj TypeScript ze ścisłym sprawdzaniem typów i waliduj dane wejściowe na granicach systemu. Pisz prosty, modularny kod i dodawaj zależności tylko wtedy, gdy rozwiązują konkretny problem.
- Prowadź rozmowę i dokumentację projektową po polsku. Zapisuj nazwy zmiennych, funkcji, plików oraz komunikaty commitów po angielsku.
- Wyjaśniaj istotne decyzje i zapisuj je w dokumentacji. Projektuj zapis prób i ocen razem z metodologią oraz rubryką. Wspólne wejście i wersjonowanie obliczeń, reguł i konfiguracji muszą umożliwiać odtworzenie procedury porównania.
- Przechowuj hasła wyłącznie w postaci bezpiecznych skrótów w bazie. Trzymaj klucze API, tokeny i wartości konfiguracji zawierające sekrety poza repozytorium. Do przykładów i testów używaj danych syntetycznych lub materiału dopuszczonego do użycia.

## Zakończenie etapu i Git

- Po zmianach uruchom właściwe testy i sprawdzenia, przejrzyj wynik i odnotuj ograniczenia weryfikacji.
- Podsumuj wykonane zmiany, wyniki sprawdzeń i istotne decyzje. Zaproponuj komunikat commita po angielsku.
- Wykonuj `git commit` i `git push` wyłącznie po uzyskaniu zgody na daną operację. Początkowa widoczność repozytorium GitHub ma być prywatna.
- Utwórz repozytorium na GitHubie wyłącznie po osobnym poleceniu użytkownika.
