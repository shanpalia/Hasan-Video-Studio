require("dotenv").config();
const express = require("express");
const cors = require("cors");
const multer = require("multer");
const fs = require("fs");
const os = require("os");
const path = require("path");
const admin = require("firebase-admin");
const { TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions");

const app = express();
const allowedOrigins = (process.env.ALLOWED_ORIGIN || "https://shanpalia.github.io").split(",").map(v => v.trim()).filter(Boolean);
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error("Origin not allowed by CORS"));
  },
  exposedHeaders: ["Content-Length", "Content-Range", "Accept-Ranges"]
}));
app.use(express.json({ limit: "1mb" }));

const PORT = Number(process.env.PORT || 10000);
const API_ID = Number(process.env.API_ID || 0);
const API_HASH = process.env.API_HASH || "";
const SESSION = process.env.TELEGRAM_SESSION || "";
const CHANNEL_ID = process.env.CHANNEL_ID || "";
const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || "shanpalia-apk-hub";
const ADMIN_EMAIL = "shanpalia786@gmail.com";
const upload = multer({
  dest: path.join(os.tmpdir(), "hasan-video-uploads"),
  limits: { fileSize: 500 * 1024 * 1024 }
});

if (!admin.apps.length) admin.initializeApp({ projectId: FIREBASE_PROJECT_ID });
const firebaseAuth = admin.auth();

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
      const c = new TelegramClient(new StringSession(SESSION), API_ID, API_HASH, { connectionRetries: 5 });
      await c.connect();
      if (!await c.checkAuthorization()) throw new Error("TELEGRAM_SESSION is invalid or expired.");
      client = c;
      return c;
    })().finally(() => { connecting = null; });
  }
  return connecting;
}
async function telegramChannelEntity(tg) {
  const wanted = CHANNEL_ID.replace(/^-100/, "").replace(/^-/, "");
  const dialogs = await tg.getDialogs({ limit: 1000 });
  const match = dialogs.find(d => d.isChannel && String(d.entity.id) === wanted);
  if (!match) throw new Error("CHANNEL_ID was not found in this Telegram account's channel dialogs. Make sure the logged-in account is a channel member/admin and CHANNEL_ID is correct.");
  return match.entity;
}
async function requireFirebaseAdmin(req, res, next) {
  try {
    const header = req.get("authorization") || "";
    const match = header.match(/^Bearer\s+(.+)$/i);
    if (!match) return res.status(401).json({ error: "Sign in required." });
    const decoded = await firebaseAuth.verifyIdToken(match[1]);
    if (decoded.email !== ADMIN_EMAIL) {
      return res.status(403).json({ error: "Wrong Firebase account. Sign in with " + ADMIN_EMAIL + " to upload templates." });
    }
    if (decoded.email_verified !== true) {
      return res.status(403).json({ error: "The admin email " + ADMIN_EMAIL + " is not verified. Verify it in Firebase Authentication, then sign in again." });
    }
    req.adminUser = decoded;
    next();
  } catch (e) {
    console.error("Firebase admin verification failed:", e.message);
    return res.status(401).json({ error: "Admin authentication expired. Please sign in again." });
  }
}
app.get("/", (_req, res) => res.json({ service: "HASAN VIDEO STUDIO Telegram Storage API", status: "online" }));
app.get("/health", (_req, res) => {
  const configured = Boolean(API_ID && API_HASH && SESSION && CHANNEL_ID);
  res.status(configured ? 200 : 503).json({ ok: configured, configured, service: "hasan-video-storage-api" });
});
app.post("/api/upload", requireFirebaseAdmin, upload.single("video"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "Select a video file." });
  try {
    const tg = await telegram();
    const channel = await telegramChannelEntity(tg);
    const result = await tg.sendFile(channel, {
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
      videoUrl: `https://${req.get("host")}/api/video/${Number(msg.id)}`
    });
  } catch (e) {
    console.error("Telegram upload failed:", e);
    res.status(e.status || 500).json({ error: e.message || "Telegram upload failed" });
  } finally {
    fs.promises.unlink(req.file.path).catch(() => {});
  }
});
app.get("/api/video/:messageId", async (req, res) => {
  const messageId = Number(req.params.messageId);
  if (!Number.isSafeInteger(messageId) || messageId <= 0) return res.status(400).json({ error: "Invalid video ID." });
  let tempDir;
  try {
    const tg = await telegram();
    const channel = await telegramChannelEntity(tg);
    const messages = await tg.getMessages(channel, { ids: [messageId] });
    const message = messages && messages[0];
    if (!message || !message.media) return res.status(404).json({ error: "Video not found." });
    tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "hasan-video-play-"));
    const outputPath = path.join(tempDir, "video.bin");
    await tg.downloadMedia(message, { outputFile: outputPath });
    const mime = message.media.document?.mimeType || "video/mp4";
    res.setHeader("Content-Type", mime);
    res.setHeader("Cache-Control", "public, max-age=300");
    res.sendFile(outputPath, err => {
      fs.promises.rm(tempDir, { recursive: true, force: true }).catch(() => {});
      if (err && !res.headersSent) res.status(err.statusCode || 500).end();
    });
  } catch (e) {
    if (tempDir) fs.promises.rm(tempDir, { recursive: true, force: true }).catch(() => {});
    console.error("Telegram playback failed:", e);
    if (!res.headersSent) res.status(500).json({ error: "Could not load video from Telegram." });
  }
});
app.listen(PORT, "0.0.0.0", () => console.log("HASAN Telegram API listening on", PORT));
