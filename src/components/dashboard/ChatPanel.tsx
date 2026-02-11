"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Sparkles,
  Send,
  Loader2,
  WifiOff,
  ArrowRight,
  Filter,
} from "lucide-react";

interface AiAction {
  navigate?: string;
  filters?: Record<string, string>;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  actions?: AiAction | null;
}

interface ChatPanelProps {
  show: boolean;
  onSend: (message: string) => Promise<{
    response: string;
    actions?: AiAction | null;
    suggestions?: string[];
  }>;
  aiAvailable: boolean;
  onAiAction?: (action: AiAction) => void;
}

export function ChatPanel({
  show,
  onSend,
  aiAvailable,
  onAiAction,
}: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([
    "What is the overall loss ratio?",
    "Which dealer has the most claims?",
    "Show me claims by vehicle make",
    "What are the top part failures?",
  ]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const handleSubmit = async (text?: string) => {
    const msg = text || input.trim();
    if (!msg || loading) return;

    setInput("");
    const userMsg: ChatMessage = { role: "user", content: msg };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      const result = await onSend(msg);
      const assistantMsg: ChatMessage = {
        role: "assistant",
        content: result.response,
        actions: result.actions,
      };
      setMessages((prev) => [...prev, assistantMsg]);
      if (result.suggestions && result.suggestions.length > 0) {
        setSuggestions(result.suggestions);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "⚠️ Failed to get a response. Please try again.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = (action: AiAction) => {
    if (onAiAction) onAiAction(action);
  };

  if (!show) return null;

  return (
    <aside className="w-80 bg-card border-l border-border flex flex-col shrink-0 shadow-lg">
      {/* Header */}
      <div className="p-3 border-b border-border flex items-center gap-2">
        <Sparkles size={16} className="text-primary" />
        <span className="text-sm font-bold text-foreground">Clarity AI</span>
        <div
          className={`ml-auto w-2 h-2 rounded-full ${aiAvailable ? "bg-green-500" : "bg-red-400"}`}
        />
        <span className="text-[9px] text-muted-foreground">
          {aiAvailable ? "Online" : "Offline"}
        </span>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-3 space-y-3 scrollbar-thin scrollbar-thumb-muted-foreground/20"
      >
        {messages.length === 0 && (
          <div className="text-center py-8">
            <Sparkles size={32} className="mx-auto text-primary/30 mb-3" />
            <p className="text-xs text-muted-foreground mb-4">
              Ask me about your data
            </p>
            <div className="space-y-2">
              {suggestions.map((s, i) => (
                <button
                  key={i}
                  onClick={() => handleSubmit(s)}
                  className="w-full text-left text-[11px] p-2 bg-muted/30 hover:bg-muted/60 border border-border rounded-lg text-foreground transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[90%] rounded-xl px-3 py-2 text-xs leading-relaxed ${
                msg.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted/50 text-foreground border border-border"
              }`}
            >
              <div className="whitespace-pre-wrap">
                {msg.content
                  .split(/(\*\*.*?\*\*)/g)
                  .map((part, index) =>
                    part.startsWith("**") && part.endsWith("**") ? (
                      <strong key={index}>{part.slice(2, -2)}</strong>
                    ) : (
                      part
                    ),
                  )}
              </div>

              {/* AI Action Buttons */}
              {msg.role === "assistant" && msg.actions && (
                <div className="mt-2 pt-2 border-t border-border/50 space-y-1.5">
                  {msg.actions.navigate && (
                    <button
                      onClick={() => handleAction(msg.actions!)}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg text-[10px] font-semibold transition-colors"
                    >
                      <ArrowRight size={10} />
                      View in{" "}
                      {msg.actions.navigate.charAt(0).toUpperCase() +
                        msg.actions.navigate.slice(1)}
                    </button>
                  )}
                  {msg.actions.filters &&
                    Object.keys(msg.actions.filters).length > 0 && (
                      <button
                        onClick={() => handleAction(msg.actions!)}
                        className="w-full flex items-center gap-2 px-2.5 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 rounded-lg text-[10px] font-semibold transition-colors"
                      >
                        <Filter size={10} />
                        Apply filters:{" "}
                        {Object.values(msg.actions.filters).join(", ")}
                      </button>
                    )}
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-muted/50 border border-border rounded-xl px-3 py-2">
              <Loader2 size={14} className="animate-spin text-primary" />
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="p-3 border-t border-border">
        {!aiAvailable && (
          <div className="flex items-center gap-2 text-[10px] text-amber-600 bg-amber-500/10 px-2 py-1 rounded-lg mb-2">
            <WifiOff size={10} />
            <span>Set GEMINI_API_KEY in .env</span>
          </div>
        )}
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            placeholder="Ask about your data..."
            className="flex-1 px-3 py-2 text-xs bg-muted/30 border border-border rounded-lg outline-none focus:border-primary/50 transition-colors"
          />
          <button
            onClick={() => handleSubmit()}
            disabled={!input.trim() || loading}
            className="p-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            <Send size={14} />
          </button>
        </div>
      </div>
    </aside>
  );
}
