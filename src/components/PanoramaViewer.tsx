import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

interface PanoramaViewerProps {
  /** 中清(默认/med)的 URL,会自动派生 -low / -high 变体 */
  src: string;
  /** 可选:预加载的下一张全景图 URL */
  preloadSrc?: string;
  /** 首帧真正渲染完成后回调,用于开始倒计时 */
  onReady?: () => void;
  className?: string;
}

type Quality = 'low' | 'med' | 'high';

function deriveVariants(src: string): Record<Quality, string> {
  // 本地 Vite 资源发布后会被加 hash,无法可靠通过字符串派生变体；直接使用原图。
  if (src.startsWith('/') || src.startsWith('blob:') || src.startsWith('data:')) {
    return { low: src, med: src, high: src };
  }
  const low = src.replace(/-360\.jpg(\?.*)?$/, '-360-low.jpg$1');
  const high = src.replace(/-360\.jpg(\?.*)?$/, '-360-high.jpg$1');
  return { low, med: src, high };
}

function detectTargetQuality(): Quality {
  if (typeof navigator === 'undefined') return 'med';
  const conn = (navigator as any).connection;
  const saveData = conn?.saveData === true;
  const eff = conn?.effectiveType as string | undefined;
  const downlink = conn?.downlink as number | undefined;
  const mem = (navigator as any).deviceMemory as number | undefined;
  const cores = navigator.hardwareConcurrency || 4;
  const dpr = window.devicePixelRatio || 1;
  const isSmallScreen = Math.min(window.innerWidth, window.innerHeight) < 600;

  if (saveData || eff === 'slow-2g' || eff === '2g') return 'low';
  if (eff === '3g' || (downlink && downlink < 1.5)) return 'low';
  if ((mem && mem <= 2) || cores <= 2) return 'low';

  const goodNet = (eff === '4g' || !eff) && (!downlink || downlink >= 5);
  const goodDevice = (!mem || mem >= 4) && cores >= 4;
  if (goodNet && goodDevice && (!isSmallScreen || dpr >= 2)) return 'high';
  return 'med';
}

// 全局缓存:URL → Texture / 进行中的 Promise(去重)
const textureCache = new Map<string, THREE.Texture>();
const inflight = new Map<string, Promise<THREE.Texture>>();

function uniqueUrls(urls: string[]) {
  return Array.from(new Set(urls.filter(Boolean)));
}

function imageToTexture(img: HTMLImageElement) {
  const tex = new THREE.Texture(img);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}

async function decodeBlobImage(blob: Blob): Promise<HTMLImageElement> {
  const objectUrl = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = objectUrl;
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('image decode failed'));
    });
    try { if (img.decode) await img.decode(); } catch { /* ignore */ }
    return img;
  } finally {
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  }
}

async function fetchImageWithProgress(
  src: string,
  priority: 'high' | 'low' | 'auto',
  onProgress?: (progress: number) => void
): Promise<HTMLImageElement> {
  const response = await fetch(src, { cache: 'force-cache', priority } as RequestInit & { priority?: string });
  if (!response.ok) throw new Error(`image request failed: ${response.status}`);
  const total = Number(response.headers.get('content-length')) || 0;

  // 无 content-length 时,基于时间的伪进度,缓慢逼近 88%
  if (!response.body || !total) {
    let fake = 5;
    const timer = setInterval(() => {
      fake = Math.min(88, fake + (88 - fake) * 0.08 + 0.5);
      onProgress?.(Math.round(fake));
    }, 120);
    try {
      const blob = await response.blob();
      onProgress?.(90);
      return await decodeBlobImage(blob);
    } finally {
      clearInterval(timer);
    }
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      received += value.length;
      onProgress?.(Math.min(92, Math.max(2, Math.round((received / total) * 92))));
    }
  }
  const blob = new Blob(chunks.map(chunk => chunk.slice().buffer), { type: response.headers.get('content-type') || 'image/jpeg' });
  return decodeBlobImage(blob);
}

/**
 * 用 <img> + decode() 加载,比 THREE.TextureLoader 更快:
 * - 走浏览器 HTTP 缓存,与 <link rel=preload> 共用
 * - 支持 fetchpriority,可优先加载关键纹理
 */
function loadTexture(
  src: string,
  priority: 'high' | 'low' | 'auto' = 'auto',
  onProgress?: (progress: number) => void
): Promise<THREE.Texture> {
  const cached = textureCache.get(src);
  if (cached) {
    onProgress?.(100);
    return Promise.resolve(cached);
  }
  const pending = inflight.get(src);
  if (pending) return pending.then(tex => { onProgress?.(100); return tex; });

  const p = fetchImageWithProgress(src, priority, onProgress)
    .then(img => {
      onProgress?.(96);
      const tex = imageToTexture(img);
      textureCache.set(src, tex);
      onProgress?.(100);
      return tex;
    })
    .finally(() => inflight.delete(src));
  inflight.set(src, p);
  return p;
}

const sleep = (ms: number, signal?: { aborted: boolean }) =>
  new Promise<void>((resolve, reject) => {
    const t = setTimeout(() => {
      if (signal?.aborted) reject(new Error('aborted'));
      else resolve();
    }, ms);
    if (signal) {
      const check = setInterval(() => {
        if (signal.aborted) { clearTimeout(t); clearInterval(check); reject(new Error('aborted')); }
      }, 100);
      void check;
    }
  });

async function loadFirstAvailableTexture(
  urls: string[],
  priority: 'high' | 'low' | 'auto',
  onProgress?: (progress: number) => void,
  opts?: { maxAttempts?: number; signal?: { aborted: boolean }; onAttempt?: (attempt: number, max: number) => void }
) {
  const candidates = uniqueUrls(urls);
  const maxAttempts = opts?.maxAttempts ?? 3;
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (opts?.signal?.aborted) throw new Error('aborted');
    opts?.onAttempt?.(attempt, maxAttempts);
    for (const url of candidates) {
      if (opts?.signal?.aborted) throw new Error('aborted');
      try {
        return await loadTexture(url, priority, onProgress);
      } catch (error) {
        lastError = error;
      }
    }
    if (attempt < maxAttempts) {
      // 指数退避: 600ms, 1500ms, 3500ms... 加入抖动
      const backoff = Math.min(8000, 600 * Math.pow(2.2, attempt - 1)) + Math.random() * 250;
      onProgress?.(0);
      try { await sleep(backoff, opts?.signal); } catch { throw new Error('aborted'); }
    }
  }
  throw lastError ?? new Error('panorama load failed');
}

/** 仅预热浏览器 HTTP 缓存(不创建纹理),开销极小 */
function prefetchUrl(src: string, priority: 'high' | 'low' = 'low') {
  if (textureCache.has(src) || inflight.has(src)) return;
  if (typeof document === 'undefined') return;
  const link = document.createElement('link');
  link.rel = 'preload';
  link.as = 'image';
  link.href = src;
  link.crossOrigin = 'anonymous';
  (link as any).fetchPriority = priority;
  document.head.appendChild(link);
}

export const PanoramaViewer = ({ src, preloadSrc, onReady, className }: PanoramaViewerProps) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [loadProgress, setLoadProgress] = useState(0); // 真实/目标进度
  const [displayProgress, setDisplayProgress] = useState(0); // 动画后展示的进度
  const [loadFailed, setLoadFailed] = useState(false);
  const [activeQuality, setActiveQuality] = useState<Quality>('low');
  const [placeholderSrc, setPlaceholderSrc] = useState<string>('');
  const [attemptInfo, setAttemptInfo] = useState<{ attempt: number; max: number } | null>(null);
  const [retryNonce, setRetryNonce] = useState(0);
  const targetProgressRef = useRef(0);
  const onReadyRef = useRef(onReady);
  const readyCalledRef = useRef(false);

  useEffect(() => { targetProgressRef.current = loadProgress; }, [loadProgress]);

  // 平滑动画: displayProgress 用 rAF 缓慢逼近目标,避免数字跳变
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(64, now - last);
      last = now;
      setDisplayProgress(prev => {
        const target = targetProgressRef.current;
        if (Math.abs(prev - target) < 0.3) return target;
        // 接近目标时减速;同时保证最小爬升速度,避免长时间停滞
        const ease = (target - prev) * Math.min(1, dt / 220);
        const minStep = target > prev ? Math.max(0.08, dt * 0.04) : -Math.max(0.08, dt * 0.06);
        const step = Math.abs(ease) > Math.abs(minStep) ? ease : minStep;
        const next = prev + step;
        return target > prev ? Math.min(target, next) : Math.max(target, next);
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    onReadyRef.current = onReady;
  }, [onReady]);

  // 预加载下一张:仅 prefetch,不解码,避开 GPU 内存压力
  useEffect(() => {
    if (!preloadSrc) return;
    const v = deriveVariants(preloadSrc);
    prefetchUrl(v.low, 'low');
    const target = detectTargetQuality();
    if (target !== 'low') prefetchUrl(v[target], 'low');
  }, [preloadSrc]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;
    let disposed = false;
    const abortSignal = { aborted: false };
    let cleanup = () => {};
    const variants = deriveVariants(src);
    const target = detectTargetQuality();
    readyCalledRef.current = false;
    setLoadFailed(false);
    setLoadProgress(0);
    setAttemptInfo(null);

    // 占位图:优先低清(~50KB),否则不显示模糊层
    setPlaceholderSrc(variants.low);

    // 起点:已缓存的最高档,否则低清(最快)
    const startSrc = textureCache.has(variants.high)
      ? variants.high
      : textureCache.has(variants.med)
      ? variants.med
      : textureCache.has(variants.low)
      ? variants.low
      : variants.low;

    const startCached = textureCache.has(startSrc);
    setLoading(!startCached);
    if (startCached) setLoadProgress(100);

    // 关键纹理高优先级 + 自动重试(指数退避)
    loadFirstAvailableTexture(
      [startSrc, variants.med, variants.high, variants.low],
      'high',
      progress => setLoadProgress(progress),
      {
        maxAttempts: 3,
        signal: abortSignal,
        onAttempt: (attempt, max) => setAttemptInfo({ attempt, max }),
      }
    ).then(initialTex => {
      if (disposed || !container) return;
      const loadedSrc = uniqueUrls([startSrc, variants.med, variants.high, variants.low])
        .find(url => textureCache.get(url) === initialTex) || startSrc;
      const startQ: Quality = loadedSrc === variants.high ? 'high' : loadedSrc === variants.med ? 'med' : 'low';
      setActiveQuality(startQ);

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(75, container.clientWidth / container.clientHeight, 0.1, 1100);
      camera.position.set(0, 0, 0.01);

      const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true, powerPreference: 'high-performance' });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
      renderer.setSize(container.clientWidth, container.clientHeight);
      renderer.domElement.style.width = '100%';
      renderer.domElement.style.height = '100%';
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
      let firstFrameRendered = false;
      const markReady = () => {
        if (readyCalledRef.current || disposed) return;
        readyCalledRef.current = true;
        setLoading(false);
        setLoadProgress(100);
        onReadyRef.current?.();
      };

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
        if (!firstFrameRendered) {
          firstFrameRendered = true;
          requestAnimationFrame(markReady);
        }
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

      // 渐进升级:直接跳到目标档,不再串联中间档,降低带宽占用
      const upgradeTo = (url: string, quality: Quality) => {
        if (disposed) return;
        // 让首帧先稳定渲染再升级,避免抢带宽
        const idle = (window as any).requestIdleCallback || ((cb: any) => setTimeout(cb, 200));
        idle(() => {
          if (disposed) return;
          loadTexture(url, 'low').then(tex => {
            if (disposed) return;
            material.map = tex;
            material.needsUpdate = true;
            needsRender = true;
            setActiveQuality(quality);
          }).catch(() => {});
        });
      };

      // 仅在用户停留 >1.2s 后才升级,避免快速切换时浪费带宽
      let upgradeTimer: ReturnType<typeof setTimeout> | null = null;
      if (startQ !== target && (target === 'med' || target === 'high')) {
        upgradeTimer = setTimeout(() => upgradeTo(variants[target], target), 1200);
      }

      cleanup = () => {
        if (upgradeTimer) clearTimeout(upgradeTimer);
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
    }).catch((err) => {
      if (disposed || (err && (err as Error).message === 'aborted')) return;
      setLoadFailed(true);
      setLoading(false);
    });

    return () => { disposed = true; abortSignal.aborted = true; cleanup(); };
  }, [src, retryNonce]);

  return (
    <div className={className ? `${className} overflow-hidden` : 'relative overflow-hidden'}>
      <div ref={mountRef} className="absolute inset-0" />
      {loading && placeholderSrc && (
        <>
          <img
            src={placeholderSrc}
            alt=""
            aria-hidden
            className="absolute inset-0 w-full h-full object-cover"
            style={{ filter: 'blur(16px)', transform: 'scale(1.1)' }}
            decoding="async"
            {...({ fetchpriority: 'high' } as any)}
          />
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="paper-card w-[min(82vw,320px)] px-4 py-3 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  全景加载中
                  {attemptInfo && attemptInfo.attempt > 1 && (
                    <span className="ml-1 text-xs">(重试 {attemptInfo.attempt}/{attemptInfo.max})</span>
                  )}
                </span>
                <span className="font-semibold tabular-nums ink-text">{Math.max(1, loadProgress)}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-[width] duration-200 ease-out"
                  style={{ width: `${Math.max(4, loadProgress)}%` }}
                />
              </div>
            </div>
          </div>
        </>
      )}
      {loadFailed && (
        <>
          {placeholderSrc && (
            <img
              src={placeholderSrc}
              alt=""
              aria-hidden
              className="absolute inset-0 w-full h-full object-cover"
              style={{ filter: 'blur(16px)', transform: 'scale(1.1)' }}
              decoding="async"
            />
          )}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="paper-card w-[min(82vw,340px)] px-4 py-4 space-y-3 text-center">
              <div className="text-sm text-destructive font-medium">全景图加载失败</div>
              <div className="text-xs text-muted-foreground">已自动重试多次，请检查网络后再试。</div>
              <button
                type="button"
                onClick={() => {
                  setLoadFailed(false);
                  setLoadProgress(0);
                  setAttemptInfo(null);
                  setLoading(true);
                  setRetryNonce(n => n + 1);
                }}
                className="inline-flex items-center justify-center rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90 transition"
              >
                重新加载
              </button>
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
