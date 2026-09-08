// Small hand-built icon set — replaces raw emoji throughout the UI.
// Two families:
//  - outline icons (nav, actions, status) — stroke-based, inherit currentColor
//  - element glyphs (light/water/fire/earth/wind/dark) — filled, compact accent dots

const OUTLINE = {
  home: <path d="M4 11.5 12 4l8 7.5M6.5 10v10h11V10" />,
  insight: (
    <g>
      <circle cx="8" cy="8" r="2.3" />
      <circle cx="16" cy="8" r="2.3" />
      <circle cx="12" cy="16" r="2.3" />
      <line x1="10.1" y1="8.7" x2="13.9" y2="8.7" />
      <line x1="9.4" y1="10" x2="10.9" y2="14.1" />
      <line x1="14.6" y1="10" x2="13.1" y2="14.1" />
    </g>
  ),
  target: (
    <g>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
    </g>
  ),
  book: (
    <path d="M12 6.2C10.6 5 8.6 4.3 6 4.3c-.8 0-1.3.5-1.3 1.2v12.6c0 .8.6 1.3 1.4 1.2 2.3-.2 4.3.5 5.9 1.6 1.6-1.1 3.6-1.8 5.9-1.6.8.1 1.4-.4 1.4-1.2V5.5c0-.7-.5-1.2-1.3-1.2-2.6 0-4.6.7-6 1.9v14" />
  ),
  sword: (
    <g>
      <line x1="5.5" y1="18.5" x2="16.5" y2="7.5" />
      <path d="M13.8 5 19 10.2l-2.3 2.3" />
      <line x1="4.2" y1="19.8" x2="6.4" y2="17.6" />
    </g>
  ),
  users: (
    <g>
      <circle cx="9" cy="8.3" r="3" />
      <path d="M3.7 19.8c0-3 2.4-5.2 5.3-5.2s5.3 2.2 5.3 5.2" />
      <circle cx="17" cy="9.3" r="2.2" />
      <path d="M14.8 19.8c.1-2.2 1.1-3.9 2.9-4.5" />
    </g>
  ),
  gem: <path d="M4 9.2 12 3l8 6.2-8 11.8-8-11.8Zm0 0h16M9 9.2 12 3l3 6.2" />,
  trophy: (
    <g>
      <path d="M8 4h8v5a4 4 0 0 1-8 0V4Z" />
      <path d="M8 5.2H5.3A2.8 2.8 0 0 0 8 8" />
      <path d="M16 5.2h2.7A2.8 2.8 0 0 1 16 8" />
      <path d="M10.3 16h3.4v2.6h-3.4Z" />
      <line x1="8" y1="20.4" x2="16" y2="20.4" />
    </g>
  ),
  trending: <path d="M4 16.5 9.5 11l3.5 3.5L20 7M14.5 7H20v5.5" />,
  search: <path d="M15.3 15.3 20 20M10 16.5a6.5 6.5 0 1 1 0-13 6.5 6.5 0 0 1 0 13Z" />,
  zap: <path d="M12.5 2 5.8 13.2h5l-1.3 8.8L18.2 10.8h-5l1.3-8.8Z" />,
  hourglass: <path d="M6.3 3h11.4M6.3 21h11.4M7.3 3c0 4.7 4.7 5.8 4.7 9s-4.7 4.3-4.7 9M16.7 3c0 4.7-4.7 5.8-4.7 9s4.7 4.3 4.7 9" />,
  temple: <path d="M3.5 20.5h17M4.5 20.5v-11M8.5 20.5v-11M15.5 20.5v-11M19.5 20.5v-11M3 9.5 12 4l9 5.5" />,
  repeat: <path d="M16.8 4.2 19.5 7l-2.7 2.8M19.5 7H7a4 4 0 0 0-4 4M7.2 19.8 4.5 17l2.7-2.8M4.5 17H17a4 4 0 0 0 4-4" />,
  spiral: <path d="M12 4.2a8 8 0 1 1-6.4 12.6M12 8.2a4 4 0 1 0 3.4 6.2" />,
  check: <path d="M4 12.5 9 17.5 20 5.5" />,
  x: <path d="M5.5 5.5 18.5 18.5M18.5 5.5 5.5 18.5" />,
  alert: (
    <g>
      <path d="M12 3.2 21 19.5H3Z" />
      <line x1="12" y1="10" x2="12" y2="14.2" />
      <circle cx="12" cy="16.8" r="0.15" fill="currentColor" stroke="currentColor" strokeWidth="1.6" />
    </g>
  ),
  star: <path d="M12 3 14.6 9.6 21.5 10.1 16.2 14.5 18 21.2 12 17.3 6 21.2 7.8 14.5 2.5 10.1 9.4 9.6Z" />,
  chevronRight: <path d="M9 5.5 16 12l-7 6.5" />,
  arrowUp: <path d="M6 14.5 12 8.5l6 6" />,
  arrowDown: <path d="M6 9.5 12 15.5l6-6" />,
  minus: <line x1="5" y1="12" x2="19" y2="12" />,
  plus: <path d="M12 5.2v13.6M5.2 12h13.6" />,
  diamond: <path d="M12 2.5 20.5 12 12 21.5 3.5 12Z" />,
  filter: <path d="M4 5.5h16M7.5 12h9M10.5 18.5h3" />,
};

const ELEMENT = {
  light: <circle cx="12" cy="12" r="4.2" />,
  water: <path d="M12 3.5s6.4 7.3 6.4 11.7a6.4 6.4 0 1 1-12.8 0C5.6 10.8 12 3.5 12 3.5Z" />,
  fire: <path d="M12 2.8c1.7 3.4-2.4 4.5-2.4 7.8a2.4 2.4 0 0 0 4.8 0c0-.8-.7-1.6-.7-2.4 1.6.9 2.5 2.6 2.5 4.4a4.4 4.4 0 0 1-8.8 0c0-4.3 2.7-6.2 4.6-9.8Z" />,
  earth: <path d="M4.5 18.5C2.7 12 7 4.5 19 4.5c0 11-7 15.2-14.5 14Z" />,
  wind: <path d="M3.5 8.2h9.8a2.6 2.6 0 1 0 0-5.2M3.5 12.6h11.8a2.6 2.6 0 1 1 0 5.2H7.5M3.5 17h6" />,
  dark: <path d="M19.8 13.2A8 8 0 1 1 10.8 4.2 6.4 6.4 0 0 0 19.8 13.2Z" />,
};

const SUN_RAYS = Array.from({ length: 8 }, (_, i) => {
  const a = (i / 8) * Math.PI * 2;
  const x1 = 12 + Math.cos(a) * 6.2, y1 = 12 + Math.sin(a) * 6.2;
  const x2 = 12 + Math.cos(a) * 8.4, y2 = 12 + Math.sin(a) * 8.4;
  return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} />;
});

/**
 * <Icon name="target" size={16} />
 * Outline icons use `strokeWidth`; element glyphs render as solid filled shapes.
 */
export default function Icon({ name, size = 16, strokeWidth = 1.7, className, style }) {
  if (name === 'light') {
    return (
      <svg
        width={size} height={size} viewBox="0 0 24 24"
        fill="currentColor" stroke="currentColor" strokeWidth={1.4}
        strokeLinecap="round" className={className} style={style} aria-hidden="true"
      >
        {ELEMENT.light}
        {SUN_RAYS}
      </svg>
    );
  }

  if (ELEMENT[name]) {
    return (
      <svg
        width={size} height={size} viewBox="0 0 24 24"
        fill="currentColor" stroke="none"
        className={className} style={style} aria-hidden="true"
      >
        {ELEMENT[name]}
      </svg>
    );
  }

  const body = OUTLINE[name];
  if (!body) return null;

  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth={strokeWidth}
      strokeLinecap="round" strokeLinejoin="round"
      className={className} style={style} aria-hidden="true"
    >
      {body}
    </svg>
  );
}
