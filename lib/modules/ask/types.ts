/** عنصر أساس نظامي — متوافق مع LegalBasisPanel دون استيراد مكوّن واجهة. */
export type AskBasisItem = {
  systemName?: string;
  articleNumber?: number | string;
  articleId?: string;
  excerpt?: string;
  text?: string;
  href?: string;
  [key: string]: unknown;
};

export type AskStepStatus = "running" | "done";

export type AskStep = {
  id: string;
  status: AskStepStatus;
  label: string;
  data?: {
    sub?: string;
    sample?: Array<{ systemName?: string; articleNumber?: number | string }>;
  };
};

export type AskPrecedents = {
  rulings: Array<{ title: string; snippet?: string }>;
  principles: Array<{ title: string; snippet?: string }>;
};

export type AskClarify = {
  message: string;
  dimension?: string;
  options: Array<{
    id: string;
    label: string;
    query: string;
    exhaustive?: boolean;
    hint?: string;
  }>;
};

export type AskTurn = {
  id: string;
  question: string;
  steps: AskStep[];
  answer: string | null;
  mode?: "live" | "offline" | "intent" | "blocked";
  basis: AskBasisItem[] | null;
  total: number;
  coverage?: {
    answered: number;
    total: number;
    issues?: Array<{ systemName?: string; status: string }>;
  };
  clarify?: AskClarify;
  groups?: Array<{ systemName: string; count: number; table: string }>;
  disclosure?: string;
  visibleGroups?: number;
  message?: string;
  error?: string;
  precedents?: AskPrecedents;
  streaming: boolean;
  showMethod: boolean;
};

export type AskStreamEvent =
  | { type: "job"; jobId: string }
  | { type: "step"; id: string; status: AskStepStatus; label: string; data?: AskStep["data"] }
  | {
      type: "result";
      answer?: string | null;
      mode?: AskTurn["mode"];
      basis?: AskBasisItem[];
      total?: number;
      coverage?: AskTurn["coverage"];
      groups?: AskTurn["groups"];
      disclosure?: string;
      message?: string;
      precedents?: AskPrecedents;
    }
  | { type: "clarify"; message: string; dimension?: string; options?: AskClarify["options"] }
  | { type: "error"; message?: string }
  | { type: "done" };
