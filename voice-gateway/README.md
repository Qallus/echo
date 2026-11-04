# Echo voice gateway (Redial AI screening)

Bridges a Redial call's audio to the xAI realtime voice agent. Twilio and xAI both speak G.711 μ-law at 8 kHz, so audio passes straight through.

```
Caller ─ Twilio number ─ /api/webhooks/twilio/redial/voice (Echo: rules, TwiML)
                              │ <Connect><Stream> + signed token
                              ▼
                     this gateway (wss://…/twilio) ⇄ wss://api.x.ai/v1/realtime
                              │ signed POSTs
                              ▼
            Echo: /api/webhooks/redial/session, /api/webhooks/redial/result
```

Echo owns everything else: the xAI key (Admin → Settings → Integrations → xAI), the assistant's instructions, the rules, saving the call and notifying the member. The gateway only holds the shared secret.

## Deploy on Coolify

1. **New Resource → Application** from this repo. **Base directory:** `voice-gateway`. **Build pack:** Dockerfile.
2. **Environment variables:**
   - `APP_URL`: Echo's public URL, e.g. `https://echo.redial.si`
   - `REDIAL_GATEWAY_SECRET`: a long random value, marked secret (for example from `openssl rand -hex 32`)
   - `MAX_CALLS` (optional): concurrent calls, 20 by default
3. **Domain:** e.g. `https://voice.redial.si`, port 8080. Coolify handles TLS, so Twilio connects over `wss://`.
4. In Echo, open **Admin → Settings → Integrations → Redial voice gateway**:
   - **Gateway URL:** `wss://voice.redial.si`
   - **Shared secret:** the same value as `REDIAL_GATEWAY_SECRET`
5. Check `https://voice.redial.si/health` returns `{"ok":true}`.

## Local run

```
cd voice-gateway
npm ci
APP_URL=http://localhost:3000 REDIAL_GATEWAY_SECRET=… node index.mjs
```

Twilio needs a public `wss://` URL, so live calls require a tunnel (e.g. ngrok) or the deployed service.
