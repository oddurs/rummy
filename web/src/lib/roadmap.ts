/** Status categories, mirroring cairn.toml. Shared by the server loader and the page. */
export function category(status: string): 'done' | 'dropped' | 'active' | 'open' {
  if (status === 'shipped') return 'done';
  if (status === 'dropped') return 'dropped';
  if (['exploring', 'building', 'review', 'blocked'].includes(status)) return 'active';
  return 'open';
}
