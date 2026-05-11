/** @type {import('tailwindcss').Config} */
module.exports = {
    darkMode: ["class"],
    content: [
        "./src/**/*.{js,jsx,ts,tsx}",
        "./public/index.html"
    ],
    theme: {
        extend: {
            fontFamily: {
                sans: ['Plus Jakarta Sans', 'system-ui', 'sans-serif'],
                heading: ['Outfit', 'system-ui', 'sans-serif'],
                mono: ['JetBrains Mono', 'monospace'],
            },
            colors: {
                // Dynamic colors that change with theme
                background: 'hsl(var(--background))',
                foreground: 'hsl(var(--foreground))',
                card: {
                    DEFAULT: 'hsl(var(--card))',
                    foreground: 'hsl(var(--card-foreground))',
                },
                popover: {
                    DEFAULT: 'hsl(var(--popover))',
                    foreground: 'hsl(var(--popover-foreground))',
                },
                primary: {
                    DEFAULT: 'hsl(var(--primary))',
                    foreground: 'hsl(var(--primary-foreground))',
                    hover: 'hsl(var(--primary-hover))',
                },
                secondary: {
                    DEFAULT: 'hsl(var(--secondary))',
                    foreground: 'hsl(var(--secondary-foreground))',
                },
                muted: {
                    DEFAULT: 'hsl(var(--muted))',
                    foreground: 'hsl(var(--muted-foreground))',
                },
                accent: {
                    DEFAULT: 'hsl(var(--accent))',
                    foreground: 'hsl(var(--accent-foreground))',
                    success: '#10B981',
                    warning: '#F59E0B',
                    error: '#EF4444',
                    info: '#3B82F6',
                    purple: '#8B5CF6',
                },
                destructive: {
                    DEFAULT: 'hsl(var(--destructive))',
                    foreground: 'hsl(var(--destructive-foreground))',
                },
                border: 'hsl(var(--border))',
                input: 'hsl(var(--input))',
                ring: 'hsl(var(--ring))',
                // Chart colors
                chart: {
                    1: '#6366F1',
                    2: '#10B981',
                    3: '#3B82F6',
                    4: '#F59E0B',
                    5: '#EF4444',
                    deposits: '#10B981',
                    withdrawals: '#EF4444',
                },
                // Stat card colors (Base44 style)
                stat: {
                    blue: {
                        bg: '#EEF2FF',
                        icon: '#6366F1',
                        darkBg: '#1E1B4B',
                    },
                    green: {
                        bg: '#ECFDF5',
                        icon: '#10B981',
                        darkBg: '#064E3B',
                    },
                    orange: {
                        bg: '#FFF7ED',
                        icon: '#F59E0B',
                        darkBg: '#78350F',
                    },
                    purple: {
                        bg: '#F5F3FF',
                        icon: '#8B5CF6',
                        darkBg: '#4C1D95',
                    },
                },
                // Sidebar colors
                sidebar: {
                    DEFAULT: 'hsl(var(--sidebar))',
                    foreground: 'hsl(var(--sidebar-foreground))',
                    muted: 'hsl(var(--sidebar-muted))',
                    accent: 'hsl(var(--sidebar-accent))',
                },
            },
            borderRadius: {
                lg: '0.75rem',
                md: '0.5rem',
                sm: '0.25rem',
                xl: '1rem',
                '2xl': '1.5rem',
            },
            boxShadow: {
                'soft': '0 2px 15px -3px rgba(0, 0, 0, 0.07), 0 10px 20px -2px rgba(0, 0, 0, 0.04)',
                'card': '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)',
                'card-hover': '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
                'glow': '0 0 40px -10px rgba(99, 102, 241, 0.3)',
                'dark-card': '0 4px 6px -1px rgba(0, 0, 0, 0.4), 0 2px 4px -2px rgba(0, 0, 0, 0.3)',
            },
            backgroundImage: {
                'gradient-header': 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                'gradient-header-dark': 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)',
                'gradient-sidebar': 'linear-gradient(180deg, #6366F1 0%, #8B5CF6 100%)',
                'gradient-card': 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
            },
            keyframes: {
                'accordion-down': {
                    from: { height: '0' },
                    to: { height: 'var(--radix-accordion-content-height)' },
                },
                'accordion-up': {
                    from: { height: 'var(--radix-accordion-content-height)' },
                    to: { height: '0' },
                },
                'fade-in': {
                    from: { opacity: '0' },
                    to: { opacity: '1' },
                },
                'slide-up': {
                    from: { opacity: '0', transform: 'translateY(20px)' },
                    to: { opacity: '1', transform: 'translateY(0)' },
                },
                'slide-in-right': {
                    from: { opacity: '0', transform: 'translateX(20px)' },
                    to: { opacity: '1', transform: 'translateX(0)' },
                },
                'pulse-soft': {
                    '0%, 100%': { opacity: '1' },
                    '50%': { opacity: '0.7' },
                },
            },
            animation: {
                'accordion-down': 'accordion-down 0.2s ease-out',
                'accordion-up': 'accordion-up 0.2s ease-out',
                'fade-in': 'fade-in 0.5s ease-out forwards',
                'slide-up': 'slide-up 0.5s ease-out forwards',
                'slide-in-right': 'slide-in-right 0.3s ease-out forwards',
                'pulse-soft': 'pulse-soft 2s ease-in-out infinite',
            },
        },
    },
    plugins: [require("tailwindcss-animate")],
};
