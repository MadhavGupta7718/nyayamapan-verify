import type { Config } from "tailwindcss";

/**
 * Design tokens. Pages must use the semantic scale (text-h1, text-body, bg-surface,
 * text-fg-muted, tone colours) rather than ad-hoc values so the portal stays consistent.
 */
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f2f5fb",
          100: "#e3e9f6",
          200: "#c6d3ec",
          300: "#9db2dc",
          400: "#6d8ac7",
          500: "#4a69b1",
          600: "#375296",
          700: "#2d427a",
          800: "#243563",
          900: "#1b284b",
          950: "#111a33",
        },
        ink: {
          25: "#fbfcfd",
          50: "#f6f7f9",
          100: "#eef0f3",
          200: "#e2e5ea",
          300: "#cdd2da",
          400: "#9aa3b0",
          500: "#6b7482",
          600: "#525a67",
          700: "#3d434d",
          800: "#272b32",
          900: "#171a1f",
        },
        accent: {
          DEFAULT: "#d9731f",
          soft: "#fbeadb",
          strong: "#b35a12",
        },
        success: { 50: "#ecfdf5", 100: "#d1fae5", 200: "#a7f3d0", 500: "#10b981", 600: "#059669", 700: "#047857", 800: "#065f46" },
        warning: { 50: "#fffbeb", 100: "#fef3c7", 200: "#fde68a", 500: "#f59e0b", 600: "#d97706", 700: "#b45309", 800: "#92400e" },
        danger: { 50: "#fef2f2", 100: "#fee2e2", 200: "#fecaca", 500: "#ef4444", 600: "#dc2626", 700: "#b91c1c", 800: "#991b1b" },
        info: { 50: "#eff6ff", 100: "#dbeafe", 200: "#bfdbfe", 500: "#3b82f6", 600: "#2563eb", 700: "#1d4ed8", 800: "#1e40af" },
        surface: {
          DEFAULT: "#ffffff",
          subtle: "#f6f7f9",
          sunken: "#eef0f3",
        },
        fg: {
          DEFAULT: "#171a1f",
          muted: "#525a67",
          subtle: "#6b7482",
          faint: "#9aa3b0",
        },
        line: {
          DEFAULT: "#e2e5ea",
          strong: "#cdd2da",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "var(--font-deva)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      fontSize: {
        display: ["2.75rem", { lineHeight: "1.08", letterSpacing: "-0.03em", fontWeight: "600" }],
        h1: ["1.75rem", { lineHeight: "2.25rem", letterSpacing: "-0.02em", fontWeight: "600" }],
        h2: ["1.375rem", { lineHeight: "1.875rem", letterSpacing: "-0.015em", fontWeight: "600" }],
        h3: ["1.125rem", { lineHeight: "1.625rem", letterSpacing: "-0.01em", fontWeight: "600" }],
        h4: ["1rem", { lineHeight: "1.5rem", fontWeight: "600" }],
        body: ["0.9375rem", { lineHeight: "1.5rem" }],
        "body-sm": ["0.875rem", { lineHeight: "1.25rem" }],
        caption: ["0.75rem", { lineHeight: "1rem" }],
        label: ["0.8125rem", { lineHeight: "1.125rem", fontWeight: "500" }],
        data: ["0.875rem", { lineHeight: "1.25rem", fontWeight: "500" }],
        overline: ["0.6875rem", { lineHeight: "1rem", letterSpacing: "0.08em", fontWeight: "600" }],
      },
      spacing: {
        4.5: "1.125rem",
        13: "3.25rem",
        15: "3.75rem",
        18: "4.5rem",
        sidebar: "15.5rem",
      },
      borderRadius: {
        sm: "0.375rem",
        md: "0.5rem",
        lg: "0.625rem",
        xl: "0.875rem",
        "2xl": "1.125rem",
      },
      boxShadow: {
        xs: "0 1px 2px rgba(23, 26, 31, 0.05)",
        sm: "0 1px 3px rgba(23, 26, 31, 0.06), 0 1px 2px rgba(23, 26, 31, 0.04)",
        md: "0 4px 12px -2px rgba(23, 26, 31, 0.08), 0 2px 4px -2px rgba(23, 26, 31, 0.04)",
        lg: "0 12px 32px -8px rgba(23, 26, 31, 0.14), 0 4px 8px -4px rgba(23, 26, 31, 0.06)",
        overlay: "0 24px 64px -12px rgba(17, 26, 51, 0.28)",
        focus: "0 0 0 3px rgba(74, 105, 177, 0.28)",
      },
      transitionTimingFunction: {
        out: "cubic-bezier(0.22, 1, 0.36, 1)",
      },
      keyframes: {
        "fade-in": { from: { opacity: "0" }, to: { opacity: "1" } },
        "fade-up": {
          from: { opacity: "0", transform: "translateY(6px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "scale-in": {
          from: { opacity: "0", transform: "scale(0.97)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
        "slide-in-right": { from: { transform: "translateX(100%)" }, to: { transform: "translateX(0)" } },
        "slide-in-left": { from: { transform: "translateX(-100%)" }, to: { transform: "translateX(0)" } },
        shimmer: { "0%": { backgroundPosition: "-400px 0" }, "100%": { backgroundPosition: "400px 0" } },
        float: {
          "0%, 100%": { transform: "translateY(0) rotateX(12deg) rotateY(-18deg)" },
          "50%": { transform: "translateY(-10px) rotateX(10deg) rotateY(-14deg)" },
        },
        "spin-slow": { to: { transform: "rotate(360deg)" } },
        "progress-indeterminate": {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(250%)" },
        },
        "check-draw": { from: { strokeDashoffset: "48" }, to: { strokeDashoffset: "0" } },
        "ring-pulse": {
          "0%": { transform: "scale(0.9)", opacity: "0.7" },
          "100%": { transform: "scale(1.6)", opacity: "0" },
        },
      },
      animation: {
        "fade-in": "fade-in 180ms ease-out both",
        "fade-up": "fade-up 260ms cubic-bezier(0.22, 1, 0.36, 1) both",
        "scale-in": "scale-in 180ms cubic-bezier(0.22, 1, 0.36, 1) both",
        "slide-in-right": "slide-in-right 260ms cubic-bezier(0.22, 1, 0.36, 1) both",
        "slide-in-left": "slide-in-left 260ms cubic-bezier(0.22, 1, 0.36, 1) both",
        shimmer: "shimmer 1.4s linear infinite",
        float: "float 7s ease-in-out infinite",
        "spin-slow": "spin-slow 40s linear infinite",
        "progress-indeterminate": "progress-indeterminate 1.1s ease-in-out infinite",
        "check-draw": "check-draw 420ms 120ms cubic-bezier(0.65, 0, 0.35, 1) both",
        "ring-pulse": "ring-pulse 1.6s ease-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
