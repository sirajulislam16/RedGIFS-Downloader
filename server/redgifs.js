import { Readable } from "node:stream";

const API = "https://api.redgifs.com/v2";
const UA = process.env.REDFGIFS_USER_AGENT ||
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0.0.0 Safari/537.36";
function isAllowedMediaHost(hostname) {
  return /^(media|thumbs\d+)\.redgifs\.com$/i.test(hostname);
}

function httpError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

export function parseRedgifsInput(raw) {
  let url;
  try { url = new URL(raw); } catch { throw httpError("Enter a valid RedGIFs URL."); }
  if (url.protocol !== "https:") throw httpError("Only secure HTTPS links are supported.");

  const host = url.hostname.toLowerCase();
  const validPageHost = ["redgifs.com", "www.redgifs.com"].includes(host);
  const validMediaHost = isAllowedMediaHost(host);
  if (!validPageHost && !validMediaHost) throw httpError("This link is not from a supported RedGIFs domain.");

  if (validPageHost) {
    const match = url.pathname.match(/^\/(?:watch|ifr)\/([a-zA-Z0-9_-]+)\/?$/);
    if (!match) throw httpError("Use a RedGIFs watch or embed link, such as redgifs.com/watch/VIDEO_ID.");
    return { kind: "redgifs-id", id: match[1], sourceUrl: url.toString() };
  }

  // Direct CDN URLs are accepted only on RedGIFs-owned media hosts.
  if (!/\.(mp4|webm|jpg|jpeg|png|webp)(?:$)/i.test(url.pathname)) {
    throw httpError("This RedGIFs media link does not have a supported file extension.");
  }
  return { kind: "direct", mediaUrl: url.toString(), sourceUrl: url.toString() };
}

async function getTemporaryToken() {
  const response = await fetch(`${API}/auth/temporary`, {
    headers: {
      "User-Agent": UA,
      "Referer": "https://www.redgifs.com/",
      "Origin": "https://www.redgifs.com"
    },
    signal: AbortSignal.timeout(15000)
  });
  if (!response.ok) throw httpError("RedGIFs authentication is temporarily unavailable. Please try again.", 502);
  const data = await response.json();
  if (!data.token) throw httpError("RedGIFs did not provide an access token.", 502);
  return data.token;
}

async function getGifData(id) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const token = await getTemporaryToken();
    const response = await fetch(`${API}/gifs/${encodeURIComponent(id)}`, {
      headers: {
        "Authorization": `Bearer ${token}`,
        "User-Agent": UA,
        "Referer": "https://www.redgifs.com/",
        "Origin": "https://www.redgifs.com",
        "Content-Type": "application/json",
        "x-customheader": `https://www.redgifs.com/watch/${id}`
      },
      signal: AbortSignal.timeout(15000)
    });
    if (response.status === 401 && attempt === 0) continue;
    if (response.status === 404) throw httpError("This media was not found. It may have been deleted or made unavailable.", 404);
    if (!response.ok) throw httpError(`RedGIFs returned an error (${response.status}). Try again later.`, 502);
    const payload = await response.json();
    if (payload.error) throw httpError("RedGIFs could not provide this media.", 404);
    const gif = payload.gif || payload;
    if (!gif?.id || !gif?.urls) throw httpError("RedGIFs returned an unsupported media response.", 502);
    return gif;
  }
  throw httpError("RedGIFs authentication expired. Please retry.", 502);
}

function safeMediaUrl(value) {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || !isAllowedMediaHost(url.hostname)) return null;
    return url.toString();
  } catch { return null; }
}

function filenameFromUrl(url, fallback) {
  try {
    const name = new URL(url).pathname.split("/").pop();
    return (name || fallback).replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 100);
  } catch { return fallback; }
}

export async function fetchRedgifsMedia(parsed) {
  if (parsed.kind === "direct") {
    const mediaUrl = safeMediaUrl(parsed.mediaUrl);
    if (!mediaUrl) throw httpError("Unsupported media host.", 400);
    const ext = new URL(mediaUrl).pathname.split(".").pop().toLowerCase();
    const isImage = ["jpg", "jpeg", "png", "webp"].includes(ext);
    return {
      id: "direct-media",
      title: filenameFromUrl(mediaUrl, "RedGIFs media"),
      type: isImage ? "Image" : "Video",
      format: ext.toUpperCase(),
      width: null, height: null, duration: null, fileSize: null,
      previewUrl: isImage ? mediaUrl : null,
      mediaUrl,
      filename: filenameFromUrl(mediaUrl, `redgifs-media.${ext}`),
      sourceUrl: parsed.sourceUrl
    };
  }

  const gif = await getGifData(parsed.id);
  const urls = gif.urls || {};
  const mediaType = Number(gif.type);

  const isVideo = mediaType === 1;
  const isImage = mediaType === 2;

  if (!isVideo && !isImage) {
    throw httpError("Unsupported RedGIFs media type.", 422);
  }

  const mediaUrl = isVideo
    ? (safeMediaUrl(urls.hd) ||
       safeMediaUrl(urls.sd) ||
       safeMediaUrl(urls.gif))
    : (safeMediaUrl(urls.hd) ||
       safeMediaUrl(urls.sd));

  if (!mediaUrl) {
    throw httpError("No downloadable media URL available.", 404);
  }

  const pathname = new URL(mediaUrl).pathname;
  const detectedExtension = pathname.match(/\.(mp4|webm|gif|jpg|jpeg|png|webp)$/i)?.[1];

  const extension = detectedExtension ||
    (isVideo ? "mp4" : "jpg");

  const title = Array.isArray(gif.tags) && gif.tags.length
    ? gif.tags.slice(0, 4).join(" ")
    : `RedGIFs ${gif.id}`;

  return {
    id: String(gif.id),
    title,
    type: isVideo ? "Video" : "Image",
    format: extension.toUpperCase(),

    width: Number(gif.width) || null,
    height: Number(gif.height) || null,
    duration: isVideo ? Number(gif.duration) || null : null,
    fileSize: null,

    previewUrl: safeMediaUrl(urls.poster) ||
                safeMediaUrl(urls.thumbnail) ||
                (isImage ? mediaUrl : null),

    mediaUrl,
    filename: `${String(gif.id).replace(/[^a-zA-Z0-9_-]/g, "")}.${extension}`,
    sourceUrl: `https://www.redgifs.com/watch/${gif.id}`
  };
}

export async function downloadMediaResponse(rawUrl) {
  let url;
  try { url = new URL(rawUrl); } catch { throw httpError("Invalid media URL.", 400); }
  if (url.protocol !== "https:" || !isAllowedMediaHost(url.hostname)) {
    throw httpError("Download URL is not an approved RedGIFs media host.", 400);
  }

  const response = await fetch(url, {
    headers: {
      "User-Agent": UA,
      "Referer": "https://www.redgifs.com/",
      "Origin": "https://www.redgifs.com"
    },
    signal: AbortSignal.timeout(30000)
  });
  if (!response.ok || !response.body) {
    throw httpError(`The media server refused the download (${response.status}). Fetch the link again and retry.`, 502);
  }
  const nodeBody = Readable.fromWeb(response.body);
  return {
    body: nodeBody,
    contentType: response.headers.get("content-type"),
    contentLength: response.headers.get("content-length")
  };
}
