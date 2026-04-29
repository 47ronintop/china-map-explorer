import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

interface PanoramaViewerProps {
  /** 中清(默认/med)的 URL,会自动派生 -low / -high 变体 */
  src: string;
  /** 可选:预加载的下一张全景图 URL */
  preloadSrc?: string;
  className?: string;
}

type Quality = 'low' | 'med' | 'high';

// 从 med URL 派生 low/high 变体(约定:文件名以 -360.jpg 结尾)
function deriveVariants(src: string): Record<Quality, string> {
  const low = src.replace(/-360\.jpg(\?.*)?$/, '-360-low.jpg$1');
  const high = src.replace(/-360\.jpg(\?.*)?$/, '-360-high.jpg$1');
  return { low, med: src, high };
}

// 设备/网络评估 → 目标清晰度
function detectTargetQuality(): Quality {
  if (typeof navigator === 'undefined') return 'med';
  const conn = (navigator as any).connection;
  const saveData = conn?.saveData === true;
  const eff = conn?.effectiveType as string | undefined; // 'slow-2g'|'2g'|'3g'|'4g'
  const downlink = conn?.downlink as number | undefined; // Mbps
  const mem = (navigator as any).deviceMemory as number | undefined; // GB
  const cores = navigator.hardwareConcurrency || 4;
  const dpr = window.devicePixelRatio || 1;
  const isSmallScreen = Math.min(window.innerWidth, window.innerHeight) < 600;

  if (saveData || eff === 'slow-2g' || eff === '2g') return 'low';
  if (eff === '3g' || (downlink && downlink < 1.5)) return 'low';
  if ((mem && mem <= 2) || cores <= 2) return 'low';

  // 高清门槛:4g + 良好下行 + 不算羸弱设备 + 较大屏或高 DPR
  const goodNet = (eff === '4g' || !eff) && (!downlink || downlink >= 5);
  const goodDevice = (!mem || mem >= 4) && cores >= 4;
  if (goodNet && goodDevice && (!isSmallScreen || dpr >= 2)) return 'high';
  return 'med';
}

// 全局纹理缓存(按具体 URL)
const textureCache = new Map<string, THREE.Texture>();

function loadTexture(src: string): Promise<THREE.Texture> {
  const cached = textureCache.get(src);
  if (cached) return Promise.resolve(cached);
  return new Promise((resolve, reject) => {
    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin('anonymous');
    loader.load(
      src,
      tex => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.minFilter = THREE.LinearFilter;
        tex.generateMipmaps = false;
        textureCache.set(src, tex);
        resolve(tex);
      },
      undefined,
      reject
    );
  });
}

/**
 * 360° 全景查看器(自适应清晰度):
 * - 先用低清(low)极速显示;
 * - 后台再升级到目标清晰度(med/high),纹理热替换无感更新;
 * - 设备/网络评估决定目标档;
 * - 纹理缓存 + 下一张预加载(目标档)。
 */
export const PanoramaViewer = ({ src, preloadSrc, className }: PanoramaViewerProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [activeQuality, setActiveQuality] = useState<Quality>('low');

  // 预加载下一张(目标档)
  useEffect(() => {
    if (!preloadSrc) return;
    const variants = deriveVariants(preloadSrc);
    const target = detectTargetQuality();
    // 预热低清 + 目标档
    if (!textureCache.has(variants.low)) loadTexture(variants.low).catch(() => {});
    if (target !== 'low' && !textureCache.has(variants[target])) {
      loadTexture(variants[target]).catch(() => {});
    }
  }, [preloadSrc]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let disposed = false;
    let cleanup = () => {};
    const variants = deriveVariants(src);
    const target = detectTargetQuality();

    setLoading(!textureCache.has(variants.low) && !textureCache.has(variants[target]));
    setActiveQuality('low');

    // 起点:已缓存的最高档 → 否则低清
    const startSrc = textureCache.has(variants.high)
      ? variants.high
      : textureCache.has(variants.med)
      ? variants.med
      : variants.low;

    loadTexture(startSrc).then(initialTex => {
      if (disposed || !container) return;
      setLoading(false);
      setActiveQuality(startSrc === variants.high ? 'high' : startSrc === variants.med ? 'med' : 'low');

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(75, container.clientWidth / container.clientHeight, 0.1, 1100);
      camera.position.set(0, 0, 0.01);

      const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true, powerPreference: 'high-performance' });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
      renderer.setSize(container.clientWidth, container.clientHeight);
      container.appendChild(renderer.domElement);

      const geometry = new THREE.SphereGeometry(500, 48, 24);
      geometry.scale(-1, 1, 1);
      const material = new THREE.MeshBasicMaterial({ map: initialTex });
      const sphere = new THREE.Mesh(geometry, material);
      scene.add(sphere);

      let lon = 0, lat = 0;
      let isDown = false, downX = 0, downY = 0, downLon = 0, downLat = 0;
      let needsRender = true;
      let autoRotate = true;

      const onPointerDown = (e: PointerEvent) => {
        isDown = true; downX = e.clientX; downY = e.clientY;
        downLon = lon; downLat = lat;
        autoRotate = false;
        (e.target as Element).setPointerCapture?.(e.pointerId);
      };
      const onPointerMove = (e: PointerEvent) => {
        if (!isDown) return;
        lon = downLon - (e.clientX - downX) * 0.15;
        lat = Math.max(-85, Math.min(85, downLat + (e.clientY - downY) * 0.15));
        needsRender = true;
      };
      const onPointerUp = () => { isDown = false; };
      const onWheel = (e: WheelEvent) => {
        e.preventDefault();
        camera.fov = Math.max(30, Math.min(95, camera.fov + e.deltaY * 0.05));
        camera.updateProjectionMatrix();
        autoRotate = false;
        needsRender = true;
      };

      const dom = renderer.domElement;
      dom.style.cursor = 'grab';
      dom.style.touchAction = 'none';
      dom.addEventListener('pointerdown', onPointerDown);
      dom.addEventListener('pointermove', onPointerMove);
      dom.addEventListener('pointerup', onPointerUp);
      dom.addEventListener('pointercancel', onPointerUp);
      dom.addEventListener('wheel', onWheel, { passive: false });

      let raf = 0;
      const animate = () => {
        raf = requestAnimationFrame(animate);
        if (autoRotate) { lon += 0.03; needsRender = true; }
        if (!needsRender) return;
        needsRender = false;
        const phi = THREE.MathUtils.degToRad(90 - lat);
        const theta = THREE.MathUtils.degToRad(lon);
        camera.lookAt(
          500 * Math.sin(phi) * Math.cos(theta),
          500 * Math.cos(phi),
          500 * Math.sin(phi) * Math.sin(theta)
        );
        renderer.render(scene, camera);
      };
      animate();

      const onResize = () => {
        if (!container) return;
        camera.aspect = container.clientWidth / container.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(container.clientWidth, container.clientHeight);
        needsRender = true;
      };
      const ro = new ResizeObserver(onResize);
      ro.observe(container);

      // 渐进升级:low → target,纹理热替换
      const upgradeTo = (url: string, quality: Quality) => {
        if (disposed) return;
        loadTexture(url).then(tex => {
          if (disposed) return;
          material.map = tex;
          material.needsUpdate = true;
          needsRender = true;
          setActiveQuality(quality);
        }).catch(() => {});
      };

      if (target === 'high' && startSrc !== variants.high) {
        // 先 med 再 high(若 med 未缓存且 startSrc 为 low,med 是更快的中间档)
        if (startSrc === variants.low) upgradeTo(variants.med, 'med');
        upgradeTo(variants.high, 'high');
      } else if (target === 'med' && startSrc === variants.low) {
        upgradeTo(variants.med, 'med');
      }

      cleanup = () => {
        cancelAnimationFrame(raf);
        ro.disconnect();
        dom.removeEventListener('pointerdown', onPointerDown);
        dom.removeEventListener('pointermove', onPointerMove);
        dom.removeEventListener('pointerup', onPointerUp);
        dom.removeEventListener('pointercancel', onPointerUp);
        dom.removeEventListener('wheel', onWheel);
        geometry.dispose();
        material.dispose();
        renderer.dispose();
        if (dom.parentNode) dom.parentNode.removeChild(dom);
      };
    }).catch(() => {
      // 低清也失败时:回退到 med
      if (startSrc !== variants.med) {
        loadTexture(variants.med).catch(() => {});
      }
      setLoading(false);
    });

    return () => { disposed = true; cleanup(); };
  }, [src]);

  return (
    <div ref={containerRef} className={className} style={{ position: 'relative' }}>
      {loading && (
        <>
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${src})`, filter: 'blur(20px)', transform: 'scale(1.1)' }}
            aria-hidden
          />
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="paper-card px-4 py-2 text-sm text-muted-foreground animate-pulse">
              全景加载中…
            </div>
          </div>
        </>
      )}
      {!loading && activeQuality !== 'high' && (
        <div className="absolute bottom-2 right-2 pointer-events-none">
          <div className="px-2 py-0.5 text-[10px] rounded bg-background/60 text-muted-foreground backdrop-blur-sm">
            {activeQuality === 'low' ? '低清' : '中清'} · 升级中
          </div>
        </div>
      )}
    </div>
  );
};
