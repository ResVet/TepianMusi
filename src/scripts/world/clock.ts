// Clock helpers with no three.js dependency, so the page script can use
// them before (or without) the 3D world.

/** "06.30" style clock text for a fractional hour. */
export function clockText(hour: number): string {
  const total = Math.round(hour * 60);
  const hh = Math.floor(total / 60) % 24;
  const mm = total % 60;
  return `${String(hh).padStart(2, '0')}.${String(mm).padStart(2, '0')}`;
}

/** A short Indonesian name for the part of the day. */
export function dayPart(hour: number): string {
  if (hour < 5.75) return 'Subuh';
  if (hour < 10.5) return 'Pagi';
  if (hour < 15) return 'Siang';
  if (hour < 18.2) return 'Sore';
  return 'Malam';
}
