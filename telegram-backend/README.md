# HASAN VIDEO STUDIO — Telegram Storage API

This backend uses Telegram MTProto (GramJS), not the standard Bot API upload endpoint, so it can support large video uploads subject to Telegram/account limits and Render request limits.

## Render
- Root Directory: `telegram-backend`
- Runtime: Node
- Build Command: `npm install`
- Start Command: `npm start`
- Node version: 20+

## Required Render Environment Variables
- `API_ID`, `API_HASH`: create Telegram API credentials at https://my.telegram.org
- `TELEGRAM_SESSION`: GramJS StringSession generated after signing in to the Telegram account that is an admin in the private channel
- `CHANNEL_ID`: private channel peer ID, usually starts with `-100`
- `ADMIN_SECRET`: a long random secret
- `ALLOWED_ORIGIN`: website origin

Never commit real tokens, API hashes, session strings, or admin secrets.

## Endpoints
- `GET /`: service status
- `GET /health`: configuration status
- `POST /api/upload`: multipart field `video`; optional `title`; header `x-admin-secret`

The frontend must send the upload to this endpoint. Playback/stream proxy and frontend integration must be completed before switching the live website from Firebase Storage.
