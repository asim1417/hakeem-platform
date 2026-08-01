"use client";

import {
  Briefcase,
  FilePen,
  FolderSearch,
  Gavel,
  Plus,
  RefreshCw,
  Search,
} from "lucide-react";
import type { ComposerModeId } from "@/lib/modules/hakeem-composer/types";

type ToolAction = {
  id: string;
  label: string;
  description: string;
  group: string;
  modeId?: ComposerModeId;
  detailed?: boolean;
  insertText?: string;
};

const TOOLS: ToolAction[] = [
  { id: "search-systems", label: "البحث في الأنظمة", description: "بحث نظامي مؤصّل", group: "بحث", modeId: "ask", insertText: "ابحث في الأنظمة عن " },
  { id: "search-rulings", label: "البحث في الأحكام", description: "سوابق ومبادئ", group: "بحث", modeId: "ask", insertText: "ابحث عن أحكام ومبادئ تتعلق بـ " },
  { id: "analyze-case", label: "تحليل قضية", description: "وقائع وطلبات ودفوع", group: "تحليل", modeId: "analyze-case" },
  { id: "analyze-contract", label: "تحليل عقد", description: "مخاطر ونواقص", group: "تحليل", modeId: "ask", insertText: "راجع هذا العقد وحدّد المخاطر: " },
  { id: "draft-memo", label: "مذكرة قانونية", description: "صياغة مذكرة", group: "صياغة", modeId: "action-plan", insertText: "صغ مذكرة قانونية بشأن " },
  { id: "draft-letter", label: "خطاب رسمي", description: "صياغة خطاب", group: "صياغة", modeId: "consultation", insertText: "صغ خطابًا رسميًا بشأن " },
  { id: "summarize", label: "تلخيص", description: "تلخيص منظم", group: "تحويل", modeId: "ask", insertText: "لخّص " },
  { id: "compare", label: "مقارنة", description: "مقارنة منظّمة", group: "تحويل", modeId: "ask", insertText: "قارن بين " },
  { id: "simulate", label: "محاكاة القاضي", description: "تقدير احتمالي", group: "وكلاء", modeId: "verdict-estimate" },
  { id: "deep", label: "دراسة موسّعة", description: "بحث أعمق", group: "وكلاء", modeId: "ask", detailed: true },
];

const GROUP_ICONS = {
  بحث: Search,
  تحليل: FolderSearch,
  صياغة: FilePen,
  تحويل: RefreshCw,
  وكلاء: Gavel,
} as const;

export function ToolsMenu({
  open,
  onOpenChange,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (tool: ToolAction) => void;
}) {
  const groups = Array.from(new Set(TOOLS.map((t) => t.group)));

  return (
    <div className="hkm-composer__menu-wrap">
      <button
        type="button"
        className={`hkm-composer__tool-btn focus-ring ${open ? "is-active" : ""}`}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="الأدوات"
        title="أدوات التحليل والصياغة"
        onClick={() => onOpenChange(!open)}
      >
        <Plus size={15} aria-hidden />
        <span>أدوات</span>
      </button>
      {open ? (
        <div className="hkm-composer__menu hkm-composer__menu--wide" role="menu" aria-label="أدوات حكيم">
          {groups.map((group) => {
            const Icon = GROUP_ICONS[group as keyof typeof GROUP_ICONS] ?? Briefcase;
            return (
              <div key={group} className="hkm-composer__menu-group">
                <p className="hkm-composer__menu-group-title">
                  <Icon size={12} aria-hidden /> {group}
                </p>
                {TOOLS.filter((t) => t.group === group).map((tool) => (
                  <button
                    key={tool.id}
                    type="button"
                    role="menuitem"
                    className="hkm-composer__menu-item focus-ring"
                    onClick={() => {
                      onSelect(tool);
                      onOpenChange(false);
                    }}
                  >
                    <span>
                      <strong>{tool.label}</strong>
                      <em>{tool.description}</em>
                    </span>
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export type { ToolAction };
