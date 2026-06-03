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
        ink: "#111827",
        sand: "#f7f5ef",
        gold: "#b7892d",
        olive: "#274236"
      },
      fontFamily: {
        sans: ["Tahoma", "Arial", "sans-serif"]
      }
    }
  },
  plugins: []
};

export default config;
