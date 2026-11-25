# Historia i szczegóły tras

Wszystkie ścieżki wymagają aktywnej sesji użytkownika. Odpowiedzi zawierają `Cache-Control: no-store`. Import pliku ma osobny kontrakt. [API importu](gpx-import.md)

| HTTP | Odpowiedź |
| --- | --- |
| `GET /api/routes` | `200`, obiekt `{ routes, nextCursor }`. Każda trasa ma pola `id`, `title`, `importedAt`, `distanceM`. `distanceM` może być `null`. |
| `GET /api/routes/:routeId` | `200`, obiekt `{ route }`. Trasa ma pola `id`, `title`, `importedAt`, `pointCount`, `segments`, `analysis`. |
| `DELETE /api/routes/:routeId` | `204`, usunięcie trasy i jej analiz. Żądanie wymaga dozwolonego nagłówka `Origin`. |

Historia zwraca najnowsze importy jako pierwsze. Ślady z jednego pliku zachowują ich kolejność w pliku. Gdy daty są równe, o kolejności importów decyduje ich identyfikator. Ustaw `limit` od 1 do 50, aby zmienić domyślne 12 tras na stronę. Kolejną stronę pobiera się przez `?cursor=<nextCursor>`. `nextCursor` ma wartość `null` na ostatniej stronie.

`segments` to uporządkowana tablica segmentów. Każdy segment jest tablicą punktów w formacie `[latitude, longitude]`. `analysis` zawiera najnowsze statystyki w formacie używanym przez import GPX lub `null`, jeśli trasa nie ma analizy. `importedAt` to data importu zapisana w UTC.

| HTTP | Kod |
| --- | --- |
| `400` | `INVALID_PAGINATION` dla niepoprawnego limitu lub kursora |
| `401` | `SESSION_REQUIRED` |
| `403` | `INVALID_ORIGIN` przy usuwaniu |
| `404` | `ROUTE_NOT_FOUND` dla trasy niedostępnej na koncie |
| `500` | `INTERNAL_ERROR` |
