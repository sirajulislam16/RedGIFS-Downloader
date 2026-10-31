import express from "express";
import cors from "cors";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fetchRedgifsMedia, downloadMediaResponse, parseRedgifsInput } from "./redgifs.js";

const app = express();
const PORT = Number(process.env.PORT || 4000);
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "http://localhost:5173";
const __dirname = path.dirname(fileURLToPath(import.meta.url));

app.use(cors({ origin: CLIENT_ORIGIN }));
app.use(express.json({ limit: "16kb" }));

app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.post("/api/fetch", async (req, res) => {
  try {
    const input = String(req.body?.url || "").trim();
    const parsed = parseRedgifsInput(input);
    const media = await fetchRedgifsMedia(parsed);
    res.json(media);
  } catch (error) {
    const status = error.status || 400;
    res.status(status).json({ error: error.message || "Unable to retrieve this media." });
  }
});

app.get("/api/download", async (req, res) => {
  try {
    const mediaUrl = String(req.query.url || "");
    const filename = String(req.query.filename || "redgifs-media");
    const result = await downloadMediaResponse(mediaUrl);
    const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120) || "redgifs-media";
    res.setHeader("Content-Type", result.contentType || "application/octet-stream");
    res.setHeader("Content-Disposition", `attachment; filename="${safeName}"`);
    if (result.contentLength) res.setHeader("Content-Length", result.contentLength);
    result.body.pipe(res);
    result.body.on("error", () => res.destroy());
  } catch (error) {
    if (!res.headersSent) res.status(error.status || 502).json({ error: error.message || "Download failed." });
    else res.destroy();
  }
});

// Serve the production build when present.
const distPath = path.resolve(__dirname, "../dist");
app.use(express.static(distPath));
app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api/")) return next();
  res.sendFile(path.join(distPath, "index.html"), (err) => err && next());
});

app.listen(PORT, () => console.log(`RedGIFs Downloader API listening on http://localhost:${PORT}`));
