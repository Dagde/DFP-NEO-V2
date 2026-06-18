const TAILWIND_COLORS: Record<string, Record<string, [number, number, number]>> = {
  sky: { '400': [56, 189, 248], '500': [14, 165, 233] },
  purple: { '400': [192, 132, 252], '500': [168, 85, 247] },
  yellow: { '400': [250, 204, 21], '500': [234, 179, 8] },
  pink: { '400': [244, 114, 182], '500': [236, 72, 153] },
  teal: { '400': [45, 212, 191], '500': [20, 184, 166] },
  indigo: { '400': [129, 140, 248], '500': [99, 102, 241] },
  cyan: { '400': [34, 211, 238], '500': [6, 182, 212] },
  blue: { '400': [96, 165, 250], '500': [59, 130, 246] },
  green: { '400': [74, 222, 128], '500': [34, 197, 94] },
  orange: { '400': [251, 146, 60], '500': [249, 115, 22] },
  red: { '400': [248, 113, 113], '500': [239, 68, 68], '800': [153, 27, 27], '900': [127, 29, 29] },
  gray: { '400': [156, 163, 175], '500': [107, 114, 128], '600': [75, 85, 99] },
  amber: { '400': [251, 191, 36], '500': [245, 158, 11], '700': [180, 83, 9] },
  fuchsia: { '400': [232, 121, 249], '500': [217, 70, 239] },
  lime: { '400': [163, 230, 53], '500': [132, 204, 22] },
  violet: { '400': [167, 139, 250], '500': [139, 92, 246] },
  rose: { '400': [251, 113, 133], '500': [244, 63, 94] },
};

const isCssColor = (color: string): boolean => (
  color.startsWith('#') || color.startsWith('rgb')
);

const darkenRgbForLightTheme = (rgb: [number, number, number]): [number, number, number] => {
  const strength = 0.62;
  return [
    Math.round(rgb[0] * strength),
    Math.round(rgb[1] * strength),
    Math.round(rgb[2] * strength),
  ];
};

export const hexToRgba = (hex: string, alpha: number, darken = false): string => {
  try {
    const strength = darken ? 0.62 : 1;
    const r = Math.round(parseInt(hex.slice(1, 3), 16) * strength);
    const g = Math.round(parseInt(hex.slice(3, 5), 16) * strength);
    const b = Math.round(parseInt(hex.slice(5, 7), 16) * strength);
    return `rgba(${r},${g},${b},${alpha})`;
  } catch {
    return hex;
  }
};

export const resolveTailwindBgClassToRgba = (
  cls: string,
  mode: 'legend' | 'tile-dark' | 'tile-light' = 'legend',
): string | null => {
  if (!cls || !cls.startsWith('bg-')) return null;
  const match = cls.match(/^bg-([a-z]+)-(\d+)(?:\/(\d+))?$/);
  if (!match) return null;
  const [, colorName, shade, opacityStr] = match;
  const rgb = TAILWIND_COLORS[colorName]?.[shade];
  if (!rgb) return null;

  const opacity = opacityStr ? parseInt(opacityStr, 10) : 100;
  if (mode === 'legend') {
    return `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${Math.max(0, Math.min(100, opacity)) / 100})`;
  }

  const displayRgb = mode === 'tile-light' ? darkenRgbForLightTheme(rgb) : rgb;
  let alpha: number;
  if (mode === 'tile-light') {
    if (opacity >= 75) alpha = 0.88;
    else if (opacity >= 45) alpha = 0.78;
    else if (opacity >= 30) alpha = 0.68;
    else alpha = Math.max(0.58, opacity / 100);
  } else if (opacity >= 75) alpha = 0.57;
  else if (opacity >= 45) alpha = 0.42;
  else if (opacity >= 30) alpha = 0.35;
  else alpha = (opacity / 100) * 0.7;

  return `rgba(${displayRgb[0]},${displayRgb[1]},${displayRgb[2]},${alpha})`;
};

export const resolveCourseLegendColor = (color?: string): string | null => {
  const value = String(color || '').trim();
  if (!value) return null;
  if (isCssColor(value)) return value;
  return resolveTailwindBgClassToRgba(value, 'legend');
};

export const resolveScheduleTileBackgroundColor = (
  color?: string,
  mode: 'dark' | 'light' = 'dark',
): string | null => {
  const value = String(color || '').trim();
  if (!value) return null;
  if (isCssColor(value)) return value.startsWith('#') ? hexToRgba(value, mode === 'light' ? 0.92 : 0.57, mode === 'light') : value;
  return resolveTailwindBgClassToRgba(value, mode === 'light' ? 'tile-light' : 'tile-dark');
};
