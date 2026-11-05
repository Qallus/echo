# Redial app API (`/api/mobile`)

For the Redial mobile app (step 8 in `docs/REDIAL_MOBILE_PLAN.md`). The app signs in with Supabase Auth (same accounts as the web) and sends the session's access token on every request:

```
Authorization: Bearer <access_token>
```

- Only a member's own session token works. Anon and service tokens, expired tokens, and tokens issued to OAuth apps (the Claude connector) get `401 {"error":"Sign in again."}`. Refresh the session and retry.
- Each request runs the same reads and server actions as the web, as that member (`src/lib/mobile/context.ts`), so RLS and the database checks are identical. No service-role key.
- `GET /api/mobile/<name>?…` for reads, `POST /api/mobile/<name>` with a JSON body for actions. Responses are JSON and never cached. A result with an `error` field is a `400`; bad input is `400 {"error":"Invalid request.","issues":[…]}`.
- The list lives in `src/lib/mobile/routes.ts`; add new entries there.

## Account and push

| | Name | Input | Returns |
|---|---|---|---|
| GET | `me` | — | `user`, `profile` (name, avatar, timezone, `push_privacy`), `workspaces`, `lines` (with `access`), `unreadCalls` |
| POST | `settings.push-privacy` | `level`: `full` \| `caller` \| `private` | what phone notifications show |
| POST | `devices.register` | `token` (Expo push token), `platform`: `android` \| `ios`, `appVersion?` | call after sign-in and whenever the token changes |
| POST | `devices.unregister` | `token` | call on sign-out |

Push: every notification Echo creates (calls, transcripts, shares…) is also sent to registered phones through Expo, if the member has push on for that event and it isn't quiet hours. `data` carries `url` (a web path such as `/calls?call=<id>`, for deep links), `type` and `notification_id`. Android channels: `calls` for Redial calls, `default` for everything else (the app creates both). Privacy: `full` shows the title and body, `caller` the title only ("Call from Mike…"), `private` a generic line.

## Redial

| | Name | Input |
|---|---|---|
| GET | `line` | `line` (id): the line, its calls with transcripts, rules lists, callbacks, directory and Mirror settings |
| POST | `calls.update` | `id`, `patch`: `read?`, `archived?`, `category?` |
| POST | `calls.voicemail` | `path` → `{ url }` |
| POST | `callbacks.add` | `lineId`, `callId?`, `name`, `number`, `due` (local `YYYY-MM-DDTHH:mm`), `timezone`, `note` |
| POST | `callbacks.done` | `id`, `done` |
| POST | `callbacks.delete` | `id` |
| POST | `rules.save` | `lineId`, `settings` (label, forward_to, mode, paused, allow_connect, assistant_name, voice, greeting, about, max_seconds) |
| POST | `lists.add` | `lineId`, `number`, `kind`: `allow` \| `block` \| `vip`, `label` |
| POST | `lists.remove` | `id` |

Live calls:

| | Name | Input |
|---|---|---|
| GET | `live` | `line` (id) → `{ calls }`: live sessions, turns, directions, transfers, Mirror |
| POST | `live.listen` | `callId` → `{ token, ticket }`: a Twilio Voice access token and a two-minute ticket (Insider) |
| POST | `live.stop-listening` | `participantId` |
| POST | `live.take-over` | `callId` (Gavel) |
| POST | `live.direct` | `callId`, `text` (Audible) |
| POST | `live.transfer` | `callId`, `to`: `destinationId?`, `number?`, `confirmed?` (Directory) |
| POST | `mirror.start` / `mirror.stop` | `callId` |
| POST | `mirror.dismiss` | `id` |
| POST | `mirror.send` | `id`, `draft`: `to`, `subject?`, `body` |

## Echo

| | Name | Input |
|---|---|---|
| GET | `recordings` | — → `{ recordings, workspaces }` (trash excluded) |
| GET | `recording` | `id` → transcript, highlights, summary, events, `audioUrl` (signed, 6 hours) |
| POST | `action-items.toggle` | `id`, `done` |
| POST | `/api/mobile/ask` | the web chat body: `{ modelId, recordingId?, messages }` → plain-text stream |
