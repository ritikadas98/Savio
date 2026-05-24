import type { Config } from "tailwindcss"

const config = {
  darkMode: ["class"],
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        sans: ['Neue Montreal', 'Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        canvas: '#E4ECE6',
        
        // Strategist (Blue)
        strategist: {
          plate: '#DCEEFF',
          stop: '#0C447C',
          accent: '#58B9FF',
        },
        
        // Adventurer (Yellow)
        adventurer: {
          plate: '#FCF1CC',
          stop: '#854F0B',
          accent: '#F4D123',
        },
        
        // Builder (Green)
        builder: {
          plate: '#DEF2CB',
          stop: '#3B6D11',
          accent: '#B2EF82',
        },
        
        // Alert (Red)
        alert: {
          plate: '#FFE1E1',
          stop: '#791F1F',
          accent: '#FF8F8F',
        },

        // Surface variants
        cardSoft: '#FAFAF7',

        // Subtle border tokens for delicate dividers / hover states
        borderSoft: 'rgba(0,0,0,0.07)',
        borderHover: 'rgba(0,0,0,0.14)',

        border: "rgba(0, 0, 0, 0.06)",
        input: "rgba(0, 0, 0, 0.06)",
        ring: "hsl(var(--ring))",
        background: "#E4ECE6",
        foreground: "#1A1A1A",
        
        primary: {
          DEFAULT: "#1A1A1A",
          foreground: "#FFFFFF",
        },
        secondary: {
          DEFAULT: "#FFFFFF",
          foreground: "#1A1A1A",
        },
        muted: {
          DEFAULT: "#F1EFE8",
          foreground: "#888780",
        },
        accent: {
          DEFAULT: "#F1EFE8",
          foreground: "#1A1A1A",
        },
        popover: {
          DEFAULT: "#FFFFFF",
          foreground: "#1A1A1A",
        },
        card: {
          DEFAULT: "#FFFFFF",
          foreground: "#1A1A1A",
        },
      },
      textColor: {
        // Override only text utilities — leaves bg-secondary / bg-primary
        // (used by shadcn ui components) untouched.
        primary: '#1A1A1A',
        secondary: '#5C6660',
        tertiary: '#8B948E',
      },
      borderRadius: {
        lg: "32px",
        md: "24px",
        sm: "16px",
        pill: "999px"
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config

export default config
