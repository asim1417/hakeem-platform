/** هل مفاتيح Clerk مضبوطة؟ بدونه لا يعمل مسار المصادقة الجديد. */
export function isClerkConfigured(): boolean {
  return Boolean(
    (process.env.CLERK_SECRET_KEY || "").trim() &&
      (process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || "").trim()
  );
}

/** مظهر Clerk بهوية حكيم (بترولي / نحاسي) — لا الأخضر الافتراضي. */
export const clerkAppearance = {
  variables: {
    colorPrimary: "#0E3435",
    colorBackground: "#F9F5EC",
    colorText: "#0E3435",
    colorInputBackground: "#FFFaf3",
    colorInputText: "#0E3435",
    borderRadius: "0.5rem",
    fontFamily: "IBM Plex Sans Arabic, Tahoma, sans-serif",
  },
  elements: {
    card: "border border-[#C69763]/30 shadow-none",
    formButtonPrimary: "bg-[#0E3435] hover:bg-[#164849]",
    footerActionLink: "text-[#C69763]",
    headerTitle: "text-[#0E3435]",
    headerSubtitle: "text-[#0E3435]/70",
  },
} as const;
