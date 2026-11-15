/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        palette: {
          slate: '#c2b2b4',     // Pale Slate
          grape: '#6b4e71',     // Vintage Grape
          charcoal: '#3a4454',  // Charcoal Blue
          blueslate: '#53687e', // Blue Slate
          blush: '#f5dddd',     // Soft Blush
        },
      },
      animation: {
        'pulse-fast': 'pulse 1s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      }
    },
  },
  plugins: [],
}
