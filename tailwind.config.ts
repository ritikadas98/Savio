import type { Config } from "tailwindcss"
import tailwindcssAnimate from "tailwindcss-animate"

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
        sans: ['Neue Montreal', 'Inter', 'system-ui', '-apple-system', 'sans-serif'],
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

        // Accent border tokens — for accent-variant cards.
        // Names are intent-based (yellow/blue/green/red), keyed by usage:
        //   yellow = money-in (windfall)
        //   blue   = ritual prompt (monthly check-in, Savio-led action)
        //   green  = positive status (on-track, achieved)
        //   red    = alert (over-budget, regret-rate)
        'yellow-accent': '#F4D123',
        'blue-accent':   '#0C447C',
        'green-accent':  '#B2EF82',
        'red-accent':    '#FF8F8F',

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
        //
        // Doc 1.15: values aligned to the preview's T object (src/lib/design-tokens.ts).
        // T.p (primary, near-black) is the dominant body/title/hero color across the app.
        primary: '#1A1A1A',   // T.p
        secondary: '#5F5E5A', // T.s (mid-grey)
        tertiary: '#888780',  // T.t (subdued grey)
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
  plugins: [tailwindcssAnimate],
} satisfies Config

export default config
