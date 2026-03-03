"use client";

import { useState, useRef, useEffect } from "react";
import { FileText, Link as LinkIcon, AlignLeft, Upload, Loader2 } from "lucide-react";
import type { ParsedItinerary } from "@/types/itinerary";

type TabId = "text" | "file" | "url";

interface UploadFormProps {
  onParsed: (data: { parsedData: ParsedItinerary; rawText: string }) => void;
}

const TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: "text", label: "Paste text", icon: AlignLeft },
  { id: "file", label: "Upload file", icon: FileText },
  { id: "url", label: "Google Docs", icon: LinkIcon },
];

const STAGES = [
  { label: "Uploading your itinerary",              threshold: 0 },
  { label: "Reading the document",                  threshold: 2_000 },
  { label: "Identifying days and stops",            threshold: 5_000 },
  { label: "Structuring your itinerary",            threshold: 10_000 },
  { label: "Building your day-by-day plan",         threshold: 16_000 },
  { label: "Looking up addresses and locations",    threshold: 22_000 },
  { label: "Pinning stops to the map",              threshold: 30_000 },
  { label: "Almost ready to explore",               threshold: 42_000 },
];

/**
 * Upload form for creating a new trip.
 * Supports three input modes: paste text, upload file (PDF/DOCX/TXT), Google Docs URL.
 * On submit, POSTs to /api/trips/parse and calls onParsed with the result.
 */
export function UploadForm({ onParsed }: UploadFormProps) {
  const [activeTab, setActiveTab] = useState<TabId>("text");
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingStage, setLoadingStage] = useState(0);
  const [displayedStage, setDisplayedStage] = useState(0);
  const [fadeIn, setFadeIn] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const startTimeRef = useRef<number>(0);

  // Advance the active stage on a timer while loading
  useEffect(() => {
    if (!loading) {
      setLoadingStage(0);
      setDisplayedStage(0);
      setFadeIn(true);
      return;
    }

    startTimeRef.current = Date.now();

    const interval = setInterval(() => {
      const ms = Date.now() - startTimeRef.current;
      const stage = STAGES.reduce((acc, s, i) => (ms >= s.threshold ? i : acc), 0);
      setLoadingStage(stage);
    }, 500);

    return () => clearInterval(interval);
  }, [loading]);

  // Fade out → swap text → fade in when the stage changes
  useEffect(() => {
    if (loadingStage === displayedStage) return;
    setFadeIn(false);
    const t = setTimeout(() => {
      setDisplayedStage(loadingStage);
      setFadeIn(true);
    }, 250);
    return () => clearTimeout(t);
  }, [loadingStage, displayedStage]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const formData = new FormData();
      if (activeTab === "text") formData.set("text", text);
      if (activeTab === "file" && file) formData.set("file", file);
      if (activeTab === "url") formData.set("googleDocsUrl", url);

      const res = await fetch("/api/trips/parse", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
        return;
      }

      onParsed({ parsedData: data.parsedData, rawText: data.rawText });
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setFile(e.target.files?.[0] ?? null);
    setError(null);
  }

  const canSubmit =
    (activeTab === "text" && text.trim().length > 0) ||
    (activeTab === "file" && file !== null) ||
    (activeTab === "url" && url.trim().length > 0);

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-6">
      {/* Tab selector — always visible; disabled while loading */}
      <div className="flex gap-1 rounded-xl bg-parchment p-1">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={activeTab === id}
            disabled={loading}
            onClick={() => { setActiveTab(id); setError(null); }}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-40 ${
              activeTab === id
                ? "bg-cream text-ink shadow-sm"
                : "text-muted hover:text-ink-mid"
            }`}
          >
            <Icon className="h-3.5 w-3.5" aria-hidden="true" />
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        /* ── Loading panel ────────────────────────────────────────────────── */
        <div
          role="status"
          aria-label="Parsing itinerary"
          className="flex flex-col items-center gap-5 rounded-xl border border-parchment-deep bg-cream px-6 py-12 text-center"
        >
          <Loader2 className="h-10 w-10 animate-spin text-rust" aria-hidden="true" />

          <p className={`text-base font-semibold text-ink transition-opacity duration-300 ${fadeIn ? "opacity-100" : "opacity-0"}`}>
            {STAGES[displayedStage].label}&hellip;
          </p>

          {loadingStage >= 5 && (
            <p className="max-w-xs text-xs text-muted">
              Long itineraries can take a couple minutes. Hang tight!
            </p>
          )}
        </div>
      ) : (
        /* ── Tab panels ───────────────────────────────────────────────────── */
        <>
          {activeTab === "text" && (
            <div>
              <label htmlFor="itinerary-text" className="sr-only">Itinerary text</label>
              <textarea
                id="itinerary-text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Paste your itinerary here — any format works (plain text, copied from a doc, email, etc.)"
                rows={10}
                className="w-full rounded-xl border border-parchment-deep bg-cream px-4 py-3 text-sm text-ink placeholder:text-muted focus:border-rust focus:outline-none focus:ring-1 focus:ring-rust resize-none"
              />
            </div>
          )}

          {activeTab === "file" && (
            <div>
              <input
                ref={fileInputRef}
                id="itinerary-file"
                type="file"
                accept=".pdf,.docx,.txt"
                onChange={handleFileChange}
                className="sr-only"
                aria-label="Upload itinerary file"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex w-full flex-col items-center gap-3 rounded-xl border-2 border-dashed border-parchment-deep bg-cream px-6 py-10 text-center transition-colors hover:border-rust hover:bg-parchment"
              >
                <Upload className="h-8 w-8 text-muted" aria-hidden="true" />
                {file ? (
                  <div>
                    <p className="text-sm font-medium text-ink">{file.name}</p>
                    <p className="mt-0.5 text-xs text-muted">Click to change file</p>
                  </div>
                ) : (
                  <div>
                    <p className="text-sm font-medium text-ink">Click to upload a file</p>
                    <p className="mt-0.5 text-xs text-muted">PDF, Word (.docx), or plain text · Max 10 MB</p>
                  </div>
                )}
              </button>
            </div>
          )}

          {activeTab === "url" && (
            <div className="space-y-1">
              <label htmlFor="google-docs-url" className="block text-sm font-medium text-ink">
                Google Docs URL
              </label>
              <input
                id="google-docs-url"
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://docs.google.com/document/d/..."
                className="w-full rounded-xl border border-parchment-deep bg-cream px-4 py-2.5 text-sm text-ink placeholder:text-muted focus:border-rust focus:outline-none focus:ring-1 focus:ring-rust"
              />
              <p className="text-xs text-muted">
                The doc must be set to &ldquo;Anyone with the link&rdquo; can view.
              </p>
            </div>
          )}

          {/* Error */}
          {error && (
            <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </p>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={!canSubmit}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-rust px-4 py-2.5 text-sm font-semibold text-cream transition-colors hover:bg-rust-dark disabled:cursor-not-allowed disabled:opacity-60"
          >
            Parse itinerary
          </button>
        </>
      )}
    </form>
  );
}
