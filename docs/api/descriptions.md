# Opisy tras

Ścieżki wymagają aktywnej sesji i dostępu do danej trasy. Żądanie `POST` wymaga dozwolonego `Origin`. Odpowiedzi zawierają `Cache-Control: no-store`.

| HTTP | Odpowiedź |
| --- | --- |
| `POST /api/routes/:routeId/comparisons` | `201`, `{ comparison }`. Generuje opis regułowy z najnowszej analizy i zapisuje osobną próbę. |
| `POST /api/routes/:routeId/comparisons/ai` | `201`, `{ comparison }` z obiema próbami opartymi na tym samym wejściu. Odpowiedź zawiera również wyniki zakończone błędem dostawcy. |
| `GET /api/routes/:routeId/comparisons` | `200`, `{ comparisons }`. Zwraca do 12 najnowszych porównań trasy albo pustą tablicę. |
| `GET /api/routes/:routeId/comparisons/:comparisonId` | `200`, `{ comparison }`. Zwraca zapisane wejście i wyniki wskazanego porównania. |

Porównanie zawiera `id`, `analysisId`, `createdAt`, `inputSchemaVersion`, `inputSnapshot`, `inputHash` i `runs`. Próba regułowa ma metodę `RULE_BASED`, status `SUCCEEDED`, tekst `outputText`, `durationMs`, `generatorVersion` oraz `errorCode` o wartości `null`. Czas reguł mierzy samo generowanie tekstu. Czas AI obejmuje wywołanie adaptera i walidację odpowiedzi, przed zapisaniem wyniku do bazy.

Próba `AI` zawiera `provider`, `modelId`, `modelRevision`, `promptVersion` i `parameters`. W trakcie żądania odczyt może zwrócić status `RUNNING`. Wynik końcowy ma status `SUCCEEDED`, `FAILED`, `TIMED_OUT` lub `INTERRUPTED`. Pole `outputText` wypełnia się po udanej walidacji. Kod błędu to `AI_INVALID_RESPONSE`, `AI_PROVIDER_ERROR`, `AI_TIMEOUT`, `AI_INTERRUPTED` lub `AI_NOT_CONFIGURED`.

## Wejście i powtarzalność

Wersja `1` wejścia zawiera `distanceM`, `elevationGainM`, `elevationLossM`, `elapsedDurationS`, `averageSpeedMps` i `qualityFlags`. Brakujące pomiary mają wartość `null`. Skrót SHA-256 powstaje z UTF-8 serializacji JSON poniższej tablicy. Flagi są sortowane leksykograficznie.

```text
[inputSchemaVersion, distanceM, elevationGainM, elevationLossM,
 elapsedDurationS, averageSpeedMps, sortedQualityFlags]
```

Ponowne wygenerowanie opisu z tych samych faktów zapisuje nową próbę z tym samym skrótem wejścia i tekstem, o ile wersja reguł jest taka sama. Usunięcie trasy usuwa też powiązane porównania i próby.

Walidacja AI sprawdza odpowiedź JSON oraz wszystkie dostępne wartości i jednostki względem zaokrągleń opisu regułowego. Akceptuje równoważne formy jednostek, np. `35 min 32 s` i `35 minut i 32 sekundy`. Dodatkowe wartości zapisane cyframi powodują odrzucenie. Ocenę znaczenia zdań i twierdzeń opisowych przewidziano w procedurze badawczej.

| HTTP | Kody błędów |
| --- | --- |
| `401` | `SESSION_REQUIRED` |
| `403` | `INVALID_ORIGIN` przy generowaniu |
| `404` | `ROUTE_NOT_FOUND`, `ANALYSIS_NOT_FOUND`, `COMPARISON_NOT_FOUND` |
| `500` | `INTERNAL_ERROR` |
