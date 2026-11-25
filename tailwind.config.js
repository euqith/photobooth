/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/renderer/**/*.{js,ts,jsx,tsx,html}",
    "./index.html"
  ],
  theme: {
    extend: {
      colors: {
        booth: {
          dark: "#0F1117",
          panel: "#1A1D27",
          accent: "#FF3366",
          gold: "#FFB800",
          cyan: "#00E5FF"
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Poppins', 'system-ui', 'sans-serif']
      }
    },
  },
  plugins: [],
};
