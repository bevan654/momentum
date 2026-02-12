// Inter font family constants
// Maps CSS-style font weights to Inter variant font family names

export const Fonts = {
  light: 'Inter_300Light',
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semiBold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  extraBold: 'Inter_800ExtraBold',
} as const;

// Map numeric/string font weights to Inter variants
const weightMap: Record<string, string> = {
  '300': Fonts.light,
  '400': Fonts.regular,
  'normal': Fonts.regular,
  '500': Fonts.medium,
  '600': Fonts.semiBold,
  '700': Fonts.bold,
  'bold': Fonts.bold,
  '800': Fonts.extraBold,
};

export function getFontFamily(weight: string | number = '400'): string {
  return weightMap[String(weight)] ?? Fonts.regular;
}
