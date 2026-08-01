"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUp,
  Paperclip,
  Square,
  Telescope,
  X,
} from "lucide-react";
import {
  COMPOSER_ACCEPT,
  COMPOSER_EXPAND_THRESHOLD,
  COMPOSER_PLACEHOLDERS,
  canSubmitComposer,
  suggestionsForSurface,
} from "@/lib/modules/hakeem-composer/constants";
import { HAKEEM_ASK_MAX_CHARS, HOME_ASK_DRAFT_KEY } from "@/lib/modules/config/home-inline-ask";
import type {
  ComposerSlashCommand,
  ComposerSuggestion,
  HakeemComposerProps,
} from "@/lib/modules/hakeem-composer/types";
import {
  applySlashCommand,
  detectSlashTrigger,
  filterSlashCommands,
} from "@/lib/modules/hakeem-composer/slash-commands";
import {
  applyMention,
  buildMentionCatalog,
  detectMentionTrigger,
  filterMentions,
} from "@/lib/modules/hakeem-composer/mentions";
import { ComposerAttachments } from "./composer-attachments";
import { ComposerContextBar } from "./composer-context-bar";
import { ComposerStatus } from "./composer-status";
import { ComposerTextarea } from "./composer-textarea";
import { ExpandButton, ExpandedComposerDialog } from "./expanded-composer";
import { MentionMenu } from "./mention-menu";
import { ModeSelector } from "./mode-selector";
import { SlashCommandMenu } from "./slash-command-menu";
import { SmartSuggestions } from "./smart-suggestions";
import { SourcesSelector } from "./sources-selector";
import { ToolsMenu, type ToolAction } from "./tools-menu";
import { VoiceButton } from "./voice-recorder";

function saveDraft(key: string, text: string, maxChars: number) {
  try {
    if (!text.trim()) sessionStorage.removeItem(key);
    else sessionStorage.setItem(key, text.slice(0, maxChars));
  } catch {
    /* ignore */
  }
}

/**
 * صندوق حكيم الذكي — مركز استقبال الأوامر والبحث والمحادثة.
 * لا يستبدل محرك الجلسات/البث؛ يُربَط عبر props بـ HakeemAskWorkspace.
 */
export function HakeemComposer({
  surface = "ask",
  value,
  onChange,
  onSubmit,
  onStop,
  busy = false,
  extracting = false,
  disabled = false,
  placeholder,
  maxChars = HAKEEM_ASK_MAX_CHARS,
  draftKey = HOME_ASK_DRAFT_KEY,
  persistDraft = true,
  modeId,
  onModeChange,
  showModeSelector = true,
  detailed,
  onDetailedChange,
  sources,
  onSourcesChange,
  attachments,
  onAttachFiles,
  onRemoveAttachment,
  contextItems = [],
  onRemoveContext,
  suggestions,
  onSuggestionSelect,
  statusMessage,
  errorMessage,
  submitLabel,
  followUp = false,
  accept = COMPOSER_ACCEPT,
  className = "",
}: HakeemComposerProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const [caret, setCaret] = useState(0);
  const [modeOpen, setModeOpen] = useState(false);
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [slashIndex, setSlashIndex] = useState(0);
  const [mentionIndex, setMentionIndex] = useState(0);
  const [phIndex, setPhIndex] = useState(0);
  const [online, setOnline] = useState(true);

  const slashState = detectSlashTrigger(value, caret);
  const mentionState = detectMentionTrigger(value, caret);
  const slashCommands = useMemo(
    () => (slashState ? filterSlashCommands(slashState.query) : []),
    [slashState]
  );
  const mentions = useMemo(() => {
    if (!mentionState) return [];
    return filterMentions(
      buildMentionCatalog({ attachments, contextItems }),
      mentionState.query
    );
  }, [mentionState, attachments, contextItems]);

  const defaultSuggestions = useMemo(
    () =>
      suggestions ??
      suggestionsForSurface(surface, {
        hasAttachment: attachments.some((a) => a.status === "ready"),
        followUp,
      }),
    [suggestions, surface, attachments, followUp]
  );

  const canSend = canSubmitComposer({
    text: value,
    hasReadyAttachment: attachments.some((a) => a.status === "ready"),
    busy: false,
    extracting,
    maxChars,
  });

  const nearLimit = value.length >= maxChars - 200;
  const showExpand = value.length >= COMPOSER_EXPAND_THRESHOLD;

  useEffect(() => {
    if (!placeholder) {
      const t = window.setInterval(() => setPhIndex((i) => (i + 1) % COMPOSER_PLACEHOLDERS.length), 7000);
      return () => window.clearInterval(t);
    }
  }, [placeholder]);

  useEffect(() => {
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    setOnline(typeof navigator !== "undefined" ? navigator.onLine : true);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) {
        setModeOpen(false);
        setSourcesOpen(false);
        setToolsOpen(false);
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  useEffect(() => {
    setSlashIndex(0);
  }, [slashState?.query]);

  useEffect(() => {
    setMentionIndex(0);
  }, [mentionState?.query]);

  function updateValue(next: string, nextCaret?: number) {
    onChange(next.slice(0, maxChars));
    if (typeof nextCaret === "number") setCaret(nextCaret);
    if (persistDraft) saveDraft(draftKey, next, maxChars);
  }

  function handleSlashSelect(cmd: ComposerSlashCommand) {
    const applied = applySlashCommand(value, caret, cmd);
    updateValue(applied.text, applied.caret);
    if (cmd.modeId) onModeChange(cmd.modeId);
    if (cmd.detailed) onDetailedChange(true);
  }

  function handleTool(tool: ToolAction) {
    if (tool.modeId) onModeChange(tool.modeId);
    if (tool.detailed) onDetailedChange(true);
    if (tool.insertText) updateValue(tool.insertText, tool.insertText.length);
  }

  function handleSuggestion(s: ComposerSuggestion) {
    if (onSuggestionSelect) onSuggestionSelect(s);
    else updateValue(s.insertText, s.insertText.length);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (slashState && slashCommands.length) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSlashIndex((i) => (i + 1) % slashCommands.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSlashIndex((i) => (i - 1 + slashCommands.length) % slashCommands.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        handleSlashSelect(slashCommands[slashIndex] ?? slashCommands[0]);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        updateValue(value);
        setCaret(caret);
        return;
      }
    }
    if (mentionState && mentions.length) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setMentionIndex((i) => (i + 1) % mentions.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setMentionIndex((i) => (i - 1 + mentions.length) % mentions.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        const m = mentions[mentionIndex];
        if (m) {
          const applied = applyMention(value, caret, m);
          updateValue(applied.text, applied.caret);
        }
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        return;
      }
    }
    if (e.key === "Escape" && busy && onStop) {
      e.preventDefault();
      onStop();
      return;
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (busy && onStop) onStop();
      else if (canSend && !busy && online) onSubmit();
    }
  }

  const resolvedPlaceholder =
    placeholder ||
    (followUp
      ? "اسأل عن نقطة أخرى في السياق نفسه…"
      : attachments.some((a) => a.status === "ready")
        ? "اكتب سؤالك عن المستند المرفق (اختياري)…"
        : COMPOSER_PLACEHOLDERS[phIndex]);

  const label = busy ? "إيقاف" : submitLabel || (followUp ? "إرسال" : "اسأل حكيم");

  return (
    <div ref={rootRef} className={`hkm-composer ${className}`.trim()} data-surface={surface}>
      {!online ? (
        <p className="hkm-composer__offline" role="status">
          لا يوجد اتصال — حُفظت المسودة محليًا ولن يُرسل الطلب مرتين.
        </p>
      ) : null}

      <ComposerContextBar items={contextItems} onRemove={onRemoveContext} />

      {!followUp && !value.trim() && !attachments.length ? (
        <SmartSuggestions suggestions={defaultSuggestions} onSelect={handleSuggestion} />
      ) : null}

      <form
        className="hkm-composer__box"
        onSubmit={(e) => {
          e.preventDefault();
          if (busy && onStop) onStop();
          else if (canSend && !busy && online) onSubmit();
        }}
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = "copy";
        }}
        onDrop={(e) => {
          e.preventDefault();
          if (e.dataTransfer.files?.length) onAttachFiles(e.dataTransfer.files);
        }}
      >
        <ComposerAttachments attachments={attachments} onRemove={onRemoveAttachment} />
        <ComposerStatus message={statusMessage} error={errorMessage} />

        <div className="hkm-composer__input-wrap">
          {slashState ? (
            <SlashCommandMenu
              commands={slashCommands}
              activeIndex={slashIndex}
              onHover={setSlashIndex}
              onSelect={handleSlashSelect}
            />
          ) : null}
          {mentionState && !slashState ? (
            <MentionMenu
              mentions={mentions}
              activeIndex={mentionIndex}
              onHover={setMentionIndex}
              onSelect={(m) => {
                const applied = applyMention(value, caret, m);
                updateValue(applied.text, applied.caret);
              }}
            />
          ) : null}

          <ComposerTextarea
            value={value}
            onChange={updateValue}
            onKeyDown={handleKeyDown}
            onSelect={setCaret}
            placeholder={resolvedPlaceholder}
            disabled={disabled}
            maxChars={maxChars}
            rows={surface === "home" && !followUp ? 2 : 1}
          />

          {value.trim() ? (
            <button
              type="button"
              className="hkm-composer__clear focus-ring"
              aria-label="مسح النص"
              title="مسح النص"
              onClick={() => {
                if (value.length > 200 && !window.confirm("هل تريد مسح النص الطويل؟")) return;
                updateValue("");
              }}
            >
              <X size={14} aria-hidden />
            </button>
          ) : null}
        </div>

        <div className="hkm-composer__toolbar">
          <div className="hkm-composer__toolbar-start">
            <label
              className={`hkm-composer__tool-btn focus-ring ${extracting ? "is-active" : ""}`}
              title="إرفاق ملف من الجهاز"
            >
              <Paperclip size={15} aria-hidden />
              <span className="hkm-composer__tool-label">{extracting ? "قراءة…" : "إرفاق"}</span>
              <input
                ref={fileRef}
                type="file"
                accept={accept}
                multiple
                className="sr-only"
                disabled={extracting || busy || disabled}
                onChange={(e) => {
                  if (e.target.files?.length) onAttachFiles(e.target.files);
                  e.target.value = "";
                }}
              />
            </label>

            <ToolsMenu open={toolsOpen} onOpenChange={setToolsOpen} onSelect={handleTool} />

            <SourcesSelector
              sources={sources}
              onChange={onSourcesChange}
              open={sourcesOpen}
              onOpenChange={(o) => {
                setSourcesOpen(o);
                if (o) {
                  setModeOpen(false);
                  setToolsOpen(false);
                }
              }}
            />

            {showModeSelector ? (
              <ModeSelector
                modeId={modeId}
                onChange={onModeChange}
                open={modeOpen}
                onOpenChange={(o) => {
                  setModeOpen(o);
                  if (o) {
                    setSourcesOpen(false);
                    setToolsOpen(false);
                  }
                }}
              />
            ) : null}

            <button
              type="button"
              className={`hkm-composer__tool-btn hkm-composer__tool-btn--deep focus-ring ${detailed ? "is-active" : ""}`}
              aria-pressed={detailed}
              aria-label="دراسة موسّعة تفصيلية"
              title="دراسة موسّعة تفصيلية — بحثٌ أعمق وسوابق وتحقّق (أبطأ وأدقّ)"
              onClick={() => onDetailedChange(!detailed)}
            >
              <Telescope size={15} aria-hidden />
              <span className="hkm-composer__tool-label hkm-composer__tool-label--always">دراسة موسّعة</span>
            </button>

            <VoiceButton
              disabled={busy || disabled}
              onTranscript={(t) => updateValue(t.slice(0, maxChars), Math.min(t.length, maxChars))}
            />

            <ExpandButton visible={showExpand} onClick={() => setExpanded(true)} />
          </div>

          <div className="hkm-composer__toolbar-end">
            {nearLimit ? (
              <span className="hkm-composer__counter" aria-live="polite">
                {value.length.toLocaleString("ar-SA")}/{maxChars.toLocaleString("ar-SA")}
              </span>
            ) : null}

            {busy && onStop ? (
              <button
                type="button"
                className="hkm-composer__stop focus-ring"
                onClick={onStop}
                aria-label="إيقاف التوليد"
                title="إيقاف"
              >
                <Square size={14} aria-hidden />
                <span>إيقاف</span>
              </button>
            ) : (
              <button
                type="submit"
                className="hkm-composer__send focus-ring"
                disabled={!canSend || disabled || !online || extracting}
                aria-label={label}
                title="Enter للإرسال"
              >
                <ArrowUp size={16} aria-hidden />
                <span>{label}</span>
              </button>
            )}
          </div>
        </div>
      </form>

      {followUp || value.trim() || attachments.length ? (
        <SmartSuggestions suggestions={defaultSuggestions.slice(0, 4)} onSelect={handleSuggestion} />
      ) : null}

      <p className="hkm-composer__hint">
        Enter للإرسال · Shift+Enter لسطر جديد · / للأوامر · @ للإشارات · Esc للإيقاف أو إغلاق القائمة
      </p>

      <ExpandedComposerDialog
        open={expanded}
        value={value}
        onChange={(v) => updateValue(v)}
        onClose={() => setExpanded(false)}
        onSubmit={onSubmit}
        maxChars={maxChars}
        busy={busy}
      />
    </div>
  );
}

export default HakeemComposer;
