import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#07110d",
        panel: "#0d1a13",
        panel2: "#101f17",
        line: "#22392c",
        ink: "#f6f1e7",
        muted: "#93a49a",
        gold: "#e1ba70",
        goldDark: "#c9a24c",
        green: "#7fbf95",
        amber: "#d7a64b",
        red: "#e27b78",
      },
      borderRadius: {
        xl2: "20px",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
