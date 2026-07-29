"use client";

import { useEffect, useState } from "react";

type Data = {
  enabled: boolean;
  unknown?: boolean;
  prices: Array<{ serviceCode: string; name: string; milliUnits: number; unitSize: number; active: boolean }>;
  packages: Array<{ code: string; name: string; unitsMilli: number; priceHalalas: number; active: boolean }>;
  accounts: Array<{
    userId: string;
    name: string;
    email: string;
    balanceMilliUnits: number;
    reservedMilliUnits: number;
  }>;
};

export function UsageCreditsAdmin() {
  const [data, setData] = useState<Data | null>(null);
  const [message, setMessage] = useState("");
  const load = () =>
    fetch("/api/admin/usage-credits", { cache: "no-store" })
      .then((response) => response.json())
      .then(setData)
      .catch(() => setData({ enabled: false, unknown: true, prices: [], packages: [], accounts: [] }));

  useEffect(() => {
    void load();
  }, []);

  async function mutate(payload: Record<string, unknown>) {
    const response = await fetch("/api/admin/usage-credits", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = await response.json().catch(() => ({}));
    setMessage(response.ok ? "تم الحفظ في سجل التدقيق." : body.message ?? "تعذر الحفظ.");
    if (response.ok) await load();
  }

  if (!data) return <p className="mt-6 text-sm text-[rgba(14,52,53,0.55)]">جارٍ تحميل وحدات الاستخدام…</p>;
  return (
    <section className="mt-6 rounded-[0.75rem] border border-[rgba(14,52,53,0.1)] bg-[#FFFCF7] p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-[#0E3435]">وحدات الاستخدام v2</h2>
          <p className="mt-1 text-sm text-[rgba(14,52,53,0.6)]">
            Ledger ذري، حجوزات مؤقتة، وأسعار كسرية. نقاط الولاء القديمة لا تتغير.
          </p>
        </div>
        <button
          type="button"
          onClick={() => mutate({ action: "toggle", enabled: !data.enabled })}
          className="rounded-md bg-[#0E3435] px-4 py-2 text-sm font-semibold text-white"
        >
          {data.enabled ? "إيقاف الخصم v2" : "تفعيل الخصم v2"}
        </button>
      </div>
      {data.unknown ? (
        <p className="mt-4 rounded-md bg-amber-50 p-3 text-sm text-amber-900">
          الهجرة غير مطبقة بعد؛ النظام القديم مستمر دون تعطيل.
        </p>
      ) : null}
      {message ? <p className="mt-4 rounded-md bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p> : null}

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <div>
          <h3 className="font-bold text-[#0E3435]">الأسعار</h3>
          <div className="mt-3 space-y-2">
            {data.prices.map((price) => (
              <form
                key={price.serviceCode}
                className="grid gap-2 rounded-md border bg-white p-3 text-sm sm:grid-cols-[1fr_100px_80px_auto]"
                onSubmit={(event) => {
                  event.preventDefault();
                  const form = new FormData(event.currentTarget);
                  void mutate({
                    action: "price",
                    serviceCode: price.serviceCode,
                    milliUnits: Math.round(Number(form.get("units")) * 1000),
                    unitSize: Number(form.get("unitSize")),
                    active: true,
                  });
                }}
              >
                <span>{price.name}</span>
                <input name="units" type="number" min="0" step="0.001" defaultValue={price.milliUnits / 1000} className="rounded border p-1" aria-label={`سعر ${price.name}`} />
                <input name="unitSize" type="number" min="1" step="1" defaultValue={price.unitSize} className="rounded border p-1" aria-label={`حجم وحدة ${price.name}`} />
                <button className="rounded bg-[#0E3435] px-2 py-1 text-white">حفظ</button>
              </form>
            ))}
          </div>
        </div>
        <form
          className="rounded-md border bg-white p-4"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            void mutate({
              action: "adjust",
              userId: form.get("userId"),
              milliUnits: Math.round(Number(form.get("units")) * 1000),
              reason: form.get("reason"),
              idempotencyKey: crypto.randomUUID(),
            });
          }}
        >
          <h3 className="font-bold text-[#0E3435]">منح أو سحب وحدات</h3>
          <select name="userId" required className="mt-3 w-full rounded-md border p-2">
            {data.accounts.map((account) => (
              <option key={account.userId} value={account.userId}>
                {account.name} — {account.email}
              </option>
            ))}
          </select>
          <input name="units" required type="number" step="0.001" placeholder="موجب للمنح، سالب للسحب" className="mt-3 w-full rounded-md border p-2" />
          <textarea name="reason" required minLength={5} placeholder="سبب التعديل" className="mt-3 w-full rounded-md border p-2" />
          <button className="mt-3 rounded-md bg-[#8B6914] px-4 py-2 text-sm font-semibold text-white">
            تسجيل التعديل
          </button>
        </form>
      </div>
      <form
        className="mt-5 grid gap-2 rounded-md border bg-white p-4 md:grid-cols-5"
        onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          void mutate({
            action: "package",
            code: form.get("code"),
            name: form.get("name"),
            unitsMilli: Math.round(Number(form.get("units")) * 1000),
            priceHalalas: Math.round(Number(form.get("price")) * 100),
            active: true,
          });
        }}
      >
        <input name="code" required placeholder="رمز الباقة" className="rounded-md border p-2" />
        <input name="name" required placeholder="اسم الباقة" className="rounded-md border p-2" />
        <input name="units" required type="number" min="0.001" step="0.001" placeholder="الوحدات" className="rounded-md border p-2" />
        <input name="price" required type="number" min="0" step="0.01" placeholder="السعر بالريال" className="rounded-md border p-2" />
        <button className="rounded-md bg-[#8B6914] px-3 py-2 font-semibold text-white">حفظ الباقة</button>
        {data.packages.length ? (
          <p className="text-xs text-[rgba(14,52,53,0.55)] md:col-span-5">
            الباقات المحفوظة: {data.packages.map((item) => item.name).join("، ")}
          </p>
        ) : null}
      </form>
    </section>
  );
}
