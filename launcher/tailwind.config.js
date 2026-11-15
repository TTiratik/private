/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg:      { DEFAULT: "#0B1020", deep: "#090D1A" },
        panel:   "#131A2B",
        line:    "rgba(255,255,255,0.06)",
        ink:     { DEFAULT: "#F2F5FA", mute: "#8A94A6" },
        accent:  { DEFAULT: "#F5731F", hi: "#FF8A2B" },
        online:  "#36C46B",
      },
      fontFamily: { sans: ["Inter", "system-ui", "sans-serif"] },
      borderRadius: { xl2: "14px" },
    },
  },
  plugins: [],
};
