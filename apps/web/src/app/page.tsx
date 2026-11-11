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
  transcriptionStatus: string;
  transcriptionError: string | null;
  createdAt: string;
};

type Transcript = {
  language: string | null;
  text: string;
  segments: Array<{ id: string; startSeconds: number; endSeconds: number; text: string }>;
};

type TranscriptResult = {
  status: string;
  error: string | null;
  transcript: Transcript | null;
};

type ClipSuggestion = {
  id: string;
  title: string;
  startSeconds: number;
  endSeconds: number;
  score: number;
  reason: string;
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

function formatTimestamp(seconds: number) {
  const mins = Math.floor(seconds / 60);
  const secs = (seconds % 60).toFixed(1).padStart(4, "0");
  return `${mins}:${secs}`;
}

function statusLabel(status: string) {
  return status.replaceAll("_", " ");
}

export default function Home() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [videos, setVideos] = useState<Video[]>([]);
  const [transcripts, setTranscripts] = useState<Record<string, TranscriptResult>>({});
  const [clipSuggestions, setClipSuggestions] = useState<Record<string, ClipSuggestion[]>>({});
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [workingVideoId, setWorkingVideoId] = useState("");
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

  useEffect(() => {
    if (!videos.some((video) => ["queued", "processing"].includes(video.transcriptionStatus))) return;
    const timer = window.setInterval(() => void loadVideos(), 3000);
    return () => window.clearInterval(timer);
  }, [videos, loadVideos]);

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
      const response = await fetch(`${API_URL}/videos/upload`, { method: "POST", body });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message ?? "Upload failed. Please try again.");
      setNotice(`${file.name} uploaded and saved to your library.`);
      await loadVideos();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  async function transcribe(video: Video) {
    setWorkingVideoId(video.id);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`${API_URL}/videos/${video.id}/transcribe`, { method: "POST" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message = Array.isArray(data.message) ? data.message.join(" ") : data.message;
        throw new Error(message ?? "Could not queue transcription.");
      }
      setNotice(data.message ?? "Transcription queued.");
      await loadVideos();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not queue transcription.");
    } finally {
      setWorkingVideoId("");
    }
  }

  async function discoverClips(video: Video) {
    setWorkingVideoId(video.id);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`${API_URL}/videos/${video.id}/clips/discover`, { method: "POST" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message = Array.isArray(data.message) ? data.message.join(" ") : data.message;
        throw new Error(message ?? "Could not discover clips.");
      }
      setClipSuggestions((current) => ({ ...current, [video.id]: data.clips ?? [] }));
      setNotice(data.message ?? "Clip suggestions generated.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not discover clips.");
    } finally {
      setWorkingVideoId("");
    }
  }

  async function viewTranscript(video: Video) {
    setWorkingVideoId(video.id);
    setError("");
    try {
      const response = await fetch(`${API_URL}/videos/${video.id}/transcript`, { cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message ?? "Could not load transcript.");
      setTranscripts((current) => ({ ...current, [video.id]: data }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load transcript.");
    } finally {
      setWorkingVideoId("");
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
                Upload a recording, generate a transcript, and keep every timestamp in your ClipForge library.
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

        {error && <div role="alert" className="mb-5 rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-200">{error}</div>}
        {notice && <div role="status" className="mb-5 rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200">{notice}</div>}

        <section className="rounded-2xl border border-white/10 bg-white/[0.025]">
          <div className="flex items-center justify-between border-b border-white/10 px-5 py-5 sm:px-7">
            <div>
              <h2 className="text-lg font-semibold">Your videos</h2>
              <p className="mt-1 text-sm text-zinc-500">Upload, transcribe and review your video library</p>
            </div>
            <button type="button" onClick={() => void loadVideos()} className="rounded-lg border border-white/10 px-3 py-2 text-xs text-zinc-300 transition hover:bg-white/5">
              Refresh
            </button>
          </div>

          {loading ? (
            <div className="px-7 py-16 text-center text-sm text-zinc-500">Loading your library…</div>
          ) : videos.length === 0 ? (
            <div className="px-6 py-16 text-center sm:py-20">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-2xl">▶</div>
              <h3 className="mt-5 text-base font-medium">Your library is ready</h3>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-zinc-500">No videos yet. Upload your first recording to get started.</p>
              <button type="button" onClick={() => inputRef.current?.click()} disabled={uploading} className="mt-6 rounded-lg border border-violet-400/30 px-4 py-2.5 text-sm font-medium text-violet-200 transition hover:bg-violet-400/10 disabled:opacity-50">Choose a video</button>
            </div>
          ) : (
            <div className="divide-y divide-white/[0.07]">
              {videos.map((video) => {
                const transcriptData = transcripts[video.id];
                const isBusy = workingVideoId === video.id;
                const canTranscribe = ["not_started", "failed"].includes(video.transcriptionStatus);
                return (
                  <article key={video.id} className="px-5 py-5 sm:px-7">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                      <div className="flex min-w-0 items-center gap-4">
                        <div className="flex h-12 w-16 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-gradient-to-br from-violet-500/20 to-indigo-500/10 text-lg text-violet-200">▶</div>
                        <div className="min-w-0">
                          <h3 className="truncate text-sm font-medium text-zinc-100">{video.originalName}</h3>
                          <p className="mt-1 text-xs text-zinc-500">{formatDuration(video.durationSeconds)} · {video.width && video.height ? `${video.width} × ${video.height}` : "Resolution unknown"} · {formatBytes(video.size)}</p>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 pl-20 lg:pl-0">
                        <span className="rounded-full border border-white/10 px-2.5 py-1 text-[11px] text-zinc-400">Upload: {statusLabel(video.status)}</span>
                        <span className="rounded-full border border-violet-400/20 bg-violet-400/10 px-2.5 py-1 text-[11px] font-medium text-violet-200">Transcript: {statusLabel(video.transcriptionStatus)}</span>
                        {canTranscribe && (
                          <button type="button" disabled={isBusy} onClick={() => void transcribe(video)} className="rounded-lg bg-violet-500 px-3 py-2 text-xs font-semibold text-white transition hover:bg-violet-400 disabled:opacity-50">
                            {isBusy ? "Working…" : video.transcriptionStatus === "failed" ? "Retry transcription" : "Transcribe"}
                          </button>
                        )}
                        {["queued", "processing"].includes(video.transcriptionStatus) && <span className="text-xs text-amber-300">Transcription in progress…</span>}
                        {video.transcriptionStatus === "completed" && (
                          <>
                            <button type="button" disabled={isBusy} onClick={() => void viewTranscript(video)} className="rounded-lg border border-white/15 px-3 py-2 text-xs text-zinc-200 transition hover:bg-white/5 disabled:opacity-50">
                              {isBusy ? "Loading…" : "View transcript"}
                            </button>
                            <button type="button" disabled={isBusy} onClick={() => void discoverClips(video)} className="rounded-lg bg-fuchsia-500/90 px-3 py-2 text-xs font-semibold text-white transition hover:bg-fuchsia-400 disabled:opacity-50">
                              {isBusy ? "Finding moments…" : "✦ Find clips"}
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {video.transcriptionError && <p className="mt-3 rounded-lg border border-red-400/15 bg-red-400/[0.06] px-3 py-2 text-xs text-red-200">{video.transcriptionError}</p>}

                    {clipSuggestions[video.id]?.length > 0 && (
                      <div className="mt-4 rounded-xl border border-fuchsia-400/20 bg-fuchsia-400/[0.04] p-4">
                        <div className="mb-3 flex items-center justify-between">
                          <h4 className="text-xs font-semibold uppercase tracking-wider text-fuchsia-200">Suggested clips</h4>
                          <span className="text-xs text-zinc-500">{clipSuggestions[video.id].length} moments · ranked</span>
                        </div>
                        <div className="grid gap-3 md:grid-cols-2">
                          {clipSuggestions[video.id].map((clip, index) => (
                            <div key={clip.id} className="rounded-lg border border-white/10 bg-black/30 p-3">
                              <div className="flex items-start justify-between gap-3">
                                <span className="text-xs font-semibold text-zinc-100">{index + 1}. {clip.title}</span>
                                <span className="shrink-0 rounded-full bg-fuchsia-400/10 px-2 py-1 text-[10px] font-semibold text-fuchsia-200">{clip.score}/100</span>
                              </div>
                              <p className="mt-2 font-mono text-[11px] text-violet-300">{formatTimestamp(clip.startSeconds)} – {formatTimestamp(clip.endSeconds)} · {formatDuration(clip.endSeconds - clip.startSeconds)}</p>
                              <p className="mt-2 text-xs leading-5 text-zinc-400">{clip.reason}</p>
                            </div>
                          ))}
                        </div>
                        <p className="mt-3 text-[11px] text-zinc-600">Suggestions are transcript-based heuristics, not guaranteed engagement predictions.</p>
                      </div>
                    )}

                    {transcriptData?.transcript && (
                      <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-4">
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <h4 className="text-xs font-semibold uppercase tracking-wider text-violet-200">Transcript</h4>
                          <span className="text-xs text-zinc-500">Language: {transcriptData.transcript.language ?? "Unknown"}</span>
                        </div>
                        <p className="whitespace-pre-wrap text-sm leading-7 text-zinc-200">{transcriptData.transcript.text}</p>
                        <div className="mt-4 space-y-2 border-t border-white/10 pt-3">
                          {transcriptData.transcript.segments.map((segment) => (
                            <div key={segment.id} className="grid grid-cols-[90px_1fr] gap-3 text-xs leading-6">
                              <span className="font-mono text-violet-300">{formatTimestamp(segment.startSeconds)}–{formatTimestamp(segment.endSeconds)}</span>
                              <span className="text-zinc-400">{segment.text}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <footer className="flex flex-col gap-2 py-8 text-xs text-zinc-600 sm:flex-row sm:justify-between">
          <span>ClipForge · Creator workspace</span>
          <span>AI-powered clip discovery · More editing tools coming next.</span>
        </footer>
      </div>
    </main>
  );
}
