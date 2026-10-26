export const betaThemeDefaults = {
  primary: '#4F7D70',
  secondary: '#8FA99F',
  background: '#F2F6F3',
  surface: '#FFFFFF',
  'on-surface': '#263D35',
};

export const betaThemeFields = [
  { key: 'primary', label: 'Accent' },
  { key: 'secondary', label: 'Secondary' },
  { key: 'background', label: 'Background' },
  { key: 'surface', label: 'Cards' },
  { key: 'on-surface', label: 'Text' },
];

export const resolveThemeName = (name) => !name || name === 'sage' ? 'sage' : 'light';

export function normalizeBetaColors(colors) {
  return Object.fromEntries(Object.entries(betaThemeDefaults).map(([key, fallback]) => [
    key, typeof colors?.[key] === 'string' && /^#[0-9a-f]{6}$/i.test(colors[key]) ? colors[key] : fallback
  ]));
}

export function applyWorkspaceTheme(theme, name, colors) {
  const palette = normalizeBetaColors(colors);
  Object.assign(theme.themes.value.sage.colors, palette, { 'on-background': palette['on-surface'] });
  theme.global.name.value = resolveThemeName(name);
}
