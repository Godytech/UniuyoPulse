/**
 * Design Tokens for X (formerly Twitter) interaction language
 * Lights Out (#000000) default + Pure White (#FFFFFF) alternative
 */

export const THEME_TOKENS = {
  colors: {
    accent: '#1D9BF0',
    accentHover: '#1A8CD8',
    accentSubtle: 'rgba(29, 155, 240, 0.1)',
    verified: '#1D9BF0',
    repGold: '#FFD400',
    status: {
      present: '#00BA7C',
      late: '#FFD400',
      outside: '#F4212E',
      absent: '#F4212E',
    },
    dark: {
      bg: '#000000',
      surface: '#16181C',
      surfaceHover: '#1D1F23',
      border: '#2F3336',
      borderSubtle: '#202327',
      textPrimary: '#E7E9EA',
      textSecondary: '#71767B',
      textMuted: '#536471',
      primaryBtnBg: '#EFF3F4',
      primaryBtnText: '#0F1419',
    },
    light: {
      bg: '#FFFFFF',
      surface: '#F7F9F9',
      surfaceHover: '#EFF3F4',
      border: '#EFF3F4',
      borderSubtle: '#CFD9DE',
      textPrimary: '#0F1419',
      textSecondary: '#536471',
      textMuted: '#8B98A5',
      primaryBtnBg: '#0F1419',
      primaryBtnText: '#FFFFFF',
    }
  }
};

export const X_TOKENS = THEME_TOKENS;
