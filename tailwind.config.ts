import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      // ── Color palette (matched exactly to tripforge-prototype.jsx) ──
      colors: {
        // Rust / terracotta — primary brand color
        rust: {
          DEFAULT: "#B85C30",
          light: "#D4743E",
          dark: "#8B3E1C",
        },
        // Parchment — main background & card surfaces
        parchment: {
          DEFAULT: "#F5EDD9",
          dark: "#EAD9BC",
          deep: "#D9C49A",
        },
        // Ink — text hierarchy
        ink: {
          DEFAULT: "#1C1208",
          light: "#3D2B14",
          mid: "#6B4C2A",
        },
        // Forest — success / nature accents
        forest: {
          DEFAULT: "#2E5E35",
          light: "#4A8A54",
        },
        // Supporting palette
        sage: "#8FAF7E",
        sky: "#4A7C9E",
        cream: "#FAF6EE",
        muted: "#9A8570",
      },

      // ── Typography ──
      fontFamily: {
        sans: ["DM Sans", "system-ui", "sans-serif"],
        serif: ["Cormorant Garamond", "Georgia", "serif"],
      },

      // ── Border radius — rounded feel throughout ──
      borderRadius: {
        DEFAULT: "0.75rem",
        sm: "0.5rem",
        md: "0.75rem",
        lg: "1rem",
        xl: "1.25rem",
        "2xl": "1.5rem",
        full: "9999px",
      },

      // ── Spacing scale extension ──
      spacing: {
        "4.5": "1.125rem",
        "13": "3.25rem",
        "15": "3.75rem",
        "18": "4.5rem",
        "22": "5.5rem",
        "26": "6.5rem",
      },

      // ── Box shadows — warm, soft ──
      boxShadow: {
        card: "0 2px 12px rgba(28, 18, 8, 0.08)",
        "card-hover": "0 4px 20px rgba(28, 18, 8, 0.12)",
        nav: "0 1px 0 rgba(28, 18, 8, 0.06)",
        "nav-bottom": "0 -1px 0 rgba(28, 18, 8, 0.06), 0 -4px 12px rgba(28, 18, 8, 0.04)",
      },

      // ── Animation ──
      keyframes: {
        fadeUp: {
          from: { opacity: "0", transform: "translateY(12px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        fadeIn: {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
      animation: {
        "fade-up": "fadeUp 0.5s ease forwards",
        "fade-in": "fadeIn 0.3s ease forwards",
        shimmer: "shimmer 1.5s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
