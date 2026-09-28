// src/map/metroManilaExtent.ts

/**
 * The predefined default geographic bounding box that frames the NCR
 * (Metro_Manila_Extent). The map initializes framed on this extent so the
 * initial center is inside the NCR and the default view is never framed on
 * areas outside Metro Manila (Req 1.2, 1.3).
 *
 * The box approximately covers the 17 NCR jurisdictions (Caloocan, Las Piñas,
 * Makati, Malabon, Mandaluyong, Manila, Marikina, Muntinlupa, Navotas,
 * Parañaque, Pasay, Pasig, Pateros, Quezon City, San Juan, Taguig, and
 * Valenzuela). Coordinates are `[longitude, latitude]` pairs in WGS84 degrees,
 * expressed as a Mapbox GL JS `LngLatBounds`-compatible `[[west, south], [east,
 * north]]` tuple.
 *
 * These are intentionally approximate framing bounds, not authoritative
 * administrative boundaries.
 */

/** West/east longitudes and south/north latitudes of the NCR framing box. */
export const METRO_MANILA_BOUNDS = {
  /** Western longitude edge (Manila Bay side). */
  west: 120.9,
  /** Southern latitude edge (Muntinlupa side). */
  south: 14.4,
  /** Eastern longitude edge (Marikina / Pasig side). */
  east: 121.15,
  /** Northern latitude edge (Valenzuela / Caloocan side). */
  north: 14.78,
} as const;

/**
 * The NCR default extent as a Mapbox GL JS `LngLatBounds`-compatible tuple:
 * `[[west, south], [east, north]]` with each corner a `[lng, lat]` pair
 * (Req 1.2, 1.3). Pass directly to `map.fitBounds(...)` or the `bounds` map
 * option.
 */
export const METRO_MANILA_EXTENT: [[number, number], [number, number]] = [
  [METRO_MANILA_BOUNDS.west, METRO_MANILA_BOUNDS.south],
  [METRO_MANILA_BOUNDS.east, METRO_MANILA_BOUNDS.north],
];

/**
 * The geographic center of {@link METRO_MANILA_EXTENT} as a `[lng, lat]` pair.
 * Guaranteed to lie inside the extent, so a map framed on the extent has its
 * center inside the NCR (Req 1.2).
 */
export const METRO_MANILA_CENTER: [number, number] = [
  (METRO_MANILA_BOUNDS.west + METRO_MANILA_BOUNDS.east) / 2,
  (METRO_MANILA_BOUNDS.south + METRO_MANILA_BOUNDS.north) / 2,
];

/**
 * Returns true iff the given `[lng, lat]` point lies within (inclusive of the
 * edges) the Metro_Manila_Extent. Used to check whether a detected location is
 * inside the NCR (Req 6.6) and to assert center-in-NCR framing (Req 1.2).
 *
 * @param lng - Longitude in WGS84 degrees.
 * @param lat - Latitude in WGS84 degrees.
 */
export function isWithinMetroManila(lng: number, lat: number): boolean {
  return (
    lng >= METRO_MANILA_BOUNDS.west &&
    lng <= METRO_MANILA_BOUNDS.east &&
    lat >= METRO_MANILA_BOUNDS.south &&
    lat <= METRO_MANILA_BOUNDS.north
  );
}
