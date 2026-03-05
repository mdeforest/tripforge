"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Check, Copy, Send, WifiOff } from "lucide-react";
import ReactMarkdown from "react-markdown";

interface Message {
  role: "user" | "model";
  content: string;
}

interface ChatTabProps {
  tripId: string;
  tripName: string;
  destination: string;
}

const SUGGESTED_QUESTIONS = [
  "What should I pack for this trip?",
  "What's the best way to get around?",
  "How can I stay safe while traveling?",
];

export function ChatTab({ tripId, tripName, destination }: ChatTabProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Track online/offline status
  useEffect(() => {
    setIsOffline(!navigator.onLine);

    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Scroll to bottom when messages change (scrollIntoView may be absent in test environments)
  useEffect(() => {
    const el = bottomRef.current;
    if (el && typeof el.scrollIntoView === "function") {
      el.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isStreaming]);

  async function sendMessage(text: string) {
    if (!text.trim() || isStreaming || isOffline) return;

    const userMessage: Message = { role: "user", content: text.trim() };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setInput("");
    setIsStreaming(true);

    // Placeholder for the streaming model reply
    setMessages((prev) => [...prev, { role: "model", content: "" }]);

    abortRef.current = new AbortController();

    try {
      const response = await fetch(`/api/trips/${tripId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextMessages }),
        signal: abortRef.current.signal,
      });

      if (!response.ok || !response.body) {
        throw new Error(`HTTP ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            role: "model",
            content: updated[updated.length - 1].content + chunk,
          };
          return updated;
        });
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") return;
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: "model",
          content: "Sorry, something went wrong. Please try again.",
        };
        return updated;
      });
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
      inputRef.current?.focus();
    }
  }

  async function copyMessage(content: string, index: number) {
    await navigator.clipboard.writeText(content);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }

  const showWelcome = messages.length === 0;

  return (
    <div className="flex flex-col h-[calc(100dvh-212px)] min-h-[400px]">
      {/* Offline banner */}
      {isOffline && (
        <div
          role="alert"
          className="flex items-center gap-2 px-4 py-2 bg-parchment-dark text-ink-mid text-sm border-b border-parchment-deep"
        >
          <WifiOff className="h-4 w-4 shrink-0" aria-hidden="true" />
          You&apos;re offline — chat is unavailable.
        </div>
      )}

      {/* Message list */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {/* Welcome message */}
        {showWelcome && (
          <div className="space-y-4">
            <div className="flex gap-3">
              <div className="shrink-0 w-7 h-7 rounded-full overflow-hidden flex items-center justify-center">
                <Image src="/chatbot.svg" alt="" width={28} height={28} className="object-cover" />
              </div>
              <div className="bg-parchment rounded-2xl rounded-tl-sm px-4 py-3 max-w-[80%]">
                <p className="text-sm text-ink leading-relaxed">
                  Hi! I&apos;m your travel assistant for{" "}
                  <span className="font-medium">{tripName}</span> to{" "}
                  <span className="font-medium">{destination}</span>. I have
                  your full itinerary and can look things up in real time.
                  How can I help?
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-2 pl-10">
              {SUGGESTED_QUESTIONS.map((q) => (
                <button
                  key={q}
                  onClick={() => sendMessage(q)}
                  disabled={isOffline}
                  className="text-left text-sm text-rust border border-rust/30 rounded-xl px-3 py-2 hover:bg-rust/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Conversation */}
        {messages.map((msg, i) => {
          const isUser = msg.role === "user";
          const isLastAndStreaming = i === messages.length - 1 && isStreaming;

          return (
            <div
              key={i}
              className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}
            >
              {!isUser && (
                <div className="shrink-0 w-7 h-7 rounded-full overflow-hidden flex items-center justify-center">
                  <Image src="/chatbot.svg" alt="" width={28} height={28} className="object-cover" />
                </div>
              )}
              <div
                className={[
                  "max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
                  isUser
                    ? "bg-rust text-white rounded-tr-sm whitespace-pre-wrap"
                    : "bg-parchment text-ink rounded-tl-sm prose prose-sm prose-stone max-w-none",
                ].join(" ")}
              >
                {isUser ? (
                  msg.content
                ) : msg.content ? (
                  <ReactMarkdown
                    components={{
                      a: ({ href, children }) => (
                        <a
                          href={href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-rust underline hover:text-rust-dark"
                        >
                          {children}
                        </a>
                      ),
                    }}
                  >
                    {msg.content}
                  </ReactMarkdown>
                ) : isLastAndStreaming ? (
                  <span className="flex gap-1 items-center py-0.5" aria-label="Thinking">
                    <span className="w-1.5 h-1.5 bg-muted rounded-full animate-bounce [animation-delay:0ms]" />
                    <span className="w-1.5 h-1.5 bg-muted rounded-full animate-bounce [animation-delay:150ms]" />
                    <span className="w-1.5 h-1.5 bg-muted rounded-full animate-bounce [animation-delay:300ms]" />
                  </span>
                ) : null}
              </div>
              {!isUser && msg.content && !isLastAndStreaming && (
                <button
                  onClick={() => copyMessage(msg.content, i)}
                  aria-label="Copy message"
                  className="self-end mb-1 p-1 rounded text-muted hover:text-ink-mid transition-colors"
                >
                  {copiedIndex === i ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </button>
              )}
            </div>
          );
        })}

        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div className="shrink-0 border-t border-parchment-dark px-4 py-3 bg-cream">
        <div className="flex gap-2 items-end max-w-2xl mx-auto">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isOffline ? "Offline — chat unavailable" : "Ask anything about your trip…"}
            disabled={isOffline || isStreaming}
            rows={1}
            aria-label="Chat message"
            className="flex-1 resize-none rounded-xl border border-parchment-dark bg-parchment px-3 py-2.5 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-rust/40 disabled:opacity-50 disabled:cursor-not-allowed leading-relaxed max-h-32 overflow-y-auto"
            style={{ height: "auto" }}
            onInput={(e) => {
              const el = e.currentTarget;
              el.style.height = "auto";
              el.style.height = `${el.scrollHeight}px`;
            }}
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || isStreaming || isOffline}
            aria-label="Send message"
            className="shrink-0 w-9 h-9 rounded-xl bg-rust text-white flex items-center justify-center hover:bg-rust-dark transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Send className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}
