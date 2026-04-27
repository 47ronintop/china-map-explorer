import { useEffect, useRef } from 'react';
import L from 'leaflet';

// 修复默认 marker 图标
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

interface ChinaMapProps {
  guess: [number, number] | null;
  onGuess: (latlng: [number, number]) => void;
  truth?: [number, number] | null; // 揭晓时显示
  interactive?: boolean;
  className?: string;
}

// 中国大致经纬度边界
const CHINA_BOUNDS: L.LatLngBoundsExpression = [
  [15, 70],
  [55, 138],
];

export default function ChinaMap({
  guess,
  onGuess,
  truth = null,
  interactive = true,
  className,
}: ChinaMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const guessMarkerRef = useRef<L.Marker | null>(null);
  const truthMarkerRef = useRef<L.Marker | null>(null);
  const lineRef = useRef<L.Polyline | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [35, 105],
      zoom: 4,
      minZoom: 3,
      maxZoom: 10,
      maxBounds: CHINA_BOUNDS,
      maxBoundsViscosity: 1.0,
      zoomControl: true,
      attributionControl: true,
    });

    L.tileLayer(
      'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
      {
        attribution: '&copy; OpenStreetMap, &copy; CARTO',
        subdomains: 'abcd',
      }
    ).addTo(map);

    map.fitBounds(CHINA_BOUNDS);
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // 绑定/解绑点击
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const handler = (e: L.LeafletMouseEvent) => {
      onGuess([e.latlng.lng, e.latlng.lat]);
    };
    if (interactive) {
      map.on('click', handler);
      map.getContainer().style.cursor = 'crosshair';
    }
    return () => {
      map.off('click', handler);
    };
  }, [interactive, onGuess]);

  // 渲染猜测标记
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (guessMarkerRef.current) {
      map.removeLayer(guessMarkerRef.current);
      guessMarkerRef.current = null;
    }
    if (guess) {
      guessMarkerRef.current = L.marker([guess[1], guess[0]]).addTo(map);
    }
  }, [guess]);

  // 渲染真实位置 + 连线
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (truthMarkerRef.current) {
      map.removeLayer(truthMarkerRef.current);
      truthMarkerRef.current = null;
    }
    if (lineRef.current) {
      map.removeLayer(lineRef.current);
      lineRef.current = null;
    }
    if (truth) {
      const truthIcon = L.divIcon({
        className: '',
        html: `<div style="width:18px;height:18px;border-radius:50%;background:hsl(0,65%,42%);border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.4);"></div>`,
        iconSize: [18, 18],
        iconAnchor: [9, 9],
      });
      truthMarkerRef.current = L.marker([truth[1], truth[0]], {
        icon: truthIcon,
      }).addTo(map);
      if (guess) {
        lineRef.current = L.polyline(
          [
            [guess[1], guess[0]],
            [truth[1], truth[0]],
          ],
          { color: 'hsl(0,65%,42%)', dashArray: '6,8', weight: 2 }
        ).addTo(map);
        map.fitBounds(lineRef.current.getBounds(), { padding: [40, 40] });
      } else {
        map.setView([truth[1], truth[0]], 5);
      }
    }
  }, [truth, guess]);

  return <div ref={containerRef} className={className} />;
}
