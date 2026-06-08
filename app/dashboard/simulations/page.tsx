import { requirePagePermission } from "@/lib/modules/auth/session";

export const dynamic = "force-dynamic";

// القاضي التفاعلي مدمج داخل إطار موقع حكيم (وضع embed) — بلا ازدواج شريط جانبي
// أو انتقال إلى صفحة مستقلة. يملأ منطقة المحتوى تحت شريط حكيم العلوي والجانبي.
export default async function SimulationsPage() {
  await requirePagePermission("SIMULATIONS_USE");

  return (
    <div style={{ margin: "-28px -36px -48px", height: "calc(100vh - var(--topbar-h))" }}>
      <iframe
        title="القاضي التفاعلي — حكيم"
        src="/original-hakeem/hakim1111.html?embed=1"
        style={{ width: "100%", height: "100%", border: 0, display: "block", background: "#fff" }}
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-downloads"
      />
    </div>
  );
}
