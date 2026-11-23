# Usage evidence

The project ceiling of 10 needs proof that people outside the team used the live app. This file collects that proof. Fill it in only with real numbers; nothing here is estimated.

## Sources

| Source | Where to read it | What it shows |
|---|---|---|
| Admin page (main source) | `https://<domain>/admin`, signed in as the admin account | Outside accounts, daily visitors and sign-ups, countries, devices, the masked user list, recent Events, the feedback log and the most viewed Share links |
| Vercel Analytics | Vercel project > Analytics | Page views and unique visitors, with no cookies; a second source next to our own Events |
| Stats API (admin only) | `GET /api/stats`, `/api/stats/users`, `/api/stats/activity?days=30`, `/api/stats/feedback` | The same data as the admin page, as JSON |

Admin accounts are left out of every number. Team members who sign up with their own email are counted, so use the admin account for demos.

## Snapshots

Add one row each time you check, and save a screenshot of the admin page in `docs/evidence/` with the date in the file name.

| Date | Visitors, 7 days | Outside accounts | Planned Trips | Feedback (count / avg) | Top countries | Screenshot |
|---|---|---|---|---|---|---|

## User list (masked)

Copy from the admin page's Users table. Emails stay masked (`ab***@gmail.com`).

| Joined | User | Trips (planned) | Location | Device |
|---|---|---|---|---|

## Feedback log

Copy from the admin page's Feedback log, without names or emails.

| Date | Rating | Message |
|---|---|---|
