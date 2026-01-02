/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'neo-black': '#000000',
        'neo-metal': '#3a3a3a',
        'neo-silver': '#c0c0c0',
        'neo-chrome': '#e8e8e8',
      },
      backgroundImage: {
        'metal-texture': "url('/images/metal-plate.png')",
      },
    },
  },
  plugins: [],
}