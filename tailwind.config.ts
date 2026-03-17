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
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        background:   "var(--background)",
        foreground:   "var(--foreground)",
        surface:      "var(--surface)",
        "surface-2":  "var(--surface-2)",
        border:       "var(--border)",
        muted: {
          DEFAULT:     "var(--muted)",
          foreground:  "var(--muted-foreground)",
        },
        primary: {
          DEFAULT:     "var(--primary)",
          light:       "var(--primary-light)",
          foreground:  "var(--primary-foreground)",
        },
        secondary: {
          DEFAULT:     "var(--secondary)",
          foreground:  "var(--secondary-foreground)",
        },
        accent: {
          DEFAULT:     "var(--accent)",
        },
        success: {
          DEFAULT:     "var(--success)",
          foreground:  "var(--success-foreground)",
        },
        destructive: {
          DEFAULT:     "var(--destructive)",
          foreground:  "var(--destructive-foreground)",
        },
        warning: {
          DEFAULT:     "var(--warning)",
        },
        sidebar: {
          bg:          "var(--sidebar-bg)",
          active:      "var(--sidebar-active)",
          border:      "var(--sidebar-border)",
        },
      },
      borderRadius: {
        xl:  "12px",
        "2xl": "16px",
        "3xl": "20px",
      },
      boxShadow: {
        "glow-blue":  "0 0 20px var(--primary-glow), 0 0 60px var(--primary-glow)",
        "glow-sm":    "0 0 10px var(--primary-glow)",
        "card":       "0 4px 24px rgba(0, 0, 0, 0.08)",
        "card-hover": "0 8px 40px rgba(0, 0, 0, 0.12)",
      },
      backgroundImage: {
        "gradient-primary": "linear-gradient(135deg, var(--primary), var(--secondary))",
        "gradient-blue":    "linear-gradient(135deg, #2563EB, #7C3AED)",
        "gradient-surface": "var(--card-gradient)",
      },
      animation: {
        "fade-in":    "fadeIn 0.3s ease",
        "slide-up":   "slideUp 0.3s ease",
        "pulse-glow": "pulseGlow 2s ease-in-out infinite",
      },
      keyframes: {
        fadeIn:    { "0%": { opacity: "0" }, "100%": { opacity: "1" } },
        slideUp:   { "0%": { opacity: "0", transform: "translateY(8px)" }, "100%": { opacity: "1", transform: "translateY(0)" } },
        pulseGlow: { "0%, 100%": { opacity: "1" }, "50%": { opacity: "0.4" } },
      },
    },
  },
  safelist: [
    // PhotoAvatar size classes
    'w-9','h-9','w-16','h-16','w-24','h-24','w-32','h-32',
    'text-sm','text-xl','text-3xl','text-4xl',
    'ring-2','ring-[3px]',
  ],
  plugins: [],
};
export default config;
