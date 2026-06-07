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
        // هوية حكيم الموحّدة: قاعدة بيضاء + كحلي قضائي + ذهبي محدود.
        // الأسماء القديمة (olive/sand/gold/ink) أُعيد توجيهها للهوية الجديدة
        // كي تتبدّل كل الصفحات القائمة دفعةً واحدة دون لمس الـ markup.
        ink: "#0D1321",
        sand: "#F8FAF9", // قاعدة ناعمة شبه بيضاء (كانت كريمية)
        gold: "#C09B5A",
        olive: "#0B1F3A", // أُعيد توجيهه إلى الكحلي (الهوية الأساسية)
        // الأسماء الجديدة الصريحة من نظام التصميم
        navy: "#0B1F3A",
        "navy-mid": "#142D52",
        "gold-light": "#D4AF6E",
        paper: "#FBF8F1",
        cream: "#F9F5EC",
        surface: "#FFFFFF",
        success: "#1A5C41",
        danger: "#8C2233",
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
