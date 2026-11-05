# Redial mobile app

The Redial app for Android (first) and iPhone: call screening with Echo built in. Expo SDK 58, Expo Router, React Native. Plan: `../docs/REDIAL_MOBILE_PLAN.md`. API it calls: `../docs/MOBILE_API.md`.

## Run it

1. `npm install` in this folder.
2. Copy `.env.example` to `.env.local` and fill in the values (all public).
3. `npx expo start --web` for a quick look in the browser (onboarding, sign-in, tour; push and calls need a phone), or a development build on an Android phone (below).

The app talks to the Echo website's `/api/mobile` routes, so run the website too (`npm run dev` in the repo root) or point `EXPO_PUBLIC_API_URL` at a deployed site.

## Phone builds

Built in the cloud with Expo (EAS): `npx eas-cli@latest build --profile development --platform android`. Needs an Expo account, and Firebase (FCM) credentials for push notifications.

## Shared with the website

`@shared/*` is `../src/lib/redial/*` (feature names, call types, the demo call). Those files must not import anything, so both apps can use them.

## Checks

`npx tsc --noEmit` and `npx expo lint`.
