// ─────────────────────────────────────────────────────────────────────────────
// مُغلّف توليد مع **إكمال تلقائي** — يعالج بتر المخرجات الطويلة جدًّا (> سقف نداء واحد).
// إن بدا النصّ مبتورًا (ينتهي وسط كلمة/جملة لا بعلامة ختام) يطلب إكمالًا ويصله، بحدّ جولات.
// آمن: أي تعذّر يعيد ما تجمّع. لا يلمس النواة ولا الأمن.
// ─────────────────────────────────────────────────────────────────────────────
import { callCentralProvider } from "@/lib/modules/ai/ai-gateway";

export interface GenerateResult {
  ok: boolean;
  content: string;
  mode: "server" | "offline";
  provider: string;
  rounds: number; // عدد جولات الإكمال المستخدمة (0 = اكتمل من النداء الأول)
}

/** يبدو مبتورًا إن انتهى بحرف/رقم (وسط كلمة/جملة) لا بعلامة ختام أو مُغلِق. */
export function looksTruncated(text: string): boolean {
  const t = text.trimEnd();
  if (!t) return false;
  const last = t[t.length - 1];
  return /[؀-ۿA-Za-z0-9]/.test(last);
}

/**
 * يولّد نصًّا كاملاً: نداء أول، ثم جولات إكمال عند البتر (بحدّ maxRounds). يمرّر ذيل
 * النصّ المُنجَز كمرساة للإكمال دون تكرار. السقوط offline/الفشل يعيد ما تجمّع بصدق.
 */
export async function generateComplete(
  system: string,
  user: string,
  opts: { maxTokens?: number; maxRounds?: number } = {}
): Promise<GenerateResult> {
  const maxTokens = opts.maxTokens ?? 6000;
  const maxRounds = opts.maxRounds ?? 2;

  const first = await callCentralProvider({ systemPrompt: system, userPrompt: user, maxTokens }).catch(() => null);
  if (!first || !first.ok || first.mode !== "server" || !first.content.trim()) {
    return { ok: false, content: first?.content ?? "", mode: first?.mode ?? "offline", provider: first?.provider ?? "offline", rounds: 0 };
  }

  let acc = first.content.trim();
  let rounds = 0;
  while (rounds < maxRounds && looksTruncated(acc)) {
    rounds += 1;
    const cont = await callCentralProvider({
      systemPrompt: system,
      userPrompt: `${user}\n\n— النصّ المُنجَز حتى الآن (آخره فقط للمرجع):\n${acc.slice(-1600)}\n\nأكمِل **مباشرةً** من حيث توقفت، دون تكرار ما سبق ولا إعادة العناوين، واختِم بخلاصة.`,
      maxTokens,
    }).catch(() => null);
    if (!cont || !cont.ok || cont.mode !== "server" || !cont.content.trim()) break;
    acc = `${acc} ${cont.content.trim()}`.trim();
  }

  return { ok: true, content: acc, mode: "server", provider: first.provider, rounds };
}
