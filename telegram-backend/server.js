require("dotenv").config();
const express = require("express");
const cors = require("cors");
const multer = require("multer");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");
const ffmpegPath = require("ffmpeg-static");
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
const uploadDir = path.join(os.tmpdir(), "hasan-video-uploads");
fs.mkdirSync(uploadDir, { recursive: true });
const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadDir),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname || "").toLowerCase().replace(/[^.a-z0-9]/g, "");
      cb(null, `${Date.now()}-${require("crypto").randomUUID()}${ext}`);
    }
  }),
  limits: { fileSize: 500 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if ((file.mimetype || "").startsWith("video/") || /\\.(mp4|m4v|mov|webm|mkv|avi|3gp)$/i.test(file.originalname || "")) return cb(null, true);
    cb(new Error("Please upload a video file."));
  }
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
  const configured = CHANNEL_ID.trim();
  let publicName = configured;

  // Accept @username, username, or a public t.me/username URL.
  if (publicName.toLowerCase().startsWith("https://t.me/")) {
    publicName = publicName.slice("https://t.me/".length);
  } else if (publicName.toLowerCase().startsWith("http://t.me/")) {
    publicName = publicName.slice("http://t.me/".length);
  }
  if (publicName.startsWith("@")) publicName = publicName.slice(1);
  if (publicName.endsWith("/")) publicName = publicName.slice(0, -1);

  // Public channels can be resolved directly from their username.
  const isUsername = /^[A-Za-z][A-Za-z0-9_]{4,}$/.test(publicName);
  if (isUsername) {
    const entity = await tg.getEntity("@" + publicName);
    if (entity && entity.className === "Channel") return entity;
    throw new Error("CHANNEL_ID username did not resolve to a Telegram channel. Check the public channel username.");
  }

  // Numeric channel IDs are resolved from the logged-in account's dialogs.
  const wanted = configured.replace(/^-100/, "").replace(/^-/, "");
  const dialogs = await tg.getDialogs({ limit: 1000 });
  const match = dialogs.find(d => d.isChannel && String(d.entity.id) === wanted);
  if (!match) throw new Error("CHANNEL_ID was not found in this Telegram account's channel dialogs. Make sure the logged-in account is a channel member/admin and CHANNEL_ID is correct.");
  return match.entity;
}

function transcodeToBrowserMp4(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    if (!ffmpegPath) return reject(new Error("FFmpeg binary is unavailable on this server."));
    const args = [
      "-y", "-hide_banner", "-loglevel", "error",
      "-i", inputPath,
      "-map", "0:v:0", "-map", "0:a?",
      "-c:v", "libx264", "-preset", "ultrafast", "-crf", "23",
      "-pix_fmt", "yuv420p",
      "-c:a", "aac", "-b:a", "128k",
      "-movflags", "+faststart", "-f", "mp4",
      outputPath
    ];
    const proc = spawn(ffmpegPath, args, { stdio: ["ignore", "ignore", "pipe"] });
    let errorText = "";
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        proc.kill("SIGKILL");
        settled = true;
        reject(new Error("Video conversion timed out. Try a shorter or smaller video."));
      }
    }, 30 * 60 * 1000);
    proc.stderr.on("data", chunk => {
      if (errorText.length < 12000) errorText += chunk.toString();
    });
    proc.on("error", err => {
      if (settled) return;
      settled = true; clearTimeout(timer); reject(err);
    });
    proc.on("close", code => {
      if (settled) return;
      settled = true; clearTimeout(timer);
      if (code === 0 && fs.existsSync(outputPath)) resolve(outputPath);
      else reject(new Error("Video conversion failed. Make sure the file contains a video track. " + errorText.slice(-1800)));
    });
  });
}

async function requireFirebaseAdmin(req, res, next) {
  try {
    const header = req.get("authorization") || "";
    const match = header.match(/^Bearer\s+(.+)$/i);
    if (!match) return res.status(401).json({ error: "Sign in required." });
    const decoded = await firebaseAuth.verifyIdToken(match[1]);
    if ((decoded.email || "").toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
      return res.status(403).json({ error: "Wrong Firebase account. Sign in with " + ADMIN_EMAIL + " to upload templates." });
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
  let convertedPath;
  try {
    convertedPath = path.join(uploadDir, `converted-${Date.now()}-${require("crypto").randomUUID()}.mp4`);
    console.log("Converting uploaded video to H.264/AAC MP4:", req.file.originalname);
    await transcodeToBrowserMp4(req.file.path, convertedPath);
    const convertedSize = (await fs.promises.stat(convertedPath)).size;

    const tg = await telegram();
    const channel = await telegramChannelEntity(tg);
    const result = await tg.sendFile(channel, {
      file: convertedPath,
      caption: req.body.title || req.file.originalname,
      forceDocument: false,
      supportsStreaming: true,
      workers: 1
    });
    const msg = Array.isArray(result) ? result[0] : result;
    res.json({
      ok: true,
      messageId: Number(msg.id),
      fileName: req.file.originalname.replace(/\\.[^.]+$/, "") + ".mp4",
      originalFileName: req.file.originalname,
      size: convertedSize,
      originalSize: req.file.size,
      mimeType: "video/mp4",
      converted: true,
      videoCodec: "H.264",
      audioCodec: "AAC",
      videoUrl: `https://${req.get("host")}/api/video/${Number(msg.id)}`
    });
  } catch (e) {
    console.error("Telegram upload/conversion failed:", e);
    const message = e.message || "Video upload failed";
    const isConversionError = message.includes("Video conversion") || message.includes("FFmpeg") || message.includes("timed out");
    res.status(e.status || (isConversionError ? 422 : 500)).json({ error: message });
  } finally {
    fs.promises.unlink(req.file.path).catch(() => {});
    if (convertedPath) fs.promises.unlink(convertedPath).catch(() => {});
  }
});

function runFfmpeg(args, timeoutMs = 8 * 60 * 1000) {
  return new Promise((resolve, reject) => {
    if (!ffmpegPath) return reject(new Error("FFmpeg binary is unavailable."));
    const proc = spawn(ffmpegPath, args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    const timer = setTimeout(() => { proc.kill("SIGKILL"); reject(new Error("Scene analysis timed out.")); }, timeoutMs);
    proc.stderr.on("data", chunk => { if (stderr.length < 20000) stderr += chunk.toString(); });
    proc.on("error", err => { clearTimeout(timer); reject(err); });
    proc.on("close", code => {
      clearTimeout(timer);
      if (code === 0) resolve(stderr);
      else reject(new Error("FFmpeg scene analysis failed: " + stderr.slice(-1200)));
    });
  });
}
async function analyzeVideoWithGemini(filePath, originalName) {
  const apiKey = process.env.GEMINI_API_KEY || "";
  if (!apiKey) { const e = new Error("AI is not configured. Add GEMINI_API_KEY in Render Environment."); e.status = 503; throw e; }
  const dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "hasan-scenes-"));
  try {
    const pattern = path.join(dir, "scene-%02d.jpg");
    const log = await runFfmpeg(["-hide_banner", "-i", filePath, "-vf", "select='gt(scene,0.28)',scale=480:-1,showinfo", "-vsync", "vfr", "-frames:v", "10", "-q:v", "5", pattern]);
    const times = [...log.matchAll(/pts_time:([0-9.]+)/g)].map(m => Number(m[1]));
    const files = (await fs.promises.readdir(dir)).filter(n => n.endsWith(".jpg")).sort();
    if (!files.length) {
      const first = path.join(dir, "scene-01.jpg");
      await runFfmpeg(["-y", "-ss", "0", "-i", filePath, "-frames:v", "1", "-vf", "scale=480:-1", first]);
      files.push("scene-01.jpg"); times.push(0);
    }
    const imageParts = [];
    for (let i = 0; i < files.length; i++) {
      const bytes = await fs.promises.readFile(path.join(dir, files[i]));
      imageParts.push({ inline_data: { mime_type: "image/jpeg", data: bytes.toString("base64") } });
      imageParts.push({ text: "Frame " + (i + 1) + " approximate timestamp: " + Number(times[i] || 0).toFixed(2) + " seconds." });
    }
    const prompt = "Analyze these sampled keyframes from a user-uploaded short-form video template. Original filename: " + originalName + ". Return ONLY valid JSON with keys title (catchy template name, max 6 words), description (accurate public card description under 220 characters), scenes (array of objects with start, end, kind, replaceable, reason). Use only visible evidence. Scenes should cover likely distinct visual shots using the supplied timestamps; mark replaceable=true only when a shot appears to be a portrait/photo placeholder or a full-frame personal-media shot that a user could reasonably replace. Do not assume every cut is replaceable. If uncertain, mark false. Estimate start/end seconds; keep ordered, non-overlapping. Include confidence 0 to 1 for each scene.";
    const body = { contents: [{ parts: [{ text: prompt }, ...imageParts] }], generationConfig: { temperature: 0.2, responseMimeType: "application/json" } };
    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=" + encodeURIComponent(apiKey), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error?.message || "Gemini analysis failed (" + response.status + ").");
    const raw = result.candidates?.[0]?.content?.parts?.map(p => p.text || "").join("") || "";
    let parsed;
    try { parsed = JSON.parse(raw.replace(/^```json\s*|\s*```$/g, "")); }
    catch (_) { throw new Error("AI returned invalid scene data. Please retry or use manual scenes."); }
    const scenes = Array.isArray(parsed.scenes) ? parsed.scenes.slice(0, 12).map((v, i) => ({
      id: "ai-scene-" + (i + 1), order: i + 1,
      start: Math.max(0, Number(v.start) || 0), end: Math.max(0, Number(v.end) || 0),
      duration: Math.max(0.5, (Number(v.end) || 0) - (Number(v.start) || 0)),
      type: "photo", kind: String(v.kind || "shot").slice(0, 80),
      replaceable: Boolean(v.replaceable), reason: String(v.reason || "").slice(0, 180),
      confidence: Math.max(0, Math.min(1, Number(v.confidence) || 0))
    })) : [];
    return { title: String(parsed.title || "").slice(0, 70), description: String(parsed.description || "").slice(0, 240), scenes, sampledFrames: files.length };
  } finally { await fs.promises.rm(dir, { recursive: true, force: true }).catch(() => {}); }
}
app.post("/api/analyze-template", requireFirebaseAdmin, upload.single("video"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "Select a video file to analyze." });
  try {
    const analysis = await analyzeVideoWithGemini(req.file.path, req.file.originalname);
    res.json({ ok: true, ...analysis });
  } catch (e) {
    console.error("Template AI analysis failed:", e);
    res.status(e.status || 500).json({ error: e.message || "Template analysis failed." });
  } finally { fs.promises.unlink(req.file.path).catch(() => {}); }
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
