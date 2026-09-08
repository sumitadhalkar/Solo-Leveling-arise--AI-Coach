// Colored-initials avatar — deliberately not a photo/portrait. Official
// Solo Leveling: ARISE character art is copyrighted by its publisher, so
// this app never downloads or hosts it; every hunter instead gets a
// consistent, instant visual identifier generated purely from their name
// and element, no artwork required.
const AVATAR_STYLE = {
  light: { color: '#e0bd52', bg: 'rgba(224,189,82,0.16)',  border: 'rgba(224,189,82,0.42)' },
  water: { color: '#4fa4dd', bg: 'rgba(79,164,221,0.16)',  border: 'rgba(79,164,221,0.42)' },
  fire:  { color: '#dd6a4e', bg: 'rgba(221,106,78,0.16)',  border: 'rgba(221,106,78,0.42)' },
  earth: { color: '#67ad5c', bg: 'rgba(103,173,92,0.16)',  border: 'rgba(103,173,92,0.42)' },
  wind:  { color: '#4fc2ba', bg: 'rgba(79,194,186,0.16)',  border: 'rgba(79,194,186,0.42)' },
  dark:  { color: '#8a68e0', bg: 'rgba(138,104,224,0.16)', border: 'rgba(138,104,224,0.42)' },
};

function initialsFor(name) {
  // Strip parenthetical/bracketed alt-costume suffixes, e.g. "Cha Hae-In [Pure Sword]".
  const clean = (name || '').replace(/\[.*?\]/g, '').replace(/\(.*?\)/g, '').trim();
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function HunterAvatar({ name, element, size = 44, className = '' }) {
  const style = AVATAR_STYLE[element] || AVATAR_STYLE.dark;
  return (
    <div
      className={`hunter-avatar ${className}`}
      style={{
        width: size,
        height: size,
        fontSize: Math.max(9, Math.round(size * 0.34)),
        color: style.color,
        background: style.bg,
        borderColor: style.border,
      }}
      aria-hidden="true"
    >
      {initialsFor(name)}
    </div>
  );
}
