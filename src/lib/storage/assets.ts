import { assetKey, openDb } from './db';

export async function getAssets(
  bookId: string,
  paths: readonly string[],
): Promise<Map<string, Blob>> {
  const result = new Map<string, Blob>();
  if (paths.length === 0) return result;

  const database = await openDb();
  for (const path of paths) {
    const record = await database.get('assets', assetKey(bookId, path));
    if (record !== undefined) result.set(path, record.blob);
  }
  return result;
}
