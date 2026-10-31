import { useRef, useState } from "react";
import {
  ArrowDownToLine, Check, Clipboard, Clapperboard, ExternalLink,
  Image as ImageIcon, Link2, LoaderCircle, Play, RotateCcw,
  ShieldCheck, Sparkles, X, AlertCircle
} from "lucide-react";

const formatDuration = (seconds) => {
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${String(secs).padStart(2, "0")}`;
};

export default function App() {
  const [url, setUrl] = useState("");
  const [media, setMedia] = useState(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(null);
  const [notice, setNotice] = useState(null);
  const [showVideo, setShowVideo] = useState(false);
  const inputRef = useRef(null);

  const fetchMedia = async (event) => {
    event?.preventDefault();
    if (loading || !url.trim()) return;
    setLoading(true); setNotice(null); setMedia(null); setShowVideo(false);
    try {
      const response = await fetch("/api/fetch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not fetch this media.");
      setMedia(data);
      setNotice({ type: "success", text: "Media information loaded successfully." });
    } catch (error) {
      setNotice({ type: "error", text: error.message || "Something went wrong." });
    } finally { setLoading(false); }
  };

  const pasteLink = async () => {
    try {
      const value = await navigator.clipboard.readText();
      if (value) { setUrl(value); setNotice(null); inputRef.current?.focus(); }
    } catch {
      setNotice({ type: "error", text: "Clipboard access is blocked. Paste the link using Ctrl + V." });
    }
  };

  const download = () => {
    if (!media || downloading) return;
    setDownloading(true);
    setNotice(null);

    try {
      // Let the browser download the streamed response directly. This avoids
      // buffering the entire video in JavaScript memory before saving it.
      const params = new URLSearchParams({ url: media.mediaUrl, filename: media.filename });
      const anchor = document.createElement("a");
      anchor.href = `/api/download?${params.toString()}`;
      anchor.style.display = "none";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();

      setNotice({ type: "success", text: "Download started in your browser. The transfer will continue in the browser's download manager." });
    } catch (error) {
      setNotice({ type: "error", text: error.message || "Download failed. Fetch the link again and retry." });
    } finally {
      setDownloading(false);
      setDownloadProgress(null);
    }
  };

  const clear = () => {
    setUrl(""); setMedia(null); setNotice(null); setShowVideo(false);
    inputRef.current?.focus();
  };

  return (
    <div className="min-h-screen bg-[#0d0d0f] text-white">
      <header className="border-b border-white/[0.07]">
        <div className="mx-auto flex h-[76px] max-w-6xl items-center justify-between px-5 sm:px-8">
          <a href="#" className="flex items-center gap-3">
            <span className="brand-mark"><Clapperboard size={20} /></span>
            <span className="text-[15px] font-semibold tracking-tight">RedGIFs <span className="text-zinc-500">Downloader</span></span>
          </a>
          <nav className="hidden items-center gap-8 text-sm text-zinc-400 sm:flex">
            <a className="transition hover:text-white" href="#home">Home</a>
            <a className="transition hover:text-white" href="#about">About</a>
            <a className="transition hover:text-white" href="#how">How it works</a>
          </nav>
          <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-zinc-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Ready to fetch
          </div>
        </div>
      </header>

      <main id="home" className="mx-auto max-w-6xl px-5 pb-24 pt-16 sm:px-8 sm:pt-24">
        <section className="mx-auto max-w-3xl text-center">
          <div className="eyebrow mx-auto mb-6 w-fit"><Sparkles size={13} /> SIMPLE. FAST. PRIVATE.</div>
          <h1 className="text-4xl font-semibold leading-[1.12] tracking-[-0.045em] sm:text-6xl">
            Download RedGIFs
            <span className="block text-gradient">Videos & Images</span>
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-[15px] leading-7 text-zinc-400 sm:text-base">
            Paste a RedGIFs link and preview your media before downloading it in seconds.
          </p>

          <form onSubmit={fetchMedia} className="input-shell mx-auto mt-10 max-w-2xl">
            <Link2 size={19} className="ml-4 shrink-0 text-zinc-500" />
            <input
              ref={inputRef}
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Paste your RedGIFs video or image URL here..."
              aria-label="RedGIFs URL"
              type="url"
              required
              className="min-w-0 flex-1 bg-transparent px-3 py-5 text-sm text-white outline-none placeholder:text-zinc-600"
            />
            <button type="button" onClick={pasteLink} className="paste-btn" title="Paste from clipboard" aria-label="Paste from clipboard">
              <Clipboard size={17} />
            </button>
            <button disabled={loading || !url.trim()} className="fetch-btn" type="submit">
              {loading ? <><LoaderCircle size={17} className="animate-spin" /> Fetching</> : <>Fetch media <ArrowDownToLine size={16} /></>}
            </button>
          </form>

          <div className="mt-4 flex items-center justify-center gap-2 text-xs text-zinc-600">
            <ShieldCheck size={14} /> No account required · Only public, accessible media
          </div>
        </section>

        {notice && (
          <div className={`notice mx-auto mt-8 max-w-2xl ${notice.type}`}>
            {notice.type === "success" ? <Check size={17} /> : <AlertCircle size={17} />}
            <span>{notice.text}</span>
            <button onClick={() => setNotice(null)} className="ml-auto text-current opacity-60 hover:opacity-100" aria-label="Dismiss"><X size={16} /></button>
          </div>
        )}

        {loading && (
          <div className="mx-auto mt-12 flex max-w-2xl items-center justify-center gap-3 rounded-2xl border border-white/[0.07] bg-[#151518] p-10 text-sm text-zinc-400">
            <LoaderCircle className="animate-spin text-violet-400" size={20} /> Looking up your media...
          </div>
        )}

        {media && !loading && (
          <section className="mx-auto mt-12 max-w-4xl animate-in">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="section-kicker">YOUR MEDIA</p>
                <h2 className="mt-1 text-lg font-semibold">Preview & download</h2>
              </div>
              <button onClick={clear} className="clear-btn"><RotateCcw size={14} /> Clear</button>
            </div>
            <div className="media-card">
              <div className="preview-wrap">
                {media.type === "Image" ? (
                  <img src={media.previewUrl || media.mediaUrl} alt={media.title} className="media-preview" />
                ) : showVideo ? (
                  <video src={media.mediaUrl} poster={media.previewUrl || undefined} controls autoPlay playsInline className="media-preview" />
                ) : (
                  <button className="poster-button" onClick={() => setShowVideo(true)} aria-label="Play video preview">
                    {media.previewUrl ? <img src={media.previewUrl} alt="" className="media-preview" /> : <div className="poster-fallback"><Clapperboard size={42} /></div>}
                    <span className="play-button"><Play size={22} fill="currentColor" /></span>
                    {formatDuration(media.duration) && <span className="duration">{formatDuration(media.duration)}</span>}
                  </button>
                )}
              </div>
              <div className="media-details">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="type-pill">{media.type === "Image" ? <ImageIcon size={13} /> : <Clapperboard size={13} />}{media.type}</span>
                    <span className="text-xs text-zinc-600">#{media.id}</span>
                  </div>
                  <h3 className="mt-4 break-words text-xl font-semibold tracking-tight">{media.title || "RedGIFs media"}</h3>
                  <p className="mt-2 text-sm text-zinc-500">Ready to save to your device.</p>
                </div>
                <div className="mt-8 grid grid-cols-2 gap-3">
                  <Info label="FORMAT" value={media.format || "Original"} />
                  <Info label="RESOLUTION" value={media.width && media.height ? `${media.width} × ${media.height}` : "Not available"} />
                  {media.duration > 0 && <Info label="DURATION" value={formatDuration(media.duration)} />}
                  <Info label="FILE SIZE" value={media.fileSize || "Not provided"} />
                </div>
                <button onClick={download} disabled={downloading} className="download-btn mt-8">
                  {downloading ? <><LoaderCircle size={18} className="animate-spin" /> {downloadProgress === null ? "Preparing download..." : `Downloading ${downloadProgress}%`}</> : <><ArrowDownToLine size={19} /> Download {media.type}</>}
                </button>
                <p className="mt-3 text-center text-[11px] text-zinc-600">Original available quality · Downloaded through secure server proxy</p>
              </div>
            </div>
          </section>
        )}

        {!media && !loading && (
          <section className="mx-auto mt-20 max-w-3xl">
            <div className="mb-7 text-center">
              <p className="section-kicker">THREE SIMPLE STEPS</p>
              <h2 className="mt-2 text-xl font-semibold tracking-tight">How it works</h2>
            </div>
            <div id="how" className="grid gap-3 sm:grid-cols-3">
              <Step number="01" icon={<Link2 size={18} />} title="Paste a link" text="Copy a public RedGIFs URL and paste it into the input above." />
              <Step number="02" icon={<Play size={18} />} title="Preview media" text="Fetch the available media details and check the preview." />
              <Step number="03" icon={<ArrowDownToLine size={18} />} title="Download" text="Save the available original-quality file to your device." />
            </div>
          </section>
        )}

        <section id="about" className="mx-auto mt-20 max-w-2xl text-center">
          <p className="section-kicker">ABOUT THIS TOOL</p>
          <p className="mt-3 text-sm leading-7 text-zinc-500">
            A lightweight utility for saving publicly accessible RedGIFs media when you have permission to download it.
            This tool does not bypass logins, age checks, private content, DRM, or other access restrictions.
          </p>
        </section>
      </main>

      <footer className="border-t border-white/[0.06] px-5 py-7 text-center text-xs text-zinc-600">
        Use responsibly. Respect creators’ rights and RedGIFs’ terms.
      </footer>
    </div>
  );
}

function Info({ label, value }) {
  return <div className="info-box"><p>{label}</p><span>{value}</span></div>;
}
function Step({ number, icon, title, text }) {
  return (
    <div className="step-card">
      <div className="flex items-center justify-between text-violet-300"><span className="step-icon">{icon}</span><span className="text-xs font-medium tracking-widest text-zinc-600">{number}</span></div>
      <h3 className="mt-5 text-sm font-semibold">{title}</h3>
      <p className="mt-2 text-xs leading-6 text-zinc-500">{text}</p>
    </div>
  );
}
