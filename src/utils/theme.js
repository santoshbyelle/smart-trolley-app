// ============================================
// THEME - Premium Dark Tech Design System
// ============================================

export const Colors = {
  background: '#0D0D0D',
  surface: '#161616',
  surfaceElevated: '#1E1E1E',
  card: '#141414',

  accent: '#00BFFF',       // Electric Blue
  accentGlow: '#00BFFF33',
  accentSecondary: '#00F5FF', // Neon Cyan

  green: '#00FF7F',
  greenGlow: '#00FF7F33',
  yellow: '#FFC300',
  yellowGlow: '#FFC30033',
  red: '#FF3B3B',
  redGlow: '#FF3B3B33',
  purple: '#6C5CE7',

  textPrimary: '#FFFFFF',
  textSecondary: '#A0A0A0',
  textMuted: '#555555',

  border: '#2A2A2A',
  borderAccent: '#00BFFF44',
};

export const Typography = {
  displayLarge: { fontSize: 48, fontWeight: '800', letterSpacing: -1, color: Colors.textPrimary },
  displayMedium: { fontSize: 32, fontWeight: '700', letterSpacing: -0.5, color: Colors.textPrimary },
  headline: { fontSize: 22, fontWeight: '700', letterSpacing: -0.3, color: Colors.textPrimary },
  title: { fontSize: 17, fontWeight: '600', letterSpacing: 0, color: Colors.textPrimary },
  body: { fontSize: 15, fontWeight: '400', color: Colors.textSecondary },
  caption: { fontSize: 12, fontWeight: '500', letterSpacing: 0.5, color: Colors.textMuted },
  label: { fontSize: 11, fontWeight: '700', letterSpacing: 1.5, color: Colors.textMuted },
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const Radius = {
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  round: 999,
};
