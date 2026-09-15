/**
 * Semantic design tokens for the mobile app.
 *
 * These tokens mirror the naming conventions used in web artifacts (index.css)
 * so that multi-artifact projects share a cohesive visual identity.
 *
 * Replace the placeholder values below with values that match the project's
 * brand. If a sibling web artifact exists, read its index.css and convert the
 * HSL values to hex so both artifacts use the same palette.
 *
 * To add dark mode, add a `dark` key with the same token names.
 * The useColors() hook will automatically pick it up.
 */

const colors = {
  light: {
    text: '#0F172A',
    tint: '#1565C0',

    background: '#FFFFFF',
    foreground: '#0F172A',

    card: '#FFFFFF',
    cardForeground: '#0F172A',

    primary: '#1565C0',
    primaryForeground: '#FFFFFF',

    secondary: '#E3F2FD',
    secondaryForeground: '#0D47A1',

    muted: '#F5FAFF',
    mutedForeground: '#475569',

    accent: '#E3F2FD',
    accentForeground: '#0D47A1',

    destructive: '#DC2626',
    destructiveForeground: '#FFFFFF',

    border: '#D7E3F0',
    input: '#D7E3F0',
  },
  dark: {
    text: '#0F172A',
    tint: '#1565C0',

    background: '#FFFFFF',
    foreground: '#0F172A',

    card: '#FFFFFF',
    cardForeground: '#0F172A',

    primary: '#1565C0',
    primaryForeground: '#FFFFFF',

    secondary: '#E3F2FD',
    secondaryForeground: '#0D47A1',

    muted: '#F5FAFF',
    mutedForeground: '#475569',

    accent: '#E3F2FD',
    accentForeground: '#0D47A1',

    destructive: '#DC2626',
    destructiveForeground: '#FFFFFF',

    border: '#D7E3F0',
    input: '#D7E3F0',
  },

  radius: 12,
};

export default colors;
