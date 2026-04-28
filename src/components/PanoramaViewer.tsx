import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

interface PanoramaViewerProps {
  src: string;
  /** 可选:预加载的下一张全景图 URL,提升切换速度 */
  preloadSrc?: string;
  className?: string;
}

// 简易纹理缓存,避免切回同一张时重新下载/解码
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
      err => reject(err)
    );
  });
}

/**
 * 360° 全景查看器:将 equirectangular (2:1) 图贴到球体内壁,
 * 鼠标/触摸拖动即可环视;轮子缩放视野。
 * 优化:纹理加载完才初始化 WebGL;纹理缓存;支持预加载下一张。
 */
export const PanoramaViewer = ({ src, preloadSrc, className }: PanoramaViewerProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(!textureCache.has(src));

  // 预加载下一张(不阻塞当前)
  useEffect(() => {
    if (preloadSrc && !textureCache.has(preloadSrc)) {
      loadTexture(preloadSrc).catch(() => {});
    }
  }, [preloadSrc]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let disposed = false;
    let cleanup = () => {};

    setLoading(!textureCache.has(src));

    loadTexture(src).then(texture => {
      if (disposed || !container) return;
      setLoading(false);

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(
        75,
        container.clientWidth / container.clientHeight,
        0.1,
        1100
      );
      camera.position.set(0, 0, 0.01);

      const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true, powerPreference: 'high-performance' });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
      renderer.setSize(container.clientWidth, container.clientHeight);
      container.appendChild(renderer.domElement);

      const geometry = new THREE.SphereGeometry(500, 48, 24);
      geometry.scale(-1, 1, 1);
      const material = new THREE.MeshBasicMaterial({ map: texture });
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
        // 纹理留在缓存中,不 dispose
        renderer.dispose();
        if (dom.parentNode) dom.parentNode.removeChild(dom);
      };
    }).catch(() => { setLoading(false); });

    return () => {
      disposed = true;
      cleanup();
    };
  }, [src]);

  return (
    <div ref={containerRef} className={className} style={{ position: 'relative' }}>
      {loading && (
        <div
          className="absolute inset-0 flex items-center justify-center bg-cover bg-center"
          style={{ backgroundImage: `url(${src})`, filter: 'blur(20px)', transform: 'scale(1.1)' }}
          aria-hidden
        />
      )}
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="paper-card px-4 py-2 text-sm text-muted-foreground animate-pulse">
            全景加载中…
          </div>
        </div>
      )}
    </div>
  );
};
