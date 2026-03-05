/**
 * Geocodes a street address using the Mapbox Geocoding API v6.
 *
 * Returns `{ lat, lng }` on the first result, or `null` when:
 *   - `address` is null or empty
 *   - The `MAPBOX_ACCESS_TOKEN` env var is missing
 *   - The API returns a non-2xx status
 *   - The API returns zero results
 *   - The request throws (network error, timeout, etc.)
 *
 * Failures are intentionally silent so callers can fall back to
 * storing null coordinates without disrupting trip creation.
 */
export async function geocodeAddress(
  address: string | null
): Promise<{ lat: number; lng: number } | null> {
  if (!address) return null;

  const token = process.env.MAPBOX_ACCESS_TOKEN;
  if (!token) return null;

  try {
    const url = `https://api.mapbox.com/search/geocode/v6/forward?q=${encodeURIComponent(address)}&limit=1&access_token=${token}`;
    const res = await fetch(url);
    if (!res.ok) return null;

    const data = await res.json();
    const feature = data?.features?.[0];
    if (!feature) return null;

    const [lng, lat] = feature.geometry.coordinates as [number, number];
    return { lat, lng };
  } catch {
    return null;
  }
}
