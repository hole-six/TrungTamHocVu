import type { Config } from "tailwindcss";

// Design tokens rút từ DESIGN.md (Apple-design-analysis) — áp dụng cho giao diện
// quản trị: 1 màu nhấn duy nhất, bảng màu sáng/tối, chữ SF Pro (Inter thay thế),
// bo góc theo thang pill/lg/sm, không dùng gradient trang trí.
const config: Config = {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#0066cc",
          focus: "#0071e3",
          onDark: "#2997ff",
        },
        ink: {
          DEFAULT: "#1d1d1f",
          muted80: "#333333",
          muted48: "#7a7a7a",
        },
        canvas: {
          DEFAULT: "#ffffff",
          parchment: "#f5f5f7",
          pearl: "#fafafc",
        },
        tile: {
          1: "#272729",
          2: "#2a2a2c",
          3: "#252527",
        },
        hairline: "#e0e0e0",
        divider: "#f0f0f0",
        // Status semantic aliases
        success: {
          DEFAULT: "#10b981",
          bg: "#ecfdf5",
          text: "#047857",
        },
        warning: {
          DEFAULT: "#f59e0b",
          bg: "#fffbeb",
          text: "#92400e",
        },
        danger: {
          DEFAULT: "#ef4444",
          bg: "#fef2f2",
          text: "#b91c1c",
        },
      },
      fontFamily: {
        display: ["var(--font-inter)", "SF Pro Display", "system-ui", "-apple-system", "sans-serif"],
        text: ["var(--font-inter)", "SF Pro Text", "system-ui", "-apple-system", "sans-serif"],
      },
      borderRadius: {
        xs: "5px",
        sm: "8px",
        md: "11px",
        lg: "18px",
      },
      spacing: {
        "4.25": "17px",
        section: "80px",
      },
      boxShadow: {
        product: "3px 5px 30px 0 rgba(0, 0, 0, 0.22)",
      },
    },
  },
  plugins: [require("@tailwindcss/forms")],
};

export default config;
