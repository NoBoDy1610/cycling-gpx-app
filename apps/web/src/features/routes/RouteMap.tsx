import { useEffect, useRef, useState } from 'react';
import { control, featureGroup, map, polyline, tileLayer } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { MapPoint } from './routes-api';
import { unwrapSegments } from './map-geometry';

const tileUrl = import.meta.env.VITE_MAP_TILE_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const tileAttribution = import.meta.env.VITE_MAP_TILE_ATTRIBUTION ||
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

export default function RouteMap({ title, segments, pointCount }: { title: string; segments: MapPoint[][]; pointCount: number }) {
  const target = useRef<HTMLDivElement>(null);
  const [tilesUnavailable, setTilesUnavailable] = useState(false);

  useEffect(() => {
    const element = target.current;
    if (!element) return;

    const routeMap = map(element, { preferCanvas: pointCount >= 10_000, zoomControl: false });
    control.zoom({ zoomInTitle: 'Powiększ', zoomOutTitle: 'Pomniejsz' }).addTo(routeMap);
    routeMap.attributionControl.setPrefix(false);

    let loadedTiles = 0;
    const tiles = tileLayer(tileUrl, { attribution: tileAttribution, maxZoom: 19 })
      .on('loading', () => { loadedTiles = 0; })
      .on('tileload', () => { loadedTiles += 1; })
      .on('load', () => setTilesUnavailable(loadedTiles === 0))
      .addTo(routeMap);

    const lines = featureGroup(unwrapSegments(segments).map((points) =>
      polyline(points, { color: '#0f766e', weight: 4, opacity: 0.95, interactive: false }),
    )).addTo(routeMap);
    routeMap.fitBounds(lines.getBounds(), { padding: [24, 24], maxZoom: 16 });

    const resizeObserver = new ResizeObserver(() => routeMap.invalidateSize({ pan: false }));
    resizeObserver.observe(element);
    return () => {
      resizeObserver.disconnect();
      tiles.off();
      routeMap.remove();
    };
  }, [segments, pointCount]);

  return (
    <div className="relative isolate overflow-hidden rounded-xl border border-stone-200">
      <div ref={target} className="h-72 w-full !bg-stone-200 sm:h-96" role="region" aria-label={`Mapa trasy ${title}`} />
      {tilesUnavailable && (
        <p role="status" className="pointer-events-none absolute bottom-7 left-3 z-[500] rounded-md bg-white px-3 py-2 text-sm text-stone-800 shadow-sm">
          Podkład mapy jest chwilowo niedostępny.
        </p>
      )}
    </div>
  );
}
