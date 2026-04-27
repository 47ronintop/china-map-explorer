import { useEffect, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface ChinaMapProps {
  guess: [number, number] | null; // [lng, lat]
  onGuess: (latlng: [number, number]) => void;
  truth?: [number, number] | null;
  interactive?: boolean;
  className?: string;
}

// 自定义 marker 图标（避免 leaflet 默认 png 资源问题）
const guessIcon = L.divIcon({
  className: '',
  html: `<div style="width:18px;height:18px;border-radius:50%;background:hsl(var(--primary));border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,.4);"></div>`,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});
const truthIcon = L.divIcon({
  className: '',
  html: `<div style="width:20px;height:20px;border-radius:50%;background:hsl(0,65%,42%);border:3px solid white;box-shadow:0 1px 4px rgba(0,0,0,.4);"></div>`,
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

function ClickHandler({ onClick, enabled }: { onClick: (lng: number, lat: number) => void; enabled: boolean }) {
  useMapEvents({
    click(e) {
      if (!enabled) return;
      onClick(e.latlng.lng, e.latlng.lat);
    },
  });
  return null;
}

function FocusOnReveal({ guess, truth }: { guess: [number, number] | null; truth: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (!guess || !truth) return;
    const bounds = L.latLngBounds([
      [guess[1], guess[0]],
      [truth[1], truth[0]],
    ]);
    map.flyToBounds(bounds, { padding: [60, 60], duration: 0.9, maxZoom: 9 });
  }, [guess, truth, map]);
  return null;
}

export default function ChinaMap({
  guess,
  onGuess,
  truth = null,
  interactive = true,
  className,
}: ChinaMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // 中国大致中心
  const initialCenter: [number, number] = useMemo(() => [36, 104], []);

  return (
    <div
      ref={containerRef}
      className={`relative bg-[hsl(var(--paper))] ${className ?? ''}`}
      style={{ cursor: interactive ? 'crosshair' : 'default' }}
    >
      <MapContainer
        center={initialCenter}
        zoom={4}
        minZoom={3}
        maxZoom={17}
        style={{ width: '100%', height: '100%', background: 'hsl(var(--paper))' }}
        zoomControl={true}
        worldCopyJump={false}
      >
        {/* 在线瓦片底图：CartoDB Voyager（中文友好、清晰、含河流城市道路） */}
        <TileLayer
          attribution='&copy; OpenStreetMap, &copy; CartoDB'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        />

        <ClickHandler enabled={interactive && !truth} onClick={(lng, lat) => onGuess([lng, lat])} />

        {guess && (
          <Marker position={[guess[1], guess[0]]} icon={guessIcon} interactive={false} />
        )}
        {truth && (
          <Marker position={[truth[1], truth[0]]} icon={truthIcon} interactive={false} />
        )}
        {guess && truth && (
          <Polyline
            positions={[
              [guess[1], guess[0]],
              [truth[1], truth[0]],
            ]}
            pathOptions={{ color: 'hsl(0,65%,42%)', weight: 2, dashArray: '6 8' }}
          />
        )}
        {truth && <FocusOnReveal guess={guess} truth={truth} />}
      </MapContainer>
    </div>
  );
}
