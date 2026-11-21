/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      /* ════════════════════════════════════════════
         AVANGUARDIA CINEMATICA — Design System Tokens
         Peppe Taglieri — Jazz Fusion Pianist
         ════════════════════════════════════════════ */
      
      /* ── Cinematic Color Palette ── */
      colors: {
        /* Background layers (deep to surface) */
        cinema: {
          900: '#08080A',   /* abyss — deepest bg */
          800: '#0E0E10',   /* void — section bg */
          700: '#121214',   /* charcoal — elevated bg */
          600: '#1A1A1C',   /* iron — card surface */
          500: '#242428',   /* steel — hover/interactive */
          400: '#2E2E32',   /* smoke — border strong */
        },
        /* Text hierarchy */
        text: {
          primary: '#F5F5EF',   /* warm white — filmic */
          secondary: '#A1A1A6',  /* silver — body */
          tertiary: '#6E6E73',   /* grey — muted */
          inverse: '#08080A',    /* on accent areas */
        },
        /* Accents */
        accent: {
          gold: '#D4A853',        /* warm light — primary accent */
          'gold-light': '#E4C070',
          'gold-dark': '#B8923E',
          amber: '#F59E0B',       /* CTA energy */
          'amber-light': '#FBBF24',
          silver: '#9CA3AF',      /* secondary accent */
          indigo: '#6366F1',      /* cool accent (rare use) */
        },
        /* Surface variants */
        surface: {
          glass: 'rgba(255,255,255,0.04)',
          'glass-hover': 'rgba(255,255,255,0.08)',
          'glass-active': 'rgba(255,255,255,0.12)',
        },
        /* Functional */
        success: '#22C55E',
        error: '#EF4444',
        warning: '#F59E0B',

        /* ════════════════════════════════════════════
           NOCTURNE UNDERGROUND — Design System
           (dalla demo nocturne-jazz-scrollytelling)
           ════════════════════════════════════════════ */
        /* Surfaces — warm deep blacks */
        void: '#0a0807',
        pitch: '#060504',
        char: '#141009',
        soot: '#1d1610',
        sepia: '#3a2817',

        /* Metals & embers (amber → noct-amber per evitare clash con la scala amber di Tailwind) */
        'noct-amber': '#c08438',
        gold: '#d8b15e',
        goldsoft: '#b8975a',
        copper: '#c66a3d',
        ember: '#e89456',
        rust: '#8a4a25',

        /* Night botanicals */
        forest: '#2b4234',
        moss: '#41593f',
        noctindigo: '#2b3a66',
        indigobright: '#5166a8',

        /* Text */
        bone: '#ece1cb',
        bonedim: '#b3a487',
        mute: '#7c6f5a',

        /* ════════════════════════════════════════════
           NOCTURNE UNDERGROUND — palette del design
           (traduzione 1:1 del blocco `@theme` della demo,
           per Tailwind 3.4). Dopo i token legacy perché
           li sovrascrive: il design è la nuova fonte.
           I nomi senza suffisso (`bg-amber`, `text-gold`)
           non collidono con le scale built-in di Tailwind
           (`amber-500`, `indigo-500`), che restano intatte.
           ════════════════════════════════════════════ */
        ink: '#070504',
        night: '#0d0907',
        sepia: '#1a110b',
        umber: '#2a1a10',
        amber: '#d08a36',
        ember: '#e0a24f',
        gold: '#b39a52',
        forest: '#0e1d17',
        moss: '#1d3a2c',
        indigo: '#1d2350',
        copper: '#c8622c',
        cream: '#efe3cc',
        bone: '#b9ab92',
      },

      /* ── Typography Scale (cinematic, editorial) ── */
      fontSize: {
        'display-xl': ['clamp(3rem, 8vw, 7rem)', { lineHeight: '0.95', letterSpacing: '-0.03em', fontWeight: '700' }],
        'display-lg': ['clamp(2.5rem, 6vw, 5rem)', { lineHeight: '1.0', letterSpacing: '-0.02em', fontWeight: '700' }],
        'display': ['clamp(2rem, 4.5vw, 3.5rem)', { lineHeight: '1.05', letterSpacing: '-0.02em', fontWeight: '700' }],
        'heading-xl': ['clamp(1.75rem, 3.5vw, 2.75rem)', { lineHeight: '1.1', letterSpacing: '-0.01em', fontWeight: '600' }],
        'heading-lg': ['clamp(1.5rem, 2.5vw, 2.25rem)', { lineHeight: '1.15', letterSpacing: '-0.01em', fontWeight: '600' }],
        'heading': ['clamp(1.25rem, 2vw, 1.75rem)', { lineHeight: '1.2', letterSpacing: '0em', fontWeight: '600' }],
        'body-lg': ['1.125rem', { lineHeight: '1.65', letterSpacing: '0.01em' }],
        'body': ['1rem', { lineHeight: '1.6', letterSpacing: '0.01em' }],
        'body-sm': ['0.875rem', { lineHeight: '1.5', letterSpacing: '0.01em' }],
        'caption': ['0.8125rem', { lineHeight: '1.4', letterSpacing: '0.02em' }],
        'overline': ['0.75rem', { lineHeight: '1.2', letterSpacing: '0.08em', textTransform: 'uppercase' }],
        'micro': ['0.6875rem', { lineHeight: '1.2', letterSpacing: '0.06em', textTransform: 'uppercase' }],
      },

      /* ── Font Families ── */
      fontFamily: {
        /* Nocturne Underground — display/sans/hand sono i tre del design.
           Le variabili CSS sono definite in app/globals.css (equivalente
           di `@theme` in Tailwind 4). */
        display: ['var(--font-display)', 'Cormorant Garamond', 'Georgia', 'serif'],
        sans: ['var(--font-sans)', 'Jost', 'system-ui', 'sans-serif'],
        hand: ['var(--font-hand)', 'Caveat', 'cursive'],

        /* Legacy — /admin e pagine non ancora ridisegnate */
        body: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['DM Mono', 'JetBrains Mono', 'monospace'],
        'noct-display': ['var(--font-display)', 'Fraunces', 'Georgia', 'serif'],
        'noct-serif': ['var(--font-noct-serif)', 'Cormorant Garamond', 'Georgia', 'serif'],
        'noct-sans': ['var(--font-body)', 'Inter', 'system-ui', 'sans-serif'],
        'noct-engrave': ['var(--font-noct-engrave)', 'Cinzel', 'serif'],
      },

      /* ── 8pt Spacing Scale ── */
      spacing: {
        0.5: '2px',
        1: '4px',
        1.5: '6px',
        2: '8px',
        2.5: '10px',
        3: '12px',
        3.5: '14px',
        4: '16px',
        5: '20px',
        6: '24px',
        7: '28px',
        8: '32px',
        9: '36px',
        10: '40px',
        11: '44px',
        12: '48px',
        14: '56px',
        16: '64px',
        18: '72px',
        20: '80px',
        24: '96px',
        28: '112px',
        32: '128px',
      },

      /* ── Border Radius (cinematic rounding) ── */
      borderRadius: {
        none: '0',
        sm: '4px',
        DEFAULT: '8px',
        md: '12px',
        lg: '16px',
        xl: '20px',
        '2xl': '24px',
        full: '9999px',
      },

      /* ── Shadows (cinematic, layered) ── */
      boxShadow: {
        'film': '0 1px 2px rgba(0,0,0,0.3)',
        'film-md': '0 4px 12px rgba(0,0,0,0.4), 0 1px 3px rgba(0,0,0,0.3)',
        'film-lg': '0 10px 25px rgba(0,0,0,0.5), 0 4px 10px rgba(0,0,0,0.3)',
        'film-xl': '0 20px 50px rgba(0,0,0,0.6), 0 8px 20px rgba(0,0,0,0.3)',
        'film-2xl': '0 30px 80px rgba(0,0,0,0.7)',
        'gold': '0 0 20px rgba(212,168,83,0.15), 0 0 40px rgba(212,168,83,0.05)',
        'gold-lg': '0 0 30px rgba(212,168,83,0.2), 0 0 60px rgba(212,168,83,0.08)',
      },

      /* ── Blurs (cinematic depth) ── */
      backdropBlur: {
        xs: '2px',
        sm: '4px',
        DEFAULT: '8px',
        md: '12px',
        lg: '20px',
        xl: '32px',
        '2xl': '48px',
      },

      /* ── Transitions & Animations ── */
      transitionDuration: {
        '0': '0ms',
        '100': '100ms',
        '150': '150ms',
        '200': '200ms',
        '300': '300ms',
        '400': '400ms',
        '500': '500ms',
        '700': '700ms',
        '1000': '1000ms',
      },

      transitionTimingFunction: {
        'cinema-in': 'cubic-bezier(0.55, 0.085, 0.68, 0.53)',
        'cinema-out': 'cubic-bezier(0.16, 1, 0.3, 1)',
        'cinema-in-out': 'cubic-bezier(0.65, 0, 0.35, 1)',
        'spring': 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      },

      keyframes: {
        /* Cinematic entrance */
        'film-reveal': {
          '0%': { clipPath: 'inset(0 100% 0 0)' },
          '100%': { clipPath: 'inset(0 0 0 0)' },
        },
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(24px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'scale-in': {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        /* Film grain */
        'grain': {
          '0%, 100%': { transform: 'translate(0, 0)' },
          '10%': { transform: 'translate(-5%, -5%)' },
          '20%': { transform: 'translate(-10%, 5%)' },
          '30%': { transform: 'translate(5%, -10%)' },
          '40%': { transform: 'translate(-5%, 15%)' },
          '50%': { transform: 'translate(-10%, 5%)' },
          '60%': { transform: 'translate(15%, 0)' },
          '70%': { transform: 'translate(0, 10%)' },
          '80%': { transform: 'translate(-15%, 0)' },
          '90%': { transform: 'translate(10%, 5%)' },
        },
        /* Light leak pulse */
        'light-leak': {
          '0%, 100%': { opacity: '0.3', transform: 'translateX(-10%)' },
          '50%': { opacity: '0.6', transform: 'translateX(10%)' },
        },
        /* Float for hero elements */
        'cinema-float': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-12px)' },
        },
        /* Shimmer for CTA */
        'shimmer': {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' },
        },

        /* Nocturne Underground — ambient motion */
        'smokeDrift': {
          '0%': { transform: 'translate3d(0,0,0) scale(1)', opacity: '0.5' },
          '50%': { transform: 'translate3d(6%, -8%, 0) scale(1.18)', opacity: '0.75' },
          '100%': { transform: 'translate3d(0,0,0) scale(1)', opacity: '0.5' },
        },
        'emberFloat': {
          '0%': { transform: 'translateY(0) translateX(0)', opacity: '0' },
          '10%': { opacity: '0.9' },
          '90%': { opacity: '0.5' },
          '100%': { transform: 'translateY(-120px) translateX(14px)', opacity: '0' },
        },
        'pulseLamp': {
          '0%, 100%': { opacity: '0.45', transform: 'scale(1)' },
          '50%': { opacity: '0.85', transform: 'scale(1.06)' },
        },
        'breathe': {
          '0%, 100%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.03)' },
        },
        'marquee': {
          'from': { transform: 'translateX(0)' },
          'to': { transform: 'translateX(-50%)' },
        },
        'shimmerLine': {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'eqBar': {
          '0%, 100%': { transform: 'scaleY(0.18)' },
          '50%': { transform: 'scaleY(1)' },
        },
        'spinDisc': {
          'to': { transform: 'rotate(360deg)' },
        },
        'grainShift': {
          '0%': { transform: 'translate(0,0)' },
          '20%': { transform: 'translate(-6%, 4%)' },
          '40%': { transform: 'translate(4%, -5%)' },
          '60%': { transform: 'translate(-3%, 6%)' },
          '80%': { transform: 'translate(5%, 2%)' },
          '100%': { transform: 'translate(0,0)' },
        },
      },

      animation: {
        'film-reveal': 'film-reveal 1.2s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'fade-up': 'fade-up 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'fade-in': 'fade-in 0.6s ease-out forwards',
        'scale-in': 'scale-in 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'grain': 'grain 0.3s steps(5) infinite',
        'light-leak': 'light-leak 4s ease-in-out infinite',
        'cinema-float': 'cinema-float 6s ease-in-out infinite',
        'shimmer': 'shimmer 2s ease-in-out infinite',

        /* Nocturne — ambient motion */
        'noct-marquee': 'marquee 40s linear infinite',
        'noct-breathe': 'breathe 7s ease-in-out infinite',
        'noct-lamp': 'pulseLamp 6s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
