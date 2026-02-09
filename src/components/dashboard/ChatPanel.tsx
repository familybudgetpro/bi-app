import React, { useState } from "react";
import { MessageSquare, ArrowUpRight } from "lucide-react";

interface ChatMessage {
  role: string;
  content: string;
}

interface ChatPanelProps {
  messages: ChatMessage[];
  onSendMessage: (msg: string) => void;
}

export function ChatPanel({ messages, onSendMessage }: ChatPanelProps) {
  const [input, setInput] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    onSendMessage(input);
    setInput("");
  };

  return (
    <div className="h-full flex flex-col bg-card">
      <div className="p-4 border-b border-border bg-muted/20">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-5 h-5 bg-gradient-to-br from-primary to-purple-600 rounded flex items-center justify-center shadow-sm">
            <MessageSquare size={10} className="text-primary-foreground" />
          </div>
          <span className="text-sm font-bold text-foreground">Clarity AI</span>
          <span className="ml-auto text-[10px] bg-green-500/10 text-green-600 border border-green-500/20 px-1.5 py-0.5 rounded font-medium">
            Online
          </span>
        </div>
        <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold ml-7">
          Smart Insights
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col-reverse">
        <div className="space-y-4">
          {messages.map((m, i) => (
            <div
              key={i}
              className={`text-xs leading-relaxed max-w-[90%] animate-in slide-in-from-bottom-2 duration-300 ${
                m.role === "user"
                  ? "bg-primary text-primary-foreground ml-auto rounded-2xl rounded-br-sm p-3 shadow-md"
                  : "bg-muted/50 border border-border mr-auto rounded-2xl rounded-bl-sm p-3 text-foreground shadow-sm"
              }`}
            >
              {m.content}
            </div>
          ))}
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="p-4 border-t border-border bg-card/80 backdrop-blur-sm"
      >
        <div className="relative group">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask AI about this data..."
            className="w-full pl-4 pr-12 py-3 bg-muted/30 border border-border focus:border-primary/50 focus:bg-background rounded-2xl text-xs outline-none transition-all placeholder:text-muted-foreground/50 shadow-inner"
          />
          <button
            type="submit"
            className="absolute right-1.5 top-1/2 -translate-y-1/2 w-8 h-8 bg-primary text-primary-foreground rounded-xl flex items-center justify-center hover:bg-primary/90 shadow-lg transition-all active:scale-95 group-hover:scale-105"
          >
            <ArrowUpRight size={16} />
          </button>
        </div>
      </form>
    </div>
  );
}
