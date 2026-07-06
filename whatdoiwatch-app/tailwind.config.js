/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}", "./App.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        canvas: "#000000",
        tile: { DEFAULT: "#181818", deep: "#141414" },
        panel: { DEFAULT: "#0F1011", raised: "#1C1C1F" },
        border: { DEFAULT: "#28282C", tile: "#333333" },
        ink: {
          DEFAULT: "#FFFFFF",
          secondary: "#B3B3B3",
          tertiary: "#8A8F98",
        },
        accent: { DEFAULT: "#E50914", hover: "#C11119" },
        success: "#27A644",
        warning: "#F0BF00",
        overlay: "rgba(0,0,0,0.64)",
      },
    },
  },
  plugins: [],
};
