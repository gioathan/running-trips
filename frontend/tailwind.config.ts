import type { Config } from "tailwindcss";

// Tokens transcribed from docs/DESIGN_SYSTEM.md — that file is the source
// of truth; keep this in sync if the palette/type scale changes there.
const config: Config = {
  darkMode: ["class"],
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "#E6E6E6",
        surface: "#FFFFFF",
        "surface-low": "#F4F3F3",
        "surface-dim": "#DADADA",
        ink: "#14161A",
        "ink-muted": "#5C6068",
        primary: "#D686EA",
        accent: "#D4FF3F",
        error: "#BA1A1A",
        "error-container": "#FFDAD6",
        "footer-bg": "#14161A",
        "footer-fg": "#F1F1F1",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "Inter", "sans-serif"],
      },
      fontSize: {
        "headline-xl": ["56px", { lineHeight: "60px", letterSpacing: "-0.03em", fontWeight: "800" }],
        "headline-xl-mobile": ["38px", { lineHeight: "42px", letterSpacing: "-0.025em", fontWeight: "800" }],
        "headline-lg": ["36px", { lineHeight: "40px", letterSpacing: "-0.02em", fontWeight: "800" }],
        "headline-lg-mobile": ["28px", { lineHeight: "32px", letterSpacing: "-0.02em", fontWeight: "800" }],
        "headline-md": ["24px", { lineHeight: "30px", letterSpacing: "-0.015em", fontWeight: "700" }],
        "headline-sm": ["18px", { lineHeight: "24px", letterSpacing: "-0.01em", fontWeight: "700" }],
        "body-lg": ["16px", { lineHeight: "24px" }],
        "body-md": ["14px", { lineHeight: "20px" }],
        "body-sm": ["12px", { lineHeight: "16px" }],
        "label-lg": ["13px", { lineHeight: "16px", letterSpacing: "0.12em", fontWeight: "700" }],
        "label-md": ["11px", { lineHeight: "14px", letterSpacing: "0.14em", fontWeight: "700" }],
        "label-sm": ["10px", { lineHeight: "12px", letterSpacing: "0.16em", fontWeight: "700" }],
        "metric-display": ["48px", { lineHeight: "48px", letterSpacing: "-0.04em", fontWeight: "800" }],
      },
      borderRadius: {
        sm: "2px",
        DEFAULT: "4px",
        md: "10px",
        lg: "8px",
        xl: "12px",
        full: "9999px",
      },
      spacing: {
        xs: "4px",
        sm: "8px",
        md: "16px",
        lg: "24px",
        xl: "40px",
      },
      boxShadow: {
        hard: "2px 2px 0 0 #14161A",
      },
    },
  },
  plugins: [],
};

export default config;
