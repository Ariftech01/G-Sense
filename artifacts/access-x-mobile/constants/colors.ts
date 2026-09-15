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
    text: '#F4F8F7',
    tint: '#62E6C2',

    background: '#081A1D',
    foreground: '#F4F8F7',

    card: '#102B2E',
    cardForeground: '#F4F8F7',

    primary: '#62E6C2',
    primaryForeground: '#081A1D',

    secondary: '#17383A',
    secondaryForeground: '#D9EFEB',

    muted: '#17383A',
    mutedForeground: '#9CB8B4',

    accent: '#F3B562',
    accentForeground: '#081A1D',

    destructive: '#FF756B',
    destructiveForeground: '#081A1D',

    border: '#285052',
    input: '#285052',
  },
  dark: {
    text: '#F4F8F7',
    tint: '#62E6C2',
    background: '#081A1D',
    foreground: '#F4F8F7',
    card: '#102B2E',
    cardForeground: '#F4F8F7',
    primary: '#62E6C2',
    primaryForeground: '#081A1D',
    secondary: '#17383A',
    secondaryForeground: '#D9EFEB',
    muted: '#17383A',
    mutedForeground: '#9CB8B4',
    accent: '#F3B562',
    accentForeground: '#081A1D',
    destructive: '#FF756B',
    destructiveForeground: '#081A1D',
    border: '#285052',
    input: '#285052',
  },

  // Border radius (in px). Sync from the sibling web artifact's --radius
  // CSS variable. This value applies to cards, buttons, inputs, and modals.
  radius: 8,
};

export default colors;
