import { FREE_DRILL_LIMIT } from '../config/constants.js';

const KEY = 'perin_drill_uses';

function getDrillData() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { count: 0, date: new Date().toDateString() };
    const d = JSON.parse(raw);
    if (d.date !== new Date().toDateString()) return { count: 0, date: new Date().toDateString() };
    return d;
  } catch {
    return { count: 0, date: new Date().toDateString() };
  }
}

export function canUseDrill(subscription) {
  if (subscription?.status === 'pro') return true;
  const d = getDrillData();
  return d.count < FREE_DRILL_LIMIT;
}

export function incrementDrillUsage() {
  const d = getDrillData();
  d.count += 1;
  localStorage.setItem(KEY, JSON.stringify(d));
}

export function getDrillUsageCount() {
  return getDrillData().count;
}
