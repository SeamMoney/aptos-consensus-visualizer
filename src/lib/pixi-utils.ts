/**
 * PixiJS shared utilities and constants
 * Matches the dark cyber aesthetic of existing visualizations
 */

// Color palette matching existing theme
export const PIXI_COLORS = {
  background: 0x0a0a0b,
  primary: 0x00d9a5, // Aptos green (accent)
  secondary: 0x3b82f6, // Blue
  accent: 0xf59e0b, // Orange/gold
  danger: 0xef4444, // Red (for comparisons)
  success: 0x22c55e, // Green
  text: 0xffffff,
  textMuted: 0x6b7280,
  glow: 0x00d9a5,
  chrome: {
    100: 0xf4f4f5,
    200: 0xe4e4e7,
    300: 0xd4d4d8,
    400: 0xa1a1aa,
    500: 0x71717a,
    600: 0x52525b,
    700: 0x3f3f46,
    800: 0x27272a,
    900: 0x18181b,
  },
} as const;

// Convert hex to RGB for alpha operations
export function hexToRgb(hex: number): { r: number; g: number; b: number } {
  return {
    r: (hex >> 16) & 0xff,
    g: (hex >> 8) & 0xff,
    b: hex & 0xff,
  };
}

// Convert RGB to CSS rgba string
export function rgbaString(hex: number, alpha: number): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// Easing functions for animations
export const easings = {
  linear: (t: number) => t,
  easeInQuad: (t: number) => t * t,
  easeOutQuad: (t: number) => t * (2 - t),
  easeInOutQuad: (t: number) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t),
  easeOutCubic: (t: number) => 1 - Math.pow(1 - t, 3),
  easeInOutCubic: (t: number) =>
    t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
};

// Lerp utility
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

// Format large numbers with K/M suffix
export function formatNumber(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(0)}K`;
  return n.toFixed(0);
}

// Format currency with appropriate precision - more granular for small values
export function formatFee(n: number): string {
  if (n < 0.00001) return `$${n.toFixed(7)}`;
  if (n < 0.0001) return `$${n.toFixed(6)}`;
  if (n < 0.001) return `$${n.toFixed(5)}`; // Show 5 decimals for sub-penny fees
  if (n < 0.01) return `$${n.toFixed(4)}`;
  if (n < 1) return `$${n.toFixed(3)}`;
  if (n < 10) return `$${n.toFixed(2)}`;
  return `$${n.toFixed(1)}`;
}

// Default PixiJS application config
export const DEFAULT_PIXI_CONFIG = {
  backgroundColor: PIXI_COLORS.background,
  antialias: true,
  autoDensity: true,
} as const;

// Target FPS for animations (matching existing canvas animations)
export const TARGET_FPS = 30;
export const FRAME_TIME = 1000 / TARGET_FPS;
