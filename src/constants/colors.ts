export const Colors = {
  light: {
    background: '#F8F7F4',
    card: '#FFFFFF',
    cardElevated: '#FFFFFF',
    border: '#EFECE6',
    borderLight: '#F5F3EF',
    text: '#1A1A1A',
    textSecondary: '#78716C',
    textMuted: '#A8A29E',
    
    // Brand & Accents matching the reference design
    accent: '#E58A2B',        // Sikka Amber FAB & highlights
    accentHover: '#D97706',
    accentLight: '#FEF3C7',
    accentForeground: '#FFFFFF',
    
    // Interactive pills & buttons
    pillActive: '#1C1917',
    pillActiveText: '#FFFFFF',
    pillInactive: '#F0ECE4',
    pillInactiveText: '#44403C',
    
    // Status & financial indicators
    success: '#10B981',
    successLight: '#D1FAE5',
    danger: '#EF4444',
    dangerLight: '#FEE2E2',
    warning: '#F59E0B',
    warningLight: '#FEF3C7',
    info: '#0EA5E9',
    infoLight: '#E0F2FE',

    // Keypad & Inputs
    keypadKey: '#FFFFFF',
    keypadBorder: '#EFECE6',
    keypadText: '#1A1A1A',
    inputBg: '#F3EFE8',

    // Navigation
    tabBarBg: '#FFFFFF',
    tabBarBorder: '#EFECE6',
    tabBarActive: '#1C1917',
    tabBarInactive: '#9CA3AF',
  },
  dark: {
    background: '#121214',
    card: '#1C1C1F',
    cardElevated: '#242429',
    border: '#2A2A30',
    borderLight: '#202024',
    text: '#F5F5F7',
    textSecondary: '#A1A1AA',
    textMuted: '#71717A',
    
    accent: '#F59E0B',
    accentHover: '#D97706',
    accentLight: '#451A03',
    accentForeground: '#000000',
    
    pillActive: '#FFFFFF',
    pillActiveText: '#121214',
    pillInactive: '#27272A',
    pillInactiveText: '#D4D4D8',
    
    success: '#34D399',
    successLight: '#064E3B',
    danger: '#F87171',
    dangerLight: '#7F1D1D',
    warning: '#FBBF24',
    warningLight: '#78350F',
    info: '#38BDF8',
    infoLight: '#0C4A6E',

    keypadKey: '#242429',
    keypadBorder: '#2E2E35',
    keypadText: '#FFFFFF',
    inputBg: '#27272A',

    tabBarBg: '#18181B',
    tabBarBorder: '#27272A',
    tabBarActive: '#F59E0B',
    tabBarInactive: '#71717A',
  },
};

export type ThemeColors = typeof Colors.light;

