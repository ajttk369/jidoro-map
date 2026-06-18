import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        jidoro: {
          blue: "#2563EB",
          green: "#10B981",
          ink: "#111827",
          muted: "#6B7280",
          line: "#E5E7EB",
          surface: "#F8FAFC"
        }
      },
      boxShadow: {
        panel: "0 12px 30px rgba(15, 23, 42, 0.08)"
      }
    }
  },
  plugins: []
};

export default config;
