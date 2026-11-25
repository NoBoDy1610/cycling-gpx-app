# Import śladu GPX

`POST /api/routes/import` wymaga aktywnej sesji i dozwolonego `Origin`. Ciało `multipart/form-data` zawiera dokładnie jedno pole `file` z plikiem GPX. Rozpoznanie pliku opiera się na zawartości XML.

Przykład korzysta z ciasteczka uzyskanego po zalogowaniu. [API kont i sesji](authentication.md)

```bash
curl --fail-with-body http://127.0.0.1:3000/api/routes/import \
  -H 'Origin: http://127.0.0.1:5173' \
  -b 'cycling_session=<token-sesji>' \
  -F 'file=@apps/web/public/samples/poland-cycling-routes.gpx'
```

Obsługiwane są ślady `trk` GPX 1.1 w XML 1.0 zakodowanym w UTF-8. Plik może zawierać wiele śladów i segmentów. Limity pojedynczego importu wynoszą 10 MiB, 100 000 punktów śladów, 100 śladów, 2000 segmentów oraz 64 poziomy zagnieżdżenia XML.

## Odpowiedź `201`

Obiekt `import` zawiera `id`, `gpxVersion`, `createdAt`, tablicę `warnings` i tablicę `routes`. Każdy wpis `routes` zawiera `id`, `trackIndex`, `title`, `pointCount` oraz `analysis`. Analiza zwraca `id`, `algorithmVersion`, `distanceM`, `elevationGainM`, `elevationLossM`, `elapsedDurationS`, `averageSpeedMps` i `qualityFlags`. Przy braku danych odpowiednie miary mają wartość `null`. Geometria segmentów jest przechowywana w bazie do odczytu na ekranie szczegółów trasy.

Indeksy śladów i segmentów liczą się od zera w kolejności wystąpienia w pliku. Kod `IGNORED_SEGMENT` wskazuje pusty lub jednopunktowy segment. Kody `ELEVATION_UNAVAILABLE`, `TIME_UNAVAILABLE` i `TIME_INCONSISTENT` dotyczą śladu. Są też widoczne w `qualityFlags` danej analizy.

## Odpowiedzi błędów

| HTTP | Kody |
| --- | --- |
| `400` | `INVALID_MULTIPART` |
| `401` | `SESSION_REQUIRED` |
| `403` | `INVALID_ORIGIN` |
| `413` | `GPX_LIMIT_EXCEEDED` |
| `415` | `UNSUPPORTED_MEDIA_TYPE` |
| `422` | `INVALID_XML`, `UNSUPPORTED_XML_DECLARATION`, `UNSUPPORTED_GPX_VERSION`, `INVALID_GPX_STRUCTURE`, `INVALID_COORDINATES`, `NO_VALID_TRACK` |
| `500` | `INTERNAL_ERROR` |

Odpowiedź błędu zawiera `{ "error": { "code": "…" } }`. Zapis wszystkich śladów z jednego pliku odbywa się w jednej transakcji. Cały import jest odrzucany, gdy chociaż jeden ślad zawiera niepoprawne współrzędne lub ma za mało prawidłowych punktów.
