export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#2563eb',
        secondary: '#f3f4f6',
        dark: '#111827'
      },
      backdropFilter: {
        'none': 'none',
        'sm': 'blur(4px)',
        'md': 'blur(12px)',
        'lg': 'blur(20px)'
      }
    }
  },
  plugins: []
}
