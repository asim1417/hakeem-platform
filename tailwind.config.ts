import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        // هوية حكيم الرسمية (HKM.ID): بترولي (مؤسسة) · نحاسي (فعل) · عاجيّ/سطح (محتوى).
        // كل الأسماء أُعيد توجيهها للوحة الهوية كي تتبدّل كل الصفحات دفعةً واحدة.
        ink: "#12211F",
        sand: "#EFF3F2", // خلفية الصفحة → surface
        gold: "#C69763", // النحاسي
        olive: "#0E3435", // → بترولي (المؤسسة)
        navy: "#0E3435", // بترولي
        "navy-mid": "#1F4F4C",
        "gold-light": "#D4AF6E",
        paper: "#FBFAF6", // العاجيّ (بطاقات)
        cream: "#EAF1EF", // نصّ فاتح فوق البترولي
        surface: "#EFF3F2",
        // ألوان الهوية الصريحة (للاستخدام المباشر في المكوّنات الجديدة)
        petrol: "#0E3435",
        "petrol-600": "#1F4F4C",
        copper: "#C69763",
        "copper-deep": "#A9793F",
        "copper-soft": "#E8D6BC",
        ivory: "#FBFAF6",
        line: "#CAD6D3",
        muted: "#5C6E6B",
        success: "#15803D",
        danger: "#DC2626",
        warning: "#B8721A"
      },
      fontFamily: {
        sans: ['"IBM Plex Sans Arabic"', "Tahoma", "Arial", "sans-serif"],
        judicial: ['"Amiri"', '"Times New Roman"', "serif"],
        mono: ['"IBM Plex Mono"', "ui-monospace", "monospace"]
      }
    }
  },
  plugins: []
};

export default config;
