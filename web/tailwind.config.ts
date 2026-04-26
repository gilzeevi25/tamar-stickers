import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        cream: "#FFF9F2",
        coral: "#FF6B6B",
        mint: "#4ECDC4",
        sun: "#FFE66D",
        ink: "#2D3047",
      },
      fontFamily: {
        heebo: ["var(--font-heebo)", "system-ui", "sans-serif"],
        rubik: ["var(--font-rubik)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        toy: "0 12px 32px -8px rgba(45, 48, 71, 0.15)",
        "toy-lg": "0 20px 48px -12px rgba(45, 48, 71, 0.22)",
      },
      borderRadius: {
        toy: "32px",
      },
      keyframes: {
        breathe: {
          "0%, 100%": { transform: "scale(1)" },
          "50%": { transform: "scale(1.05)" },
        },
        "pulse-ring": {
          "0%": { transform: "scale(1)", opacity: "0.6" },
          "100%": { transform: "scale(1.6)", opacity: "0" },
        },
        drift: {
          "0%": { transform: "translateY(0) translateX(0)", opacity: "0" },
          "20%": { opacity: "1" },
          "100%": {
            transform: "translateY(-120px) translateX(var(--drift-x, 0))",
            opacity: "0",
          },
        },
      },
      animation: {
        breathe: "breathe 2s ease-in-out infinite",
        "pulse-ring": "pulse-ring 1.6s ease-out infinite",
        drift: "drift 3s linear infinite",
      },
    },
  },
  plugins: [],
};

export default config;
