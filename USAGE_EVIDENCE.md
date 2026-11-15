# Usage evidence

The project ceiling of 10 needs proof that people outside the team used the live app. This file collects that proof. Fill it in only with real numbers; nothing here is estimated.

## Sources

| Source | Where to read it | What it shows |
|---|---|---|
| Vercel Analytics | Vercel project > Analytics | Page views and unique visitors, with no cookies |
| `/api/stats` (admin only) | `GET https://<backend>/api/stats` signed in as an `ADMIN_EMAILS` account | Accounts, sign-ups in the last 7 days, Trips, planned Trips, feedback count and average rating |
| Feedback widget | MongoDB `feedbacks` collection | Rating (1–5) and an optional message per Traveler |

## Snapshots

Add one row each time you check. Do not list team members as outside users.

| Date | Unique visitors (Vercel) | Accounts | Planned Trips | Feedback (count / avg) | Notes |
|---|---|---|---|---|---|

## Feedback log

Copy messages from the `feedbacks` collection here without names or emails.

| Date | Rating | Message |
|---|---|---|
