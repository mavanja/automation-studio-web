/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#1877F2',
        'primary-hover': '#166FE5',
        'primary-light': '#4599FF',
        'primary-lighter': '#9DC4FF',
        'primary-lightest': '#D4E6FF',
        'fb-gray': '#E4E6EB',
        'fb-dark': '#1C1E21',
        'accent-start': '#1877F2',
        'accent-end': '#42a5f5',
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
