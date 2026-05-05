/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--gp-black)",
        foreground: "var(--gp-white)",
        gp: {
          black: "var(--gp-black)",
          dark: "var(--gp-dark)",
          card: "var(--gp-card)",
          border: "var(--gp-border)",
          green: "var(--gp-green)",
          "green-dark": "var(--gp-green-dark)",
          "green-light": "var(--gp-green-light)",
          white: "var(--gp-white)",
          gray: "var(--gp-gray)",
          "gray-dark": "var(--gp-gray-dark)",
          red: "var(--gp-red)",
        },
      },
      animation: {
        "fade-in-up": "fadeInUp 0.5s ease-out forwards",
        "shimmer": "shimmer 1.5s infinite",
      },
    },
  },
  plugins: [],
};
