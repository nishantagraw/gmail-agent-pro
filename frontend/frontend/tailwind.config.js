/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                'space-black': '#0a0a0f',
                'neon-cyan': '#00f3ff',
                'electric-purple': '#b026ff',
                'cyber-pink': '#ff0080',
                'glass-white': 'rgba(255, 255, 255, 0.1)',
            },
            fontFamily: {
                'orbitron': ['Orbitron', 'sans-serif'],
                'poppins': ['Poppins', 'sans-serif'],
            },
            backdropBlur: {
                'glass': '10px',
            },
            boxShadow: {
                'neon-cyan': '0 0 20px rgba(0, 243, 255, 0.5)',
                'neon-purple': '0 0 20px rgba(176, 38, 255, 0.5)',
                'neon-pink': '0 0 20px rgba(255, 0, 128, 0.5)',
            },
        },
    },
    plugins: [],
}
