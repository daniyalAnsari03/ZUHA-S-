"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import {
  Bot,
  ImagePlus,
  Loader2,
  MessageCircle,
  Plus,
  SendHorizontal,
  Sparkles,
  UserRound,
  X,
} from "lucide-react";

import { WidgetErrorBoundary } from "@/components/ui/widget-error-boundary";
import { useAiChat, type ChatMessage } from "@/components/chat/use-ai-chat";
import {
  ChatNotificationBadge,
  type ChatNotificationBadgeHandle,
} from "@/components/notifications/chat-notification-badge";
import { resolveImageUrl } from "@/lib/images";

const AGENT_LABELS: Record<string, string> = {
  manager: "AI Manager",
  salesman: "AI Salesman",
  product: "Product Employee",
  inventory: "Inventory Employee",
  order: "Order Employee",
  customer: "Customer Employee",
  sales: "Sales & Analytics",
  marketing: "Marketing Employee",
  support: "Support Employee",
};

function labelFor(name: string | null, fallback: string): string {
  if (!name) return fallback;
  return AGENT_LABELS[name] ?? name;
}

type AiChatProps = {
  channel: "admin" | "salesman";
  storageKey: string;
  title: string;
  subtitle?: string;
  fallbackAgent: string;
  variant: "panel" | "floating";
  theme?: "plum" | "gold";
  quickPrompts?: string[];
};

const ATTACH_RE = /\[Attached image:\s*([^\]]+)\]/g;

function extractAttachment(
  content: string,
): { full: string; path: string } | null {
  const match = content.match(/\[Attached image:\s*([^\]]+)\]/);
  if (!match) return null;
  return { full: match[0], path: match[1].trim() };
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  const attachment = extractAttachment(message.content);
  const bodyText = attachment
    ? message.content.replace(ATTACH_RE, "").replace(/\n{3,}/g, "\n\n").trim()
    : message.content;

  return (
    <motion.div
      initial={{ opacity: 0, y: 14, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 320, damping: 28 }}
      className={`flex ${isUser ? "justify-end" : "justify-start"}`}
    >
      <div
        className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
          isUser
            ? "rounded-br-sm bg-gradient-to-br from-plum-dark via-plum to-plum-light text-white shadow-md shadow-plum/25 ring-1 ring-white/30"
            : "rounded-bl-sm bg-white text-charcoal shadow-sm shadow-charcoal/5 ring-1 ring-charcoal/5"
        }`}
      >
        {attachment && (
          <div
            className={`relative mb-2 h-24 w-24 overflow-hidden rounded-xl ring-1 ${
              isUser ? "ring-white/30" : "ring-charcoal/10"
            }`}
          >
            <Image
              src={resolveImageUrl(attachment.path) || ""}
              alt="Attached image"
              fill
              sizes="96px"
              className="object-cover"
            />
          </div>
        )}
        {bodyText || "\u00A0"}
      </div>
    </motion.div>
  );
}

function ChatBody({
  channel,
  storageKey,
  title,
  subtitle,
  fallbackAgent,
  theme = "plum",
  quickPrompts,
}: AiChatProps) {
  const {
    messages,
    input,
    setInput,
    send,
    isBusy,
    activeAgent,
    error,
    setError,
    reset,
    attachedImage,
    setAttachedImage,
  } = useAiChat(channel, storageKey);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const isGold = theme === "gold";

  useEffect(() => {
    const node = scrollRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [messages, isBusy, error]);

  const handleAttachFile = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const { uploadImageAction } = await import("@/app/admin/actions");
      const formData = new FormData();
      formData.append("file", file);
      formData.append("folder", "products");
      const result = await uploadImageAction(formData);
      if (result.ok) {
        setAttachedImage(result.path);
      } else {
        setError(result.error);
      }
    } catch {
      setError("Image upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const busyLabel = labelFor(activeAgent, fallbackAgent);

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-3xl shadow-xl shadow-plum/10 ring-1 ring-white/40">
      {/* Premium gradient header: rich plum, dark → gradually lighter */}
      <header className="relative bg-gradient-to-b from-plum-dark via-plum to-plum-light px-4 py-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_10px_24px_-14px_rgba(74,32,64,0.55)] sm:px-5">
        {/* Premium gold hairline: subtle, muted, never bright */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-3 sm:inset-x-4 bottom-0 h-px bg-gradient-to-r from-transparent via-gold-muted/60 to-transparent"
        />
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/15 ring-1 ring-white/25">
              {isGold ? (
                <UserRound className="h-5 w-5 text-white" aria-hidden="true" />
              ) : (
                <Bot className="h-5 w-5 text-white" aria-hidden="true" />
              )}
            </div>
            <div className="min-w-0">
              <h2 className="font-serif text-base text-white">{title}</h2>
              {subtitle && (
                <p className="truncate text-xs text-white/70">{subtitle}</p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={reset}
            title="Start a new conversation"
            className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 text-xs font-medium text-white/85 ring-1 ring-white/20 transition hover:bg-white/20"
          >
            {isGold ? (
              <>
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                <span className="hidden sm:inline">New</span>
              </>
            ) : (
              <>
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                <span className="hidden sm:inline">New</span>
              </>
            )}
          </button>
        </div>
      </header>

      {/* Message area: warm ivory → white */}
      <div className="relative flex-1 overflow-hidden">
        <div
          ref={scrollRef}
          className="relative z-0 h-full space-y-3 overflow-y-auto bg-gradient-to-b from-[#f6efe6] via-[#faf6ef] to-[#ffffff] px-4 py-4 sm:px-5"
        >
          {messages.length === 0 && (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 22 }}
              >
                {isGold ? (
                  <Image
                    src="/images/brand/dins-logo.png"
                    alt="DINS"
                    width={408}
                    height={146}
                    priority
                    className="h-10 w-auto opacity-90"
                  />
                ) : (
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-plum/10">
                    <Sparkles className="h-6 w-6 text-plum" aria-hidden="true" />
                  </span>
                )}
              </motion.div>
              <p className="max-w-[26ch] text-sm leading-relaxed text-charcoal-muted">
                {channel === "admin"
                  ? "Ask the AI Manager anything about your store — products, stock, orders, customers or sales."
                  : "Ask about products, availability, delivery or your order. I only answer from real store data."}
              </p>
            </div>
          )}

          {messages.map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))}

          {isBusy && (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              className="inline-flex items-center gap-2.5 rounded-2xl rounded-bl-sm bg-white px-4 py-2.5 text-xs text-charcoal-muted ring-1 ring-charcoal/5"
            >
              <span className="flex items-center gap-1" aria-hidden="true">
                {[0, 1, 2].map((i) => (
                  <motion.span
                    key={i}
                    className="h-1.5 w-1.5 rounded-full bg-plum"
                    animate={{ opacity: [0.35, 1, 0.35], y: [0, -2, 0] }}
                    transition={{
                      repeat: Infinity,
                      duration: 0.9,
                      delay: i * 0.14,
                      ease: "easeInOut",
                    }}
                  />
                ))}
              </span>
              <span>{busyLabel} is working</span>
            </motion.div>
          )}

          {error && !isBusy && (
            <div className="rounded-2xl bg-red-50 px-4 py-2.5 text-xs text-red-700 ring-1 ring-red-200">
              {error}
            </div>
          )}
        </div>
      </div>

      {/* Quick prompts */}
      {quickPrompts && quickPrompts.length > 0 && messages.length === 0 && (
        <div className="flex flex-wrap gap-2 bg-gradient-to-b from-white to-[#f9f3f6] px-4 pb-2 sm:px-5">
          {quickPrompts.map((prompt) => (
            <button
              key={prompt}
              type="button"
              disabled={isBusy}
              onClick={() => setInput(prompt)}
              className="rounded-full border border-plum/20 bg-white/80 px-3 py-1.5 text-xs text-plum transition hover:bg-plum/5 disabled:opacity-50"
            >
              {prompt}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <form onSubmit={send} className="border-t border-charcoal/5 bg-white">
        {channel === "admin" && attachedImage && (
          <div className="flex items-center gap-2 px-3 pt-3 sm:px-4">
            <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg ring-1 ring-charcoal/10">
              <Image
                src={resolveImageUrl(attachedImage) || ""}
                alt="Attached image preview"
                fill
                sizes="40px"
                className="object-cover"
              />
            </div>
            <span className="min-w-0 flex-1 truncate text-xs text-charcoal-muted">
              {attachedImage}
            </span>
            <button
              type="button"
              onClick={() => setAttachedImage(null)}
              disabled={isBusy}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-charcoal-muted transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
              aria-label="Remove attached image"
              title="Remove attached image"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        )}

        <div className="flex items-center gap-2 px-3 py-3 sm:px-4">
          {channel === "admin" && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml"
                onChange={(event) => void handleAttachFile(event.target.files?.[0])}
                className="hidden"
                aria-hidden="true"
                tabIndex={-1}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isBusy || uploading}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-charcoal/15 bg-[#faf6f8] text-charcoal-muted transition hover:border-plum/40 hover:text-plum disabled:opacity-50"
                aria-label="Attach an image"
                title="Attach an image"
              >
                {uploading ? (
                  <Loader2
                    className="h-4 w-4 animate-spin"
                    aria-hidden="true"
                  />
                ) : (
                  <ImagePlus className="h-4 w-4" aria-hidden="true" />
                )}
              </button>
            </>
          )}

          <label htmlFor={`${channel}-chat-input`} className="sr-only">
            Message
          </label>
          <input
            id={`${channel}-chat-input`}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Type your message…"
            maxLength={4000}
            disabled={isBusy}
            className="flex-1 rounded-full border border-charcoal/15 bg-[#faf6f8] px-4 py-2.5 text-sm text-charcoal outline-none transition placeholder:text-charcoal-muted focus:border-plum/40 focus:bg-white disabled:opacity-60"
          />
          <motion.button
            type="submit"
            disabled={isBusy || !input.trim()}
            whileTap={{ scale: 0.9 }}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-plum text-white shadow-sm shadow-plum/20 transition hover:bg-plum-dark disabled:opacity-50"
            aria-label="Send message"
          >
            <SendHorizontal className="h-4 w-4" aria-hidden="true" />
          </motion.button>
        </div>
      </form>
    </div>
  );
}

/**
 * AI chat surface used by both the Admin AI Workplace (panel) and the
 * storefront AI Salesman (floating). Both share the same premium brand
 * language: rich plum gradient header over a warm ivory → white message
 * area, with plum accents throughout.
 */
export function AiChat(props: AiChatProps) {
  if (props.variant === "panel") {
    return (
      <div className="h-[70vh] min-h-[30rem]">
        <ChatBody {...props} />
      </div>
    );
  }
  return <FloatingChat {...props} />;
}

function FloatingChat(props: AiChatProps) {
  const [open, setOpen] = useState(false);
  const notifRef = useRef<ChatNotificationBadgeHandle>(null);

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.96 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="fixed inset-x-2 bottom-20 z-[60] h-[min(38rem,calc(100dvh-5.5rem))] sm:inset-x-auto sm:right-5 sm:bottom-24 sm:h-[34rem] sm:w-[24rem]"
          >
            <div className="relative h-full">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="absolute -top-3 right-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-plum text-white shadow-md ring-4 ring-white/70 transition hover:bg-plum-dark"
                aria-label="Close chat"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
              <ChatBody {...props} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="fixed bottom-5 right-5 z-[60]">
        <WidgetErrorBoundary fallback={null}>
          <ChatNotificationBadge
            ref={notifRef}
            onOpenChange={(isOpen) => {
              if (isOpen) setOpen(false);
            }}
          />
        </WidgetErrorBoundary>
        <motion.button
          type="button"
          onClick={() => {
            notifRef.current?.close();
            setOpen((value) => !value);
          }}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-plum-dark via-plum to-plum-light text-white shadow-xl shadow-plum/30 ring-1 ring-white/40 transition hover:scale-105"
          aria-label={open ? "Close AI Salesman" : "Open AI Salesman"}
        >
          {open ? (
            <X className="h-6 w-6" aria-hidden="true" />
          ) : (
            <MessageCircle className="h-6 w-6" aria-hidden="true" />
          )}
        </motion.button>
      </div>
    </>
  );
}