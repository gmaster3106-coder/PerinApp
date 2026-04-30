import { LANG_CODES, DIALECT_CODES, SCRIPT_TYPES } from '../config/constants.js';

export function getLangCode(lang, dialect) {
  return DIALECT_CODES[dialect] || LANG_CODES[lang] || 'es-ES';
}

export function getScriptType(lang) {
  return SCRIPT_TYPES[lang] || 'latin';
}

export function isRTL(lang) {
  return ['Arabic', 'Hebrew', 'Persian', 'Urdu'].includes(lang);
}

export function isLogographic(lang) {
  return ['Chinese', 'Japanese'].includes(lang);
}

export function getNativeLang(profile) {
  const map = {
    'English': 'English', 'Spanish': 'Spanish', 'French': 'French',
    'Portuguese': 'Portuguese', 'Italian': 'Italian', 'German': 'German',
  };
  return map[profile?.native] || 'English';
}

export function renderTargetText(text, lang) {
  const escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return escaped;
}

export function getFlag(dialect, lang) {
  const flags = {
    'Dominican Republic': '🇩🇴', 'Puerto Rico': '🇵🇷', 'Colombia': '🇨🇴',
    'Mexico': '🇲🇽', 'Castilian': '🇪🇸', 'Cuban': '🇨🇺', 'Argentine': '🇦🇷',
    'Parisian': '🗼', 'Southern French': '🌞', 'French': '🇫🇷',
    'Italian': '🇮🇹', 'Sicilian': '🏝️', 'Neapolitan': '🌋',
    'Brazilian': '🇧🇷', 'Portugal': '🇵🇹',
    'Haiti': '🇭🇹', 'Creole': '🇭🇹',
    'Spanish': '🇪🇸', 'Portuguese': '🇧🇷',
    'American': '🇺🇸', 'English': '🇬🇧',
  };
  return flags[dialect] || flags[lang] || '🌍';
}

export function getLevelColor(level) {
  return { beginner: '#22c55e', intermediate: '#f59e0b', advanced: '#ef4444', native: '#a855f7' }[level] || '#6b7280';
}

export function getDifficultyColor(diff) {
  return { Easy: '#22c55e', Medium: '#f59e0b', Hard: '#ef4444', Expert: '#a855f7' }[diff] || '#6b7280';
}
