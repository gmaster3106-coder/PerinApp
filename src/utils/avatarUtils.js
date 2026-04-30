import { AVATAR_COLORS } from '../config/constants.js';

export function getAvatarColor(seed) {
  let hash = 0;
  for (let i = 0; i < (seed || '').length; i++) {
    hash = ((hash << 5) - hash) + seed.charCodeAt(i);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export function getAvatarInitials(name, email) {
  const src = name || email || '?';
  const words = src.trim().split(/\s+/);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return src.slice(0, 2).toUpperCase();
}
