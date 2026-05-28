export function normalizeMovieTitle(title: string) {
  return title.trim().replace(/\s+/g, " ").toLowerCase();
}
