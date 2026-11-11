# HASAN VIDEO STUDIO — Telegram Storage API

This backend stores template videos in a private Telegram channel using MTProto (GramJS), and serves them to the public website through a playback endpoint.

## Render
- Root Directory: `telegram-backend`
- Runtime: Node
- Build Command: `npm install`
- Start Command: `npm start`
- Node version: 20+

## Required Render Environment Variables
- `API_ID`, `API_HASH`: Telegram API credentials from https://my.telegram.org
- `TELEGRAM_SESSION`: GramJS StringSession for the Telegram account that is a member/admin of the private channel
- `CHANNEL_ID`: private channel ID, usually starts with `-100`
- `ALLOWED_ORIGIN`: website origin, normally `https://shanpalia.github.io`
- Optional: `FIREBASE_PROJECT_ID`, defaults to `shanpalia-apk-hub`

Never commit real API credentials or session strings.

## Authentication
The admin upload endpoint verifies the Firebase ID token from the existing HASAN admin login and only allows the verified account `shanpalia786@gmail.com`. Do not place a Telegram session or admin secret in browser code.

## Endpoints
- `GET /`: service status
- `GET /health`: configuration status
- `POST /api/upload`: multipart field `video`, optional `title`; requires `Authorization: Bearer <Firebase ID token>`
- `GET /api/video/:messageId`: retrieves the saved Telegram video for browser playback

The public homepage reads published template metadata from Firestore. Existing Firebase Storage videos remain untouched; newly uploaded videos use Telegram.
