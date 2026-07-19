// خريطة أيقونات المعاون القضائي (§24) — Lucide حصريًّا، وفق مواصفة نظام الأيقونات.
// أيقونةٌ واحدة لكلّ مفهوم؛ Gavel للمنطوق فقط، Scale للمعاون القضائي، BriefcaseBusiness للقضية.
import {
  Scale, BriefcaseBusiness, Files, Network, Workflow, Clock3, ScanSearch,
  CalendarDays, BookOpenCheck, GitBranch, PenLine, FilePenLine, Gavel,
  BadgeCheck, RotateCcw, Library, ScrollText, PlugZap, ShieldCheck,
  ClipboardList, ListChecks, FileText, Download,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export const JA_ICONS: Record<string, LucideIcon> = {
  assistant: Scale,
  case: BriefcaseBusiness,
  documents: Files,
  map: Network,
  procedure: Workflow,
  deadline: Clock3,
  evidence: ScanSearch,
  hearing: CalendarDays,
  study: BookOpenCheck,
  reasoning: GitBranch,
  drafting: PenLine,
  judgment: FilePenLine,
  operative: Gavel,
  quality: BadgeCheck,
  appeal: RotateCcw,
  sources: Library,
  audit: ScrollText,
  connectors: PlugZap,
  security: ShieldCheck,
  summary: FileText,
  brief: ClipboardList,
  jurisdiction: ShieldCheck,
  admissibility: ListChecks,
  issue: GitBranch,
  contradiction: ScanSearch,
  tasks: ClipboardList,
  export: Download,
};

export function JaIcon({ name, size = 18, className }: { name: string; size?: number; className?: string }) {
  const Icon = JA_ICONS[name] ?? FileText;
  return <Icon aria-hidden size={size} className={className} />;
}
