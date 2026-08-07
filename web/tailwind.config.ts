import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        anthracite: "#0a0a0a",
        surface: {
          DEFAULT: "#131313",
          dim: "#131313",
          bright: "#3a3939",
          card: "#121212",
          "container-lowest": "#0e0e0e",
          "container-low": "#1c1b1b",
          container: "#201f1f",
          "container-high": "#2a2a2a",
          "container-highest": "#353534",
          variant: "#353534",
        },
        "on-surface": {
          DEFAULT: "#e5e2e1",
          variant: "#d1c1d9",
        },
        outline: {
          DEFAULT: "#9a8ca2",
          variant: "#4e4356",
        },
        electric: {
          DEFAULT: "#9D00FF",
          soft: "#dfb7ff",
          deep: "#4b007e",
        },
        cyan: {
          neon: "#00F0FF",
          soft: "#00eefc",
          dim: "#00dbe9",
        },
        neon: {
          green: "#39FF14",
          success: "#2ae500",
        },
        crimson: "#FF003C",
        primary: {
          DEFAULT: "#dfb7ff",
          container: "#9d00ff",
          fixed: "#f1daff",
        },
        secondary: {
          DEFAULT: "#d3fbff",
          container: "#00eefc",
          "fixed-dim": "#00dbe9",
        },
        tertiary: {
          DEFAULT: "#2ae500",
          fixed: "#79ff5b",
          container: "#137b00",
        },
        error: {
          DEFAULT: "#ffb4ab",
          container: "#93000a",
          bright: "#FF003C",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "Inter", "system-ui", "sans-serif"],
        mono: ["var(--font-space-mono)", "Space Mono", "ui-monospace", "monospace"],
      },
      fontSize: {
        "data-lg": ["20px", { lineHeight: "1.2", fontWeight: "700" }],
        "data-sm": [
          "13px",
          { lineHeight: "1.5", letterSpacing: "0.05em", fontWeight: "400" },
        ],
        "headline-lg": [
          "48px",
          { lineHeight: "1.1", letterSpacing: "-0.02em", fontWeight: "700" },
        ],
        "headline-lg-mobile": [
          "32px",
          { lineHeight: "1.2", fontWeight: "700" },
        ],
        "headline-md": ["24px", { lineHeight: "1.3", fontWeight: "600" }],
        "label-caps": [
          "11px",
          { lineHeight: "1", letterSpacing: "0.1em", fontWeight: "700" },
        ],
        "body-md": ["16px", { lineHeight: "1.6", fontWeight: "400" }],
      },
      spacing: {
        "margin-mobile": "16px",
        "margin-desktop": "32px",
        gutter: "16px",
      },
      maxWidth: {
        "container-max": "1440px",
      },
      borderRadius: {
        none: "0",
      },
      boxShadow: {
        "glow-cyan": "0 0 10px #00F0FF",
        "glow-cyan-sm": "0 0 8px rgba(0, 238, 252, 0.4)",
        "glow-purple": "0 0 8px rgba(157, 0, 255, 0.4)",
        "glow-green": "0 0 8px rgba(42, 229, 0, 0.4)",
      },
    },
  },
  plugins: [],
};
export default config;
