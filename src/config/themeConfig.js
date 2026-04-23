// Theme configuration
// MODIFY THIS FILE for each game to match branding

export const theme = {
  // Color Palette (Palworld theme - vibrant blue/teal)
  colors: {
    // Primary brand colors
    primary: "#2196F3",      // Pal Sphere blue
    primaryHover: "#1976D2",
    primaryLight: "#42A5F5",
    primaryDark: "#1565C0",

    // Secondary colors
    secondary: "#FF9800",    // Warm orange (Pal energy)
    secondaryHover: "#F57C00",
    secondaryLight: "#FFB74D",

    // Accent colors
    accent: "#4CAF50",       // Nature green
    accentHover: "#388E3C",

    // Neutral colors
    background: "#0a0a0a",
    backgroundAlt: "#1a1a1a",
    surface: "#1f1f1f",
    surfaceHover: "#2a2a2a",

    // Text colors
    text: "#ffffff",
    textSecondary: "#a0a0a0",
    textMuted: "#6b7280",

    // Status colors
    success: "#4ade80",
    error: "#ef4444",
    warning: "#fbbf24",
    info: "#3b82f6",

    // Border colors
    border: "#2a2a2a",
    borderLight: "#404040",
  },

  // Typography
  fonts: {
    heading: "'Poppins', 'Inter', system-ui, -apple-system, sans-serif",
    body: "'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    mono: "'JetBrains Mono', 'Fira Code', 'Courier New', monospace",
  },

  fontSize: {
    xs: '0.75rem', sm: '0.875rem', base: '1rem', lg: '1.125rem',
    xl: '1.25rem', '2xl': '1.5rem', '3xl': '1.875rem', '4xl': '2.25rem',
    '5xl': '3rem', '6xl': '3.75rem', '7xl': '4.5rem',
  },

  spacing: {
    xs: '0.25rem', sm: '0.5rem', md: '1rem', lg: '1.5rem',
    xl: '2rem', '2xl': '3rem', '3xl': '4rem', '4xl': '6rem',
  },

  borderRadius: {
    none: '0', sm: '0.25rem', md: '0.5rem', lg: '0.75rem',
    xl: '1rem', '2xl': '1.5rem', full: '9999px',
  },

  shadows: {
    sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
    md: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
    lg: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
    xl: '0 20px 25px -5px rgb(0 0 0 / 0.1)',
    '2xl': '0 25px 50px -12px rgb(0 0 0 / 0.25)',
    glow: '0 0 20px rgba(33, 150, 243, 0.5)',
    glowAccent: '0 0 20px rgba(76, 175, 80, 0.5)',
  },

  transitions: { fast: '150ms ease-in-out', normal: '250ms ease-in-out', slow: '350ms ease-in-out' },
  breakpoints: { sm: '640px', md: '768px', lg: '1024px', xl: '1280px', '2xl': '1536px' },
  zIndex: { dropdown: 1000, sticky: 1020, fixed: 1030, modalBackdrop: 1040, modal: 1050, popover: 1060, tooltip: 1070 },
};

export const generateCSSVariables = () => {
  return `
    :root {
      --color-primary: ${theme.colors.primary};
      --color-primary-hover: ${theme.colors.primaryHover};
      --color-secondary: ${theme.colors.secondary};
      --color-accent: ${theme.colors.accent};
      --color-background: ${theme.colors.background};
      --color-surface: ${theme.colors.surface};
      --color-text: ${theme.colors.text};
      --color-text-secondary: ${theme.colors.textSecondary};
      --font-heading: ${theme.fonts.heading};
      --font-body: ${theme.fonts.body};
    }
  `;
};

export default theme;
