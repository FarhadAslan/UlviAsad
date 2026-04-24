import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    container: {
      center: true,
      padding: {
        DEFAULT: "1.25rem",
        sm: "1.5rem",
        md: "2rem",
        lg: "2.5rem",
        xl: "3.5rem",
        "2xl": "4rem",
      },
    },
    extend: {
      colors: {
        primary:       "rgb(147,204,255)",   // #93ccff
        "primary-50":  "#f0f8ff",
        "primary-100": "#dff0ff",
        "primary-200": "#b8dfff",
        "primary-300": "rgb(147,204,255)",
        "primary-400": "#6ab8ff",
        "primary-500": "#3d9eff",
        "primary-600": "#1a7fe0",
        "btn-green":   "#1f6f43",
        "btn-green-h": "#2e8b57",
        "btn-green-l": "#e8f5ee",
        surface:       "#ffffff",
        "surface-2":   "#f8fafc",
        "surface-3":   "#f1f5f9",
        border:        "#e2e8f0",
        "border-focus":"rgb(147,204,255)",
        text:          "#0f172a",
        "text-2":      "#475569",
        "text-3":      "#94a3b8",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card:    "0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.06)",
        "card-hover": "0 4px 12px rgba(0,0,0,0.08), 0 16px 40px rgba(0,0,0,0.1)",
        btn:     "0 1px 2px rgba(31,111,67,0.2), 0 4px 12px rgba(31,111,67,0.15)",
        "btn-hover": "0 4px 16px rgba(46,139,87,0.35)",
        input:   "0 0 0 3px rgba(147,204,255,0.3)",
      },
      borderRadius: {
        DEFAULT: "12px",
        sm:  "8px",
        md:  "12px",
        lg:  "16px",
        xl:  "20px",
        "2xl": "24px",
      },
    },
  },
  plugins: [],
};
export default config;
