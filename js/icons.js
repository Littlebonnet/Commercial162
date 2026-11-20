// Icônes au trait, homogènes (remplacent les emojis). ic('phone') → <svg>…</svg>
const P = {
  home: 'M3 10.5 12 3l9 7.5M5.5 9v11h4.5v-6h4v6h4.5V9',
  route: 'M6 21a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM18 8a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM6 16v-3a4 4 0 0 1 4-4h4a4 4 0 0 0 4-4',
  users: 'M16 20v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 18.5V20M10 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM20 20v-1.5a3.5 3.5 0 0 0-2.5-3.35M15.5 4.15a3.5 3.5 0 0 1 0 6.7',
  chart: 'M4 4v16h16M8 16v-4M12 16V8M16 16v-6',
  more: 'M5 5h5v5H5zM14 5h5v5h-5zM5 14h5v5H5zM14 14h5v5h-5z',
  phone: 'M21 16.5v3a2 2 0 0 1-2.2 2 19.5 19.5 0 0 1-8.5-3 19.2 19.2 0 0 1-5.9-5.9 19.5 19.5 0 0 1-3-8.6A2 2 0 0 1 3.4 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.6a2 2 0 0 1-.5 2.1L7.4 9.6a16 16 0 0 0 6 6l1.2-1.2a2 2 0 0 1 2.1-.5c.8.3 1.7.6 2.6.7a2 2 0 0 1 1.7 2Z',
  headset: 'M4 17v-5a8 8 0 0 1 16 0v5M20 18a2 2 0 0 1-2 2h-1.5v-6H20zM4 18a2 2 0 0 0 2 2h1.5v-6H4z',
  nav: 'M3 11 21 3l-8 18-2-8z',
  check: 'M20 6 9 17l-5-5',
  bell: 'M18 8.5a6 6 0 0 0-12 0C6 15 3.5 17 3.5 17h17S18 15 18 8.5M13.7 20.5a2 2 0 0 1-3.4 0',
  plus: 'M12 5v14M5 12h14',
  map: 'M9 4 3 6.5v14L9 18l6 2.5 6-2.5V4l-6 2.5zM9 4v14M15 6.5v14',
  list: 'M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01',
  calendar: 'M4 5h16v15H4zM16 3v4M8 3v4M4 10h16',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 7v5l3 2',
  alert: 'M10.3 4 2.5 17.5A2 2 0 0 0 4.2 20.5h15.6a2 2 0 0 0 1.7-3L13.7 4a2 2 0 0 0-3.4 0ZM12 9.5v4M12 17h.01',
  edit: 'M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17zM14 7l3 3',
  trash: 'M4 7h16M9 7V4.5h6V7M18 7l-.9 13H6.9L6 7',
  back: 'M15 18l-6-6 6-6',
  next: 'M9 18l6-6-6-6',
  close: 'M18 6 6 18M6 6l12 12',
  up: 'M6 15l6-6 6 6',
  down: 'M6 9l6 6 6-6',
  mail: 'M4 5h16v14H4zM4 7l8 6 8-6',
  file: 'M14 3H6v18h12V7zM14 3v4h4M9 13h6M9 17h4',
  box: 'M20 8 12 4 4 8v8l8 4 8-4zM4 8l8 4 8-4M12 12v8',
  user: 'M19 20v-1.5a3.5 3.5 0 0 0-3.5-3.5h-7A3.5 3.5 0 0 0 5 18.5V20M12 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14ZM20 20l-4-4',
  sliders: 'M4 20v-6M4 10V4M12 20v-8M12 8V4M20 20v-4M20 12V4M2 14h4M10 8h4M18 16h4',
  download: 'M20 15v3a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-3M8 11l4 4 4-4M12 15V4',
  upload: 'M20 15v3a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-3M16 8l-4-4-4 4M12 4v11',
  cloud: 'M17.5 19H8a5 5 0 1 1 .9-9.9A6 6 0 0 1 20.4 11 4 4 0 0 1 17.5 19Z',
  star: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z',
  pin: 'M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0ZM12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
  refresh: 'M20 5v5h-5M4 19v-5h5M5.6 9a7 7 0 0 1 12.2-2.4L20 10M4 14l2.2 3.4A7 7 0 0 0 18.4 15',
  coffee: 'M17 8h1.5a3 3 0 0 1 0 6H17M3 8h14v7a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4zM7 3v2M11 3v2',
  car: 'M5 16h14M4 16v-4l2-5h12l2 5v4M7 16v2.5M17 16v2.5M6.5 12h.01M17.5 12h.01',
  euro: 'M17 6.5A6.5 6.5 0 1 0 17 17.5M4 10h9M4 14h9',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 11v5M12 8h.01',
  ban: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM5.6 5.6l12.8 12.8',
  catalog: 'M4 5a2 2 0 0 1 2-2h12v18H6a2 2 0 0 1-2-2zM8 7h6M8 11h6',
  report: 'M6 3h9l4 4v14H6zM9 17v-3M12 17v-6M15 17v-4',
  lock: 'M6 11h12v10H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3',
  door: 'M5 21h14M7 21V3h10v18M14 12h.01',
};

export function ic(name, size = 22, cls = '') {
  const d = P[name] || P.info;
  return `<svg class="ic ${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>`;
}

// Petit logo dans la barre du haut (remplaçable par le logo officiel : icons/logo.png)
export const LOGO = `<span class="brand" aria-label="Alpagel"><svg class="brand-mark" viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="8" fill="#1B6DB5"/><path d="M4 24 12.5 11l4.5 6.5L20 13l8 11z" fill="#fff"/><circle cx="23.5" cy="9" r="3" fill="#DD4B3E"/></svg><span class="brand-name">Alpagel</span></span>`;
