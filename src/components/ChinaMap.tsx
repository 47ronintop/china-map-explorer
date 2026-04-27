import { useEffect, useRef, useState, useCallback } from 'react';
import {
  ComposableMap,
  Geographies,
  Geography,
  ZoomableGroup,
} from 'react-simple-maps';

interface ChinaMapProps {
  guess: [number, number] | null; // [lng, lat]
  onGuess: (latlng: [number, number]) => void;
  truth?: [number, number] | null;
  interactive?: boolean;
  className?: string;
}

// 经验公式：把 SVG 像素 → 经纬度（基于 mercator 投影 + 当前 zoom/center）
// 我们改用 react-simple-maps 提供的 projection 实例，通过 ref 反算。
// 这里采用更直接的办法：用 d3-geo 的 mercator 投影。
import { geoMercator } from 'd3-geo';

const WIDTH = 800;
const HEIGHT = 600;
const PROJECTION_CONFIG = {
  scale: 600,
  center: [104, 36] as [number, number],
};

const projection = geoMercator()
  .center(PROJECTION_CONFIG.center)
  .scale(PROJECTION_CONFIG.scale)
  .translate([WIDTH / 2, HEIGHT / 2]);

export default function ChinaMap({
  guess,
  onGuess,
  truth = null,
  interactive = true,
  className,
}: ChinaMapProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ coordinates: [number, number]; zoom: number }>({
    coordinates: [104, 36],
    zoom: 1,
  });

  // 把经纬度投影到当前 SVG 坐标，然后再考虑 ZoomableGroup 的 transform。
  // ZoomableGroup 的 transform：translate(W/2,H/2) scale(zoom) translate(-projX(c), -projY(c))
  // 所以 一个地理坐标 (lng,lat) 在容器中的最终像素位置：
  // sx = W/2 + zoom * (projX(p) - projX(c))
  // sy = H/2 + zoom * (projY(p) - projY(c))
  const projectToScreen = useCallback(
    (lng: number, lat: number, rectW: number, rectH: number) => {
      const [px, py] = projection([lng, lat])!;
      const [cx, cy] = projection(pos.coordinates)!;
      const sx = WIDTH / 2 + pos.zoom * (px - cx);
      const sy = HEIGHT / 2 + pos.zoom * (py - cy);
      // SVG 用 preserveAspectRatio meet → 等比缩放并居中
      const scale = Math.min(rectW / WIDTH, rectH / HEIGHT);
      const offsetX = (rectW - WIDTH * scale) / 2;
      const offsetY = (rectH - HEIGHT * scale) / 2;
      return {
        x: offsetX + sx * scale,
        y: offsetY + sy * scale,
      };
    },
    [pos]
  );

  const handleClick = useCallback(
    (geoCoords: [number, number]) => {
      if (!interactive) return;
      onGuess(geoCoords);
    },
    [interactive, onGuess]
  );

  // 揭晓时计算屏幕坐标用于画线
  const [screenPositions, setScreenPositions] = useState<{
    guess: { x: number; y: number } | null;
    truth: { x: number; y: number } | null;
    rect: { w: number; h: number };
  }>({ guess: null, truth: null, rect: { w: 0, h: 0 } });

  useEffect(() => {
    if (!wrapperRef.current) return;
    const update = () => {
      const rect = wrapperRef.current!.getBoundingClientRect();
      setScreenPositions({
        guess: guess ? projectToScreen(guess[0], guess[1], rect.width, rect.height) : null,
        truth: truth ? projectToScreen(truth[0], truth[1], rect.width, rect.height) : null,
        rect: { w: rect.width, h: rect.height },
      });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(wrapperRef.current);
    return () => ro.disconnect();
  }, [guess, truth, projectToScreen]);

  return (
    <div
      ref={wrapperRef}
      className={`relative bg-[hsl(var(--paper))] ${className ?? ''}`}
      style={{ cursor: interactive ? 'crosshair' : 'default' }}
    >
      <ComposableMap
        projection="geoMercator"
        projectionConfig={PROJECTION_CONFIG}
        width={WIDTH}
        height={HEIGHT}
        style={{ width: '100%', height: '100%' }}
      >
        <ZoomableGroup
          zoom={pos.zoom}
          center={pos.coordinates}
          minZoom={1}
          maxZoom={6}
          onMoveEnd={(p) => setPos(p)}
        >
          <Geographies geography="/china.json">
            {({ geographies }) =>
              geographies.map((geo) => (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  onClick={(evt: React.MouseEvent<SVGPathElement>) => {
                    // 用 d3 投影反算点击位置的经纬度
                    const svg = (evt.target as SVGPathElement).ownerSVGElement;
                    if (!svg) return;
                    const pt = svg.createSVGPoint();
                    pt.x = evt.clientX;
                    pt.y = evt.clientY;
                    const ctm = svg.getScreenCTM();
                    if (!ctm) return;
                    const local = pt.matrixTransform(ctm.inverse());
                    // local 是在 SVG viewBox 坐标里（已包含 ZoomableGroup transform）
                    // 反推：(local.x - W/2)/zoom + projX(center) = projX(point)
                    const [cx, cy] = projection(pos.coordinates)!;
                    const px = (local.x - WIDTH / 2) / pos.zoom + cx;
                    const py = (local.y - HEIGHT / 2) / pos.zoom + cy;
                    const inv = projection.invert!([px, py]);
                    if (inv) handleClick([inv[0], inv[1]]);
                  }}
                  style={{
                    default: {
                      fill: 'hsl(var(--muted))',
                      stroke: 'hsl(var(--border))',
                      strokeWidth: 0.5,
                      outline: 'none',
                    },
                    hover: {
                      fill: 'hsl(var(--accent) / 0.3)',
                      stroke: 'hsl(var(--border))',
                      strokeWidth: 0.5,
                      outline: 'none',
                      cursor: interactive ? 'crosshair' : 'default',
                    },
                    pressed: {
                      fill: 'hsl(var(--accent) / 0.5)',
                      outline: 'none',
                    },
                  }}
                />
              ))
            }
          </Geographies>
        </ZoomableGroup>
      </ComposableMap>

      {/* Marker overlay (绝对定位，避免随 ZoomableGroup transform 抖动) */}
      <svg
        className="pointer-events-none absolute inset-0 w-full h-full"
        viewBox={`0 0 ${screenPositions.rect.w} ${screenPositions.rect.h}`}
        preserveAspectRatio="none"
      >
        {screenPositions.guess && screenPositions.truth && (
          <line
            x1={screenPositions.guess.x}
            y1={screenPositions.guess.y}
            x2={screenPositions.truth.x}
            y2={screenPositions.truth.y}
            stroke="hsl(0,65%,42%)"
            strokeWidth={2}
            strokeDasharray="6 8"
          />
        )}
        {screenPositions.guess && (
          <g transform={`translate(${screenPositions.guess.x},${screenPositions.guess.y})`}>
            <circle r={8} fill="hsl(var(--primary))" stroke="white" strokeWidth={2} />
          </g>
        )}
        {screenPositions.truth && (
          <g transform={`translate(${screenPositions.truth.x},${screenPositions.truth.y})`}>
            <circle r={9} fill="hsl(0,65%,42%)" stroke="white" strokeWidth={3} />
          </g>
        )}
      </svg>

      {/* 缩放按钮 */}
      <div className="absolute top-3 right-3 flex flex-col gap-1 z-10">
        <button
          type="button"
          onClick={() => setPos((p) => ({ ...p, zoom: Math.min(p.zoom * 1.5, 6) }))}
          className="w-8 h-8 bg-card border border-border rounded shadow text-lg font-bold hover:bg-accent/20"
        >
          +
        </button>
        <button
          type="button"
          onClick={() => setPos((p) => ({ ...p, zoom: Math.max(p.zoom / 1.5, 1) }))}
          className="w-8 h-8 bg-card border border-border rounded shadow text-lg font-bold hover:bg-accent/20"
        >
          −
        </button>
        <button
          type="button"
          onClick={() => setPos({ coordinates: [104, 36], zoom: 1 })}
          className="w-8 h-8 bg-card border border-border rounded shadow text-xs hover:bg-accent/20"
          title="重置"
        >
          ⟲
        </button>
      </div>
    </div>
  );
}
