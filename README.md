# RedGIFs Downloader

React + Tailwind frontend with an Express backend. The backend retrieves RedGIFs metadata and proxies downloads so temporary API credentials and CDN requests are not exposed to browser code.

## Important API limitation

RedGIFs does not publish a stable, documented public API for third-party downloaders. This project uses the currently observed `api.redgifs.com/v2/auth/temporary` and `/v2/gifs/{id}` flow, consistent with public integrations such as yt-dlp. These endpoints are undocumented and may change. The single-item v2 route is primarily documented by community libraries for GIF/video objects; image support is limited to direct RedGIFs-owned CDN image URLs or metadata that explicitly identifies an image. It does not invent image URLs or fall back to mock media.

This tool does not bypass authentication, age checks, private media, DRM, or access restrictions. Use only media you are permitted to download and comply with RedGIFs' terms and creator rights.

## Requirements

- Node.js 20+ recommended (uses built-in `fetch`, `AbortSignal.timeout`, and `Readable.fromWeb`)
- npm

## Run locally

```bash
npm install
cp .env.example .env
npm run dev
```

Frontend: http://localhost:5173  
Backend health check: http://localhost:4000/api/health

## Production

```bash
npm run build
npm start
```

Set `CLIENT_ORIGIN` to the deployed frontend origin if frontend and API are hosted separately. If they are hosted together, the Express server serves the Vite `dist` build.

## Supported inputs

- `https://www.redgifs.com/watch/{id}`
- `https://www.redgifs.com/ifr/{id}`
- Direct HTTPS media files on `media.redgifs.com`, `thumbs2.redgifs.com`, or `thumbs3.redgifs.com` ending in mp4, webm, jpg, jpeg, png, or webp.

## Security notes

- The API accepts only RedGIFs page URLs and an explicit allowlist of RedGIFs CDN hosts, mitigating arbitrary-URL proxy/SSRF abuse.
- The download endpoint validates the destination host again.
- Temporary tokens are held only in server memory for each request and are never returned to the client.
- Add rate limiting, request logging controls, deployment-level abuse protection, and HTTPS before exposing a public instance.
- The browser fetches the proxied file as a Blob so the UI can report success only after a non-empty response. This does not display byte-level progress; streaming progress would require a separate streaming download UX.

## Testing checklist

- Valid video URL: verify metadata, thumbnail, and MP4 download against a currently public RedGIFs post.
- Direct image URL: verify image preview and original file download from an allowed RedGIFs CDN URL.
- Invalid URL: must return a validation error.
- Unavailable/deleted ID: API 404 or missing media must show an error.
- Expired token: backend retries once after a 401 by requesting a fresh temporary token.

Live RedGIFs integration tests require network access and a currently available public URL. They are not represented as passed by this scaffold.
