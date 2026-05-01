import { env } from "@/config/env";

export function getGeoapifyStaticMapUrl(lat: number, lng: number) {
  if (!env.geoapifyApiKey) {
    return null;
  }
  const marker = encodeURIComponent(`lonlat:${lng},${lat};type:awesome;color:#ef4444;size:small`);
  return `https://maps.geoapify.com/v1/staticmap?style=osm-carto&width=900&height=420&center=lonlat:${lng},${lat}&zoom=15&marker=${marker}&apiKey=${env.geoapifyApiKey}`;
}

export function getGeoapifyMultiStaticMapUrl(points: Array<{ lat: number; lng: number }>) {
  if (!env.geoapifyApiKey || points.length === 0) {
    return null;
  }
  const avgLat = points.reduce((sum, p) => sum + p.lat, 0) / points.length;
  const avgLng = points.reduce((sum, p) => sum + p.lng, 0) / points.length;
  const markerParams = points
    .map((p) => {
      const marker = encodeURIComponent(`lonlat:${p.lng},${p.lat};type:awesome;color:#7c3aed;size:small`);
      return `marker=${marker}`;
    })
    .join("&");
  return `https://maps.geoapify.com/v1/staticmap?style=osm-carto&width=1200&height=700&center=lonlat:${avgLng},${avgLat}&zoom=13&${markerParams}&apiKey=${env.geoapifyApiKey}`;
}

export async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  if (!env.geoapifyApiKey) {
    return null;
  }
  const url = `https://api.geoapify.com/v1/geocode/reverse?lat=${lat}&lon=${lng}&apiKey=${env.geoapifyApiKey}`;
  const res = await fetch(url);
  if (!res.ok) {
    return null;
  }
  const json = (await res.json()) as { features?: Array<{ properties?: { formatted?: string } }> };
  return json.features?.[0]?.properties?.formatted ?? null;
}

