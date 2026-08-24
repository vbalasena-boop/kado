/**
 * Exécute `fn` sur chaque élément avec une concurrence maximale bornée.
 * Utile pour paralléliser des envois (e-mails) sans lancer des centaines de
 * requêtes d'un coup ni dépasser le `maxDuration` du cron.
 */
export async function mapLimit<T>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<void>
): Promise<void> {
  const n = Math.max(1, concurrency);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const idx = cursor++;
      await fn(items[idx], idx);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, () => worker())
  );
}
