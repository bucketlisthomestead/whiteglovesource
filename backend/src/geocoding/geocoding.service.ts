import { Injectable, Logger } from '@nestjs/common';

export interface GeoPoint {
  latitude: number;
  longitude: number;
  displayName?: string;
}

@Injectable()
export class GeocodingService {
  private readonly logger = new Logger(GeocodingService.name);
  private readonly cache = new Map<string, GeoPoint | null>();

  async geocode(address: string): Promise<GeoPoint | null> {
    const query = address.trim();
    if (!query) return null;

    const cacheKey = query.toLowerCase();
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey) ?? null;
    }

    try {
      const url = new URL('https://nominatim.openstreetmap.org/search');
      url.searchParams.set('q', query);
      url.searchParams.set('format', 'json');
      url.searchParams.set('limit', '1');
      url.searchParams.set('countrycodes', 'us');

      const response = await fetch(url.toString(), {
        headers: {
          'User-Agent': 'WhiteGloveSource/1.0 (quote-mileage)',
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        this.logger.warn(`Geocoding failed (${response.status}) for: ${query}`);
        this.cache.set(cacheKey, null);
        return null;
      }

      const results = (await response.json()) as Array<{
        lat: string;
        lon: string;
        display_name?: string;
      }>;

      if (!results.length) {
        this.cache.set(cacheKey, null);
        return null;
      }

      const point: GeoPoint = {
        latitude: parseFloat(results[0].lat),
        longitude: parseFloat(results[0].lon),
        displayName: results[0].display_name,
      };
      this.cache.set(cacheKey, point);
      return point;
    } catch (err) {
      this.logger.warn(`Geocoding error for "${query}": ${err}`);
      this.cache.set(cacheKey, null);
      return null;
    }
  }
}
