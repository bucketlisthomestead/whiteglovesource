import { StorageService } from '../storage/storage.service';

export async function loadPhotoBuffers(
  urls: string[],
  storage: StorageService,
): Promise<Map<string, Buffer>> {
  const cache = new Map<string, Buffer>();
  const unique = [...new Set(urls.filter(Boolean))];

  await Promise.all(
    unique.map(async (url) => {
      const buffer = await storage.readPhotoByUrl(url);
      if (buffer) cache.set(url, buffer);
    }),
  );

  return cache;
}
