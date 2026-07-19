"use client";

// JS-005 — استخلاص خريطة القضية من المرفقات ثم **تثبيتها بمراجعة القاضي** (human-in-the-loop).
// الاقتراح لا يُحفظ تلقائيًّا؛ القاضي يحذف ما لا يلزم ثم «يثبّت». الوقائع «مُدّعاة» حتى تُحسم.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { JaIcon } from "./icons";
import { FACT_STATUS_LABEL } from "@/lib/modules/judicial-assistant/labels";
import type { MapProposal } from "@/lib/modules/judicial-assistant/extract-map";

type Keep = { parties: Set<string>; requests: Set<string>; facts: Set<string>; issues: Set<string> };

export function MapExtractor({ caseId, hasMap }: { caseId: string; hasMap: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [proposal, setProposal] = useState<MapProposal | null>(null);
  const [keep, setKeep] = useState<Keep>({ parties: new Set(), requests: new Set(), facts: new Set(), issues: new Set() });

  async function extract() {
    setBusy(true); setError(""); setProposal(null);
    try {
      const res = await fetch(`/api/judicial-assistant/cases/${caseId}/extract-map`, { method: "POST" });
      const data = (await res.json()) as MapProposal & { message?: string };
      if (!res.ok) throw new Error(data?.message || "تعذّر الاستخلاص.");
      setProposal(data);
      setKeep({
        parties: new Set(data.parties.map((p) => p.id)),
        requests: new Set(data.requests.map((r) => r.id)),
        facts: new Set(data.facts.map((f) => f.id)),
        issues: new Set(data.issues.map((i) => i.id)),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذّر الاستخلاص.");
    } finally {
      setBusy(false);
    }
  }

  function toggle(group: keyof Keep, id: string) {
    setKeep((k) => {
      const next = new Set(k[group]);
      if (next.has(id)) next.delete(id); else next.add(id);
      return { ...k, [group]: next };
    });
  }

  async function confirm() {
    if (!proposal) return;
    setBusy(true); setError("");
    try {
      const body = {
        parties: proposal.parties.filter((p) => keep.parties.has(p.id)),
        requests: proposal.requests.filter((r) => keep.requests.has(r.id)),
        facts: proposal.facts.filter((f) => keep.facts.has(f.id)),
        issues: proposal.issues.filter((i) => keep.issues.has(i.id)),
      };
      const res = await fetch(`/api/judicial-assistant/cases/${caseId}/map`, {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || "تعذّر الحفظ.");
      setProposal(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذّر الحفظ.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="ja-mapx">
      <div className="ja-panel__row">
        <div>
          <h3 className="ja-mapx__title"><JaIcon name="map" size={17} /> استخلاص الخريطة من المرفقات <span className="ja-action__id">JS-005</span></h3>
          <p className="ja-panel__hint">يقترح النظام أطرافًا ووقائع ومسائل من نصّ مرفقاتك؛ تراجعها وتثبّتها. لا يُحفظ إلا ما تختاره.</p>
        </div>
        <button type="button" className="btn btn-gold" onClick={() => void extract()} disabled={busy}>
          {busy ? "جارٍ…" : hasMap ? "إعادة الاستخلاص" : "استخلاص الخريطة"}
        </button>
      </div>

      {error ? <div className="ja-alert ja-alert--danger">{error}</div> : null}

      {proposal ? (
        proposal.blocked ? (
          <div className="ja-alert ja-alert--danger">{proposal.note}</div>
        ) : (
          <div className="ja-mapx__review">
            <div className="ja-summary__banner"><JaIcon name="quality" size={15} /><span>{proposal.note}</span></div>

            <Group title="الأطراف" items={proposal.parties.map((p) => ({ id: p.id, label: `${p.role}: ${p.name}` }))} kept={keep.parties} onToggle={(id) => toggle("parties", id)} />
            <Group title="الطلبات" items={proposal.requests.map((r) => ({ id: r.id, label: r.text }))} kept={keep.requests} onToggle={(id) => toggle("requests", id)} />
            <Group title="الوقائع" items={proposal.facts.map((f) => ({ id: f.id, label: `(${FACT_STATUS_LABEL[f.status]}) ${f.text}` }))} kept={keep.facts} onToggle={(id) => toggle("facts", id)} />
            <Group title="المسائل" items={proposal.issues.map((i) => ({ id: i.id, label: i.statement }))} kept={keep.issues} onToggle={(id) => toggle("issues", id)} />

            <div className="ja-formactions">
              <button type="button" className="btn btn-gold" onClick={() => void confirm()} disabled={busy}>تثبيت الخريطة</button>
              <button type="button" className="btn btn-outline" onClick={() => setProposal(null)} disabled={busy}>إلغاء</button>
            </div>
          </div>
        )
      ) : null}
    </div>
  );
}

function Group({ title, items, kept, onToggle }: { title: string; items: Array<{ id: string; label: string }>; kept: Set<string>; onToggle: (id: string) => void }) {
  if (items.length === 0) return null;
  return (
    <div className="ja-mapx__group">
      <h4>{title} <span className="ja-mapx__count">{items.filter((i) => kept.has(i.id)).length}/{items.length}</span></h4>
      <ul>
        {items.map((it) => (
          <li key={it.id}>
            <label className={`ja-mapx__item ${kept.has(it.id) ? "" : "ja-mapx__item--off"}`}>
              <input type="checkbox" checked={kept.has(it.id)} onChange={() => onToggle(it.id)} />
              <span>{it.label}</span>
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}
