# API kont i sesji

Ścieżki są względne do `/api/auth`. Odpowiedzi z danymi konta mają postać `{ "user": { "id": "uuid", "email": "user@example.com" } }`. Odpowiedzi błędów mają postać `{ "error": { "code": "INVALID_CREDENTIALS" } }`. API zwraca `Cache-Control: no-store`.

| HTTP | Dane JSON | Odpowiedź |
| --- | --- | --- |
| `POST /register` | `email`, `password` | `201`, publiczne dane konta i ciasteczko sesji. |
| `POST /login` | `email`, `password` | `200`, publiczne dane konta i nowe ciasteczko sesji. |
| `GET /session` | — | `200`, publiczne dane konta z aktywnej sesji. |
| `DELETE /session` | — | `204`, odwołanie wskazanej sesji i wyczyszczenie ciasteczka. Można ponowić żądanie po wylogowaniu. |
| `PATCH /account/email` | `email`, `currentPassword` | `200`, zaktualizowane dane konta. |
| `PATCH /account/password` | `newPassword`, `currentPassword` | `204`, odwołanie wszystkich sesji konta i wyczyszczenie ciasteczka. |
| `DELETE /account` | `currentPassword` | `204`, usunięcie konta i jego sesji oraz wyczyszczenie ciasteczka. |

Przy żądaniu z treścią użyj `Content-Type: application/json`. Adres e-mail jest normalizowany przez usunięcie zewnętrznych spacji i zapis małymi literami. Nowe hasło musi mieć od 15 do 128 znaków Unicode. Żądania zmieniające stan muszą zawierać dozwolony nagłówek `Origin`. W standardowym przepływie przeglądarka wysyła ciasteczko `cycling_session` automatycznie. Sesja wygasa po siedmiu dniach.

| HTTP | Kody |
| --- | --- |
| `400` | `INVALID_EMAIL`, `INVALID_PASSWORD`, `INVALID_BODY` |
| `401` | `INVALID_CREDENTIALS`, `SESSION_REQUIRED` |
| `403` | `INVALID_ORIGIN` |
| `409` | `EMAIL_TAKEN`, `ACCOUNT_CHANGED` |
| `413` | `BODY_TOO_LARGE` |
| `429` | `TOO_MANY_ATTEMPTS` |
| `500` | `INTERNAL_ERROR` |

Limit to 20 prób na 15 minut dla wspólnego IP. Obejmuje rejestrację, logowanie i operacje wymagające bieżącego hasła.
