/** Where the site is served from, always with a trailing slash ("/" or "/repo/"). */
export const BASE = import.meta.env.BASE_URL.endsWith('/') ? import.meta.env.BASE_URL : `${import.meta.env.BASE_URL}/`;
