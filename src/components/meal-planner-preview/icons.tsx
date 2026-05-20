'use client';

import React from 'react';

const ICONS: Record<string, string> = {
  panel:     'M3 3h7v9H3z M14 3h7v5h-7z M14 12h7v9h-7z M3 16h7v5H3z',
  recipes:   'M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z',
  calendar:  'M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z',
  nutrition: 'M3 3h18v4H3z M3 11h18v4H3z M3 19h18v2H3z',
  cart:      'M3 3h2l3 12h11l3-8H6 M9 21a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z M19 21a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z',
  flame:     'M12 2c0 0-5 5.5-5 9.5a5 5 0 0 0 10 0C17 7.5 12 2 12 2z',
  edit:      'M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z',
  search:    'M21 21l-4.35-4.35M17 11A6 6 0 1 0 5 11a6 6 0 0 0 12 0z',
  plus:      'M12 5v14M5 12h14',
  check:     'M20 6 9 17l-5-5',
  chevL:     'M15 18l-6-6 6-6',
  chevR:     'M9 18l6-6-6-6',
  x:         'M18 6 6 18M6 6l12 12',
  drag:      'M9 5h.01M9 12h.01M9 19h.01M15 5h.01M15 12h.01M15 19h.01',
  sun:       'M12 4V2M12 22v-2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41 M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10z',
  moon:      'M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z',
  leaf:      'M21 3 C9 3 3 11 3 21 21 21 21 11 21 3z M3 21l9-9',
  star:      'M12 2l3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z',
  sparkle:   'M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5z M19 14l.7 2.3L22 17l-2.3.7L19 20l-.7-2.3L16 17l2.3-.7z',
  globe:     'M12 2a10 10 0 1 0 0 20A10 10 0 0 0 12 2z M2 12h20 M12 2a14 14 0 0 1 0 20 14 14 0 0 1 0-20z',
  collapse:  'M19 12H5M5 12l6-6M5 12l6 6',
  more:      'M5 12h.01M12 12h.01M19 12h.01',
  refresh:   'M3 12a9 9 0 0 1 15-6.7L21 8 M21 3v5h-5 M21 12a9 9 0 0 1-15 6.7L3 16 M3 21v-5h5',
  layers:    'M12 2 2 7l10 5 10-5z M2 17l10 5 10-5 M2 12l10 5 10-5',
  filter:    'M3 4h18l-7 9v6l-4 2v-8z',
  clock:     'M12 2a10 10 0 1 0 0 20A10 10 0 0 0 12 2z M12 6v6l4 2',
  utensils:  'M3 2v7a3 3 0 0 0 6 0V2 M6 9v13 M14 2v20 M14 9c0-3 3-7 6-7v20',
};

interface IconProps {
  name: string;
  size?: number;
  color?: string;
  strokeWidth?: number;
  style?: React.CSSProperties;
}

export function Icon({ name, size = 20, color = 'currentColor', strokeWidth = 1.5, style }: IconProps) {
  const d = ICONS[name] || '';
  const paths = d.split(/(?=[ML])/).filter(Boolean);
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ flexShrink: 0, ...style }}
    >
      {paths.map((path, i) => <path key={i} d={path} />)}
    </svg>
  );
}
