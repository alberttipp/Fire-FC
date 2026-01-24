/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                'brand-dark': '#0a0a0a', // Almost black
                'brand-green': '#ccff00', // Neon/Lime Green (FC 26 vibe)
                'brand-gold': '#d4af37',
                'glass': 'rgba(255, 255, 255, 0.1)',
                'glass-dark': 'rgba(0, 0, 0, 0.5)',
            },
            fontFamily: {
                'sans': ['Inter', 'sans-serif'],
                'display': ['Rajdhani', 'sans-serif'], // Need to import this font
            },
            backgroundImage: {
                'hero-pattern': "url('/hero-bg.jpg')", // Placeholder
            },
            animation: {
                'shake': 'shake 0.5s cubic-bezier(.36,.07,.19,.97) both',
                'pulse-fast': 'pulse 1s cubic-bezier(0.4, 0, 0.6, 1) infinite',
            },
            keyframes: {
                shake: {
                    '10%, 90%': { transform: 'translate3d(-1px, 0, 0)' },
                    '20%, 80%': { transform: 'translate3d(2px, 0, 0)' },
                    '30%, 50%, 70%': { transform: 'translate3d(-4px, 0, 0)' },
                    '40%, 60%': { transform: 'translate3d(4px, 0, 0)' },
                }
            }
        },
    },
    plugins: [],
}
