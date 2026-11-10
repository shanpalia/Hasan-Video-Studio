require("dotenv").config();
const express = require("express");
const cors = require("cors");
const multer = require("multer");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions");

const app = express();
app.use(cors({ origin: process.env.ALLOWED_ORIGIN || "https://shanpalia.github.io" }));
app.use(express.json({ limit: "1mb" }));

const PORT = Number(process.env.PORT || 10000);
const API_ID = Number(process.env.API_ID || 0);
const API_HASH = process.env.API_HASH || "";
const SESSION = process.env.TELEGRAM_SESSION || "";
const CHANNEL_ID = process.env.CHANNEL_ID || "";
const ADMIN_SECRET = process.env.ADMIN_SECRET || "";
const upload = multer({
  dest: path.join(os.tmpdir(), "hasan-video-uploads"),
  limits: { fileSize: 500 * 1024 * 1024 }
});

let client;
let connecting;
async function telegram() {
  if (client && client.connected) return client;
  if (!API_ID || !API_HASH || !SESSION || !CHANNEL_ID) {
    const e = new Error("Telegram backend is not configured. Set API_ID, API_HASH, TELEGRAM_SESSION and CHANNEL_ID.");
    e.status = 503; throw e;
  }
  if (!connecting) {
    connecting = (async () => {
      const c = new TelegramClient(new StringSession(SESSION), API_ID, API_HASH, {
        connectionRetries: 5
      });
      await c.connect();
      if (!await c.checkAuthorization()) throw new Error("TELEGRAM_SESSION is invalid or expired.");
      client = c;
      return c;
    })().finally(() => { connecting = null; });
  }
  return connecting;
}
function admin(req, res, next) {
  const supplied = req.get("x-admin-secret") || req.body?.adminSecret;
  if (!ADMIN_SECRET || supplied !== ADMIN_SECRET) return res.status(401).json({ error: "Unauthorized" });
  next();
}
app.get("/", (_req, res) => res.json({ service: "HASAN VIDEO STUDIO Telegram Storage API", status: "online" }));
app.get("/health", async (_req, res) => {
  const configured = Boolean(API_ID && API_HASH && SESSION && CHANNEL_ID && ADMIN_SECRET);
  res.status(configured ? 200 : 503).json({ ok: configured, configured, service: "hasan-video-storage-api" });
});
app.post("/api/upload", admin, upload.single("video"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "Select a video file." });
  try {
    const tg = await telegram();
    const result = await tg.sendFile(CHANNEL_ID, {
      file: req.file.path,
      caption: req.body.title || req.file.originalname,
      forceDocument: false,
      workers: 1
    });
    const msg = Array.isArray(result) ? result[0] : result;
    res.json({
      ok: true,
      messageId: Number(msg.id),
      fileName: req.file.originalname,
      size: req.file.size,
      mimeType: req.file.mimetype,
      note: "Video saved to the private Telegram channel. Playback proxy integration is the next step."
    });
  } catch (e) {
    console.error("Telegram upload failed:", e);
    res.status(e.status || 500).json({ error: e.message || "Telegram upload failed" });
  } finally {
    fs.promises.unlink(req.file.path).catch(() => {});
  }
});
app.listen(PORT, "0.0.0.0", () => console.log("HASAN Telegram API listening on", PORT));
