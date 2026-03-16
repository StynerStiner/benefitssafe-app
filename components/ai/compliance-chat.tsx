"use client";

import { BeneficiarySearchPicker } from "@/components/shared/beneficiary-search-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  ChevronDown,
  ChevronUp,
  ExternalLink,
  FileText,
  Loader2,
  MessageSquare,
  Minus,
  Paperclip,
  Send,
  Shield,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  citations?: string[];
}

interface GrantOption {
  id: string;
  name: string;
  grantIssuerName: string;
  grantDocumentName: string | null;
}

export function ComplianceChat() {
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showContext, setShowContext] = useState(false);

  // Grant context
  const [grants, setGrants] = useState<GrantOption[]>([]);
  const [selectedGrantId, setSelectedGrantId] = useState<string>("");
  const [customContext, setCustomContext] = useState("");
  const [grantsLoaded, setGrantsLoaded] = useState(false);

  // Beneficiary context
  const [selectedBeneficiaryId, setSelectedBeneficiaryId] = useState<string>("");
  const [selectedBeneficiaryName, setSelectedBeneficiaryName] = useState<string>("");

  // File attachment
  const [attachedFile, setAttachedFile] = useState<{
    name: string;
    text?: string;
    type: "text" | "image";
    mediaType?: string;
    base64?: string;
  } | null>(null);
  const [parsingFile, setParsingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch grants when panel opens
  useEffect(() => {
    if (open && !grantsLoaded) {
      fetch("/api/grants")
        .then((r) => r.ok ? r.json() : [])
        .then((data) => {
          if (Array.isArray(data)) {
            setGrants(data.map((g: Record<string, unknown>) => ({
              id: g.id as string,
              name: g.name as string,
              grantIssuerName: g.grantIssuerName as string,
              grantDocumentName: (g.grantDocumentName as string) || null,
            })));
          }
          setGrantsLoaded(true);
        })
        .catch(() => setGrantsLoaded(true));
    }
  }, [open, grantsLoaded]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus input when opened
  useEffect(() => {
    if (open && !minimized) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open, minimized]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setLoading(true);

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessage,
          conversationHistory: messages.slice(-10),
          grantId: selectedGrantId || undefined,
          beneficiaryId: selectedBeneficiaryId || undefined,
          customContext: [customContext, attachedFile?.type === "text" ? attachedFile.text : null].filter(Boolean).join("\n\n") || undefined,
          image: attachedFile?.type === "image" ? {
            mediaType: attachedFile.mediaType,
            base64: attachedFile.base64,
          } : undefined,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: data.response,
            citations: data.citations,
          },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: `I encountered an error: ${data.error || "Something went wrong."}. Please try again.`,
          },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "I'm having trouble connecting. Please check your connection and try again.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const clearChat = () => {
    setMessages([]);
    setSelectedGrantId("");
    setSelectedBeneficiaryId("");
    setSelectedBeneficiaryName("");
    setCustomContext("");
    setAttachedFile(null);
    setShowContext(false);
  };

  const handleFileAttach = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setParsingFile(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/ai/parse-pdf", {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        if (data.type === "image") {
          setAttachedFile({
            name: data.name,
            type: "image",
            mediaType: data.mediaType,
            base64: data.base64,
          });
        } else {
          setAttachedFile({
            name: data.name,
            type: "text",
            text: data.text,
          });
        }
      } else {
        const err = await res.json().catch(() => ({ error: "Upload failed" }));
        setAttachedFile({
          name: file.name,
          type: "text",
          text: `[${file.name} — ${err.error || "could not process"}. Please paste content instead.]`,
        });
      }
    } catch {
      setAttachedFile({
        name: file.name,
        type: "text",
        text: `[${file.name} — upload failed]`,
      });
    } finally {
      setParsingFile(false);
      e.target.value = "";
    }
  };

  // Floating button when closed
  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-50 group"
        title="AI Compliance Assistant"
      >
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary/80 text-white shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 hover:scale-105 transition-all duration-200">
          <div className="relative">
            <Shield className="h-6 w-6" />
            <div className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-green-400 border-2 border-white" />
          </div>
        </div>
      </button>
    );
  }

  // Minimized bar
  if (minimized) {
    return (
      <div
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 rounded-2xl bg-gradient-to-r from-primary to-primary/90 text-white shadow-lg shadow-primary/20 px-4 py-3 cursor-pointer hover:shadow-xl transition-all duration-200"
        onClick={() => setMinimized(false)}
      >
        <Shield className="h-4 w-4" />
        <span className="text-lg font-semibold mb-0">Compliance AI</span>
        {messages.length > 0 && (
          <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-white/20 text-xs font-bold px-1">
            {messages.filter((m) => m.role === "assistant").length}
          </span>
        )}
        <button
          className="ml-1 p-0.5 rounded text-white/60 hover:text-white hover:bg-white/10 transition-colors"
          onClick={(e) => { e.stopPropagation(); setOpen(false); setMinimized(false); }}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  // Full panel
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col w-[480px] h-[92vh] max-h-[920px] rounded-2xl bg-background border border-border/80 shadow-2xl shadow-black/10 dark:shadow-black/30 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 bg-gradient-to-r from-primary via-primary to-primary/90 text-white shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm">
            <Shield className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-bold tracking-tight leading-none">Compliance Assistant</p>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-400" />
              </span>
              <p className="text-xs text-white/70 font-medium">Live government data</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-0.5">
          <button
            className="h-7 w-7 flex items-center justify-center rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors"
            onClick={() => setMinimized(true)}
          >
            <Minus className="h-4 w-4" />
          </button>
          <button
            className="h-7 w-7 flex items-center justify-center rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors"
            onClick={() => setOpen(false)}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Context bar */}
      <div className="px-4 py-2.5 border-b bg-muted/20 shrink-0">
        <div className="flex items-center gap-2 mb-2">
          <Select value={selectedGrantId} onValueChange={setSelectedGrantId}>
            <SelectTrigger className="h-8 text-xs rounded-lg flex-1 bg-background">
              <SelectValue placeholder="Link a grant (optional)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No grant selected</SelectItem>
              {grants.map((g) => (
                <SelectItem key={g.id} value={g.id}>
                  {g.name} — {g.grantIssuerName}
                  {g.grantDocumentName ? " (doc)" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <button
            className="flex items-center gap-1 h-8 px-2.5 rounded-lg border bg-background text-xs font-medium text-neutral-500 dark:text-neutral-300 hover:text-foreground hover:border-border transition-colors shrink-0"
            onClick={() => setShowContext(!showContext)}
          >
            {showContext ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            More
          </button>
        </div>

        {/* Beneficiary search */}
        <BeneficiarySearchPicker
          value={selectedBeneficiaryId}
          onChange={(id, b) => {
            setSelectedBeneficiaryId(id);
            setSelectedBeneficiaryName(b ? `${b.firstName} ${b.lastName}` : "");
          }}
          placeholder="Search beneficiary by name, email, ID..."
        />

        {showContext && (
          <div className="mt-2.5">
            <Label className="text-xs text-neutral-500 dark:text-neutral-300 mb-1 block">Additional notes</Label>
            <Textarea
              value={customContext}
              onChange={(e) => setCustomContext(e.target.value)}
              placeholder="Paste grant rules, restrictions, or notes..."
              rows={3}
              className="text-xs resize-none rounded-lg bg-background"
            />
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center px-6">
            <div className="relative mb-5">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/15 to-primary/5 border border-primary/10">
                <Shield className="h-8 w-8 text-primary" />
              </div>
              <div className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/50 border-2 border-background">
                <span className="h-2 w-2 rounded-full bg-green-500" />
              </div>
            </div>
            <h3 className="text-sm font-bold tracking-tight mb-1.5">Compliance Assistant</h3>
            <p className="text-xs text-neutral-500 dark:text-neutral-300 leading-relaxed max-w-[300px]">
              Ask any question about SSI, SSDI, Medi-Cal, Medicaid, or grant disbursement compliance. I search live government sources for current rules.
            </p>

            <div className="mt-5 w-full max-w-[340px] space-y-2">
              <p className="text-xs font-semibold text-neutral-500 dark:text-neutral-300 uppercase tracking-widest mb-2">Try asking</p>
              {[
                { q: "Can I pay for internet for an SSI beneficiary?", icon: "wifi" },
                { q: "What are the current Medi-Cal asset limits?", icon: "dollar" },
                { q: "Is a subscription to Adobe taxable income for SSI?", icon: "app" },
              ].map(({ q }) => (
                <button
                  key={q}
                  onClick={() => { setInput(q); inputRef.current?.focus(); }}
                  className="group w-full flex items-center gap-2.5 text-left text-xs text-foreground/80 hover:text-primary rounded-xl px-3.5 py-2.5 border border-border/60 hover:border-primary/30 hover:bg-primary/[0.03] transition-all duration-150"
                >
                  <MessageSquare className="h-3.5 w-3.5 text-neutral-500 dark:text-neutral-300 group-hover:text-primary shrink-0 transition-colors" />
                  <span>{q}</span>
                </button>
              ))}
            </div>

            <div className="mt-5 flex items-center gap-4 text-xs text-neutral-500 dark:text-neutral-300/60">
              <span className="flex items-center gap-1"><span className="h-1 w-1 rounded-full bg-green-500" />SSA.gov</span>
              <span className="flex items-center gap-1"><span className="h-1 w-1 rounded-full bg-blue-500" />IRS.gov</span>
              <span className="flex items-center gap-1"><span className="h-1 w-1 rounded-full bg-purple-500" />CMS.gov</span>
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            {msg.role === "assistant" && (
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 shrink-0 mr-2 mt-0.5">
                <Shield className="h-3.5 w-3.5 text-primary" />
              </div>
            )}
            <div
              className={`max-w-[80%] ${
                msg.role === "user"
                  ? "rounded-2xl rounded-br-md bg-primary text-white px-4 py-2.5"
                  : "rounded-2xl rounded-bl-md bg-muted/40 border px-4 py-3"
              }`}
            >
              {msg.role === "assistant" ? (
                <div className="prose prose-sm prose-neutral dark:prose-invert max-w-none text-sm leading-relaxed [&_h1]:text-sm [&_h1]:font-bold [&_h2]:text-sm [&_h2]:font-bold [&_h3]:text-sm [&_h3]:font-semibold [&_p]:text-sm [&_li]:text-sm [&_strong]:font-bold [&_ul]:space-y-1 [&_p]:my-1.5">
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
              ) : (
                <p className="text-sm leading-relaxed">{msg.content}</p>
              )}

              {/* Citations */}
              {msg.citations && msg.citations.length > 0 && (
                <div className="mt-3 pt-2.5 border-t border-border/40">
                  <p className="text-xs font-bold text-neutral-500 dark:text-neutral-300 uppercase tracking-wider mb-1.5">Sources</p>
                  <div className="space-y-1">
                    {msg.citations.map((url, ci) => (
                      <a
                        key={ci}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 text-xs text-primary hover:underline"
                      >
                        <ExternalLink className="h-3 w-3 shrink-0" />
                        <span className="truncate">{url.replace(/^https?:\/\/(www\.)?/, "").substring(0, 55)}</span>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 shrink-0 mr-2 mt-0.5">
              <Shield className="h-3.5 w-3.5 text-primary" />
            </div>
            <div className="bg-muted/40 border rounded-2xl rounded-bl-md px-4 py-3">
              <div className="flex items-center gap-2.5">
                <div className="flex gap-1">
                  <span className="h-2 w-2 rounded-full bg-primary/40 animate-bounce [animation-delay:0ms]" />
                  <span className="h-2 w-2 rounded-full bg-primary/40 animate-bounce [animation-delay:150ms]" />
                  <span className="h-2 w-2 rounded-full bg-primary/40 animate-bounce [animation-delay:300ms]" />
                </div>
                <span className="text-xs text-neutral-500 dark:text-neutral-300">Searching government sources...</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="px-4 py-3 border-t bg-muted/10 shrink-0">
        {/* Attached file indicator */}
        {attachedFile && (
          <div className="flex items-center gap-2.5 mb-2.5 rounded-xl bg-primary/5 border border-primary/15 px-3 py-2">
            {attachedFile.type === "image" && attachedFile.base64 ? (
              <img
                src={`data:${attachedFile.mediaType};base64,${attachedFile.base64}`}
                alt={attachedFile.name}
                className="h-9 w-9 rounded-lg object-cover shrink-0 border"
              />
            ) : (
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 shrink-0">
                <FileText className="h-4 w-4 text-primary" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold truncate">{attachedFile.name}</p>
              <p className="text-xs text-neutral-500 dark:text-neutral-300">
                {attachedFile.type === "image" ? "Image attached" : `${(attachedFile.text?.length || 0).toLocaleString()} chars`}
              </p>
            </div>
            <button
              onClick={() => setAttachedFile(null)}
              className="flex h-6 w-6 items-center justify-center rounded-md text-neutral-500 dark:text-neutral-300 hover:text-foreground hover:bg-muted transition-colors shrink-0"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {parsingFile && (
          <div className="flex items-center gap-2 mb-2.5 px-1 text-xs text-neutral-500 dark:text-neutral-300">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
            Processing file...
          </div>
        )}

        <div className="flex items-end gap-2 bg-background rounded-2xl border px-2 py-2 shadow-sm">
          <button
            className="flex h-10 w-10 items-center justify-center rounded-xl text-neutral-500 dark:text-neutral-300 hover:text-foreground hover:bg-muted/50 transition-colors shrink-0"
            onClick={() => fileInputRef.current?.click()}
            disabled={loading || parsingFile}
            title="Attach PDF, image, spreadsheet, or text file"
          >
            <Paperclip className="h-5 w-5" />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.txt,.md,.csv,.xlsx,.xls,.png,.jpg,.jpeg,.gif,.webp,text/*,image/*,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
            className="hidden"
            onChange={handleFileAttach}
          />
          <textarea
            ref={inputRef as unknown as React.RefObject<HTMLTextAreaElement>}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              // Auto-resize
              e.target.style.height = "auto";
              e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
            }}
            onKeyDown={handleKeyDown}
            placeholder="Ask about compliance..."
            disabled={loading}
            rows={1}
            className="flex-1 min-h-[40px] max-h-[120px] bg-transparent text-sm outline-none placeholder:text-neutral-500 dark:text-neutral-300/60 resize-none py-2.5 leading-relaxed"
          />
          <button
            onClick={handleSend}
            disabled={loading || !input.trim()}
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-white disabled:opacity-40 hover:bg-primary/90 transition-colors shrink-0"
          >
            {loading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Send className="h-5 w-5" />
            )}
          </button>
        </div>
        <div className="flex items-center justify-between mt-2 px-1">
          <p className="text-xs text-neutral-500 dark:text-neutral-300/60">
            Powered by Claude AI. Not legal advice.
          </p>
          {messages.length > 0 && (
            <button
              onClick={clearChat}
              className="text-xs text-neutral-500 dark:text-neutral-300 hover:text-foreground"
            >
              Clear chat
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
