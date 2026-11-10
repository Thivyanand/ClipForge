"use client";

import { ChangeEvent, useCallback, useEffect, useRef, useState } from "react";

type Video = {
  id: string;
  originalName: string;
  size: number;
  durationSeconds: number;
  width: number | null;
  height: number | null;
  codec: string | null;
  status: string;
  createdAt: string;
};

const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1").replace(/\/$/, "");

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDuration(seconds: number) {
  if (!Number.isFinite(seconds)) return "—";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return mins ? `${mins}m ${secs}s` : `${secs}s`;
}

export default function Home() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadVideos = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/videos`, { cache: "no-store" });
      if (!response.ok) throw new Error("Could not load your video library.");
      const data = await response.json();
      setVideos(data.videos ?? []);
      setError("");
    } catch {
      setError("Can't reach the ClipForge API. Make sure the API and PostgreSQL are running.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadVideos();
  }, [loadVideos]);

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    const extension = file.name.split(".").pop()?.toLowerCase();
    if (!["mp4", "mov", "webm"].includes(extension ?? "")) {
      setError("Choose an MP4, MOV or WebM video.");
      return;
    }
    if (file.size > 500 * 1024 * 1024) {
      setError("This file is larger than the 500 MB upload limit.");
      return;
    }

    setUploading(true);
    setError("");
    setNotice("");
    const body = new FormData();
    body.append("file", file);

    try {
      const response = await fetch(`${API_URL}/videos/upload`, {
        method: "POST",
        body,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.message ?? "Upload failed. Please try again.");
      }
      setNotice(`${file.name} uploaded and saved to your library.`);
      await loadVideos();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#09090b] text-zinc-100">
      <div className="mx-auto max-w-7xl px-5 py-7 sm:px-8">
        <header className="flex items-center justify-between border-b border-white/10 pb-6">
          <a href="/" className="text-xl font-semibold tracking-tight">
            clip<span className="text-violet-400">forge</span>
          </a>
          <div className="flex items-center gap-2 rounded-full border border-white/10 px-3 py-1.5 text-xs text-zinc-400">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            Creator workspace
          </div>
        </header>

        <section className="py-12 sm:py-16">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-violet-300">Your workspace</p>
          <div className="mt-3 flex flex-col justify-between gap-7 lg:flex-row lg:items-end">
            <div>
              <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">Make more from every video.</h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-zinc-400">
                Upload a recording to start building your library. ClipForge checks the media and saves its details for your next editing session.
              </p>
            </div>
            <div className="flex shrink-0 flex-col gap-2">
              <input
                ref={inputRef}
                type="file"
                accept=".mp4,.mov,.webm,video/mp4,video/quicktime,video/webm"
                className="hidden"
                onChange={handleFileChange}
              />
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                disabled={uploading}
                className="rounded-xl bg-violet-500 px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-violet-950/40 transition hover:bg-violet-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {uploading ? "Uploading video…" : "＋ Upload a video"}
              </button>
              <span className="text-center text-xs text-zinc-500">MP4, MOV or WebM · Up to 500 MB</span>
            </div>
          </div>
        </section>

        {error && (
          <div role="alert" className="mb-5 rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        )}
        {notice && (
          <div role="status" className="mb-5 rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200">
            {notice}
          </div>
        )}

        <section className="rounded-2xl border border-white/10 bg-white/[0.025]">
          <div className="flex items-center justify-between border-b border-white/10 px-5 py-5 sm:px-7">
            <div>
              <h2 className="text-lg font-semibold">Your videos</h2>
              <p className="mt-1 text-sm text-zinc-500">Uploads saved in your ClipForge library</p>
            </div>
            <button
              type="button"
              onClick={() => void loadVideos()}
              className="rounded-lg border border-white/10 px-3 py-2 text-xs text-zinc-300 transition hover:bg-white/5"
            >
              Refresh
            </button>
          </div>

          {loading ? (
            <div className="px-7 py-16 text-center text-sm text-zinc-500">Loading your library…</div>
          ) : videos.length === 0 ? (
            <div className="px-6 py-16 text-center sm:py-20">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-2xl">▶</div>
              <h3 className="mt-5 text-base font-medium">Your library is ready</h3>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-zinc-500">
                No videos yet. Upload your first recording and it will appear here with its duration, resolution and file details.
              </p>
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                disabled={uploading}
                className="mt-6 rounded-lg border border-violet-400/30 px-4 py-2.5 text-sm font-medium text-violet-200 transition hover:bg-violet-400/10 disabled:opacity-50"
              >
                Choose a video
              </button>
            </div>
          ) : (
            <div className="divide-y divide-white/[0.07]">
              {videos.map((video) => (
                <article key={video.id} className="flex flex-col gap-3 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-7">
                  <div className="flex min-w-0 items-center gap-4">
                    <div className="flex h-12 w-16 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-gradient-to-br from-violet-500/20 to-indigo-500/10 text-lg text-violet-200">▶</div>
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-medium text-zinc-100">{video.originalName}</h3>
                      <p className="mt-1 text-xs text-zinc-500">
                        {formatDuration(video.durationSeconds)} · {video.width && video.height ? `${video.width} × ${video.height}` : "Resolution unknown"} · {formatBytes(video.size)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 pl-20 sm:pl-0">
                    <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-[11px] font-medium text-emerald-300">{video.status}</span>
                    <span className="text-xs text-zinc-600">{new Date(video.createdAt).toLocaleDateString()}</span>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <footer className="flex flex-col gap-2 py-8 text-xs text-zinc-600 sm:flex-row sm:justify-between">
          <span>ClipForge · Creator workspace</span>
          <span>AI clip discovery and editing tools are coming next.</span>
        </footer>
      </div>
    </main>
  );
}
