// Warm, earthy tiles — deterministic per name so a person keeps their colour everywhere.
const TONES = [
  { bg: '#EDE4CF', fg: '#6B5320' },
  { bg: '#DDE7D2', fg: '#35552B' },
  { bg: '#F1DCD1', fg: '#94381B' },
  { bg: '#D9E2EC', fg: '#2F4C6B' },
  { bg: '#E6E1D6', fg: '#3E3B33' },
  { bg: '#EFE7B9', fg: '#6A5A07' },
];
export function avatarTone(name = '') {
  const s = String(name).toLowerCase().trim();
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return TONES[h % TONES.length];
}
export function initialsOf(first, last) {
  return `${(first || '?')[0]}${(last || '')[0] || ''}`.toUpperCase();
}
