import { useEffect, useRef } from 'react';
import * as THREE from 'three';

interface PanoramaViewerProps {
  src: string;
  className?: string;
}

/**
 * 360° 全景查看器:将 equirectangular (2:1) 图贴到球体内壁,
 * 鼠标/触摸拖动即可环视;轮子缩放视野。
 */
export const PanoramaViewer = ({ src, className }: PanoramaViewerProps) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      75,
      container.clientWidth / container.clientHeight,
      0.1,
      1100
    );
    camera.position.set(0, 0, 0.01);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement);

    // 全景球
    const geometry = new THREE.SphereGeometry(500, 64, 32);
    geometry.scale(-1, 1, 1); // 翻转法线 → 内表面贴图

    const texture = new THREE.TextureLoader().load(src);
    texture.colorSpace = THREE.SRGBColorSpace;
    const material = new THREE.MeshBasicMaterial({ map: texture });
    const sphere = new THREE.Mesh(geometry, material);
    scene.add(sphere);

    // 拖动控制
    let lon = 0;
    let lat = 0;
    let isDown = false;
    let downX = 0;
    let downY = 0;
    let downLon = 0;
    let downLat = 0;

    const onPointerDown = (e: PointerEvent) => {
      isDown = true;
      downX = e.clientX;
      downY = e.clientY;
      downLon = lon;
      downLat = lat;
      (e.target as Element).setPointerCapture?.(e.pointerId);
    };
    const onPointerMove = (e: PointerEvent) => {
      if (!isDown) return;
      lon = downLon - (e.clientX - downX) * 0.15;
      lat = Math.max(-85, Math.min(85, downLat + (e.clientY - downY) * 0.15));
    };
    const onPointerUp = () => { isDown = false; };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      camera.fov = Math.max(30, Math.min(95, camera.fov + e.deltaY * 0.05));
      camera.updateProjectionMatrix();
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
    let autoRotate = true;
    const stopAuto = () => { autoRotate = false; };
    dom.addEventListener('pointerdown', stopAuto);
    dom.addEventListener('wheel', stopAuto);

    const animate = () => {
      raf = requestAnimationFrame(animate);
      if (autoRotate) lon += 0.03;
      const phi = THREE.MathUtils.degToRad(90 - lat);
      const theta = THREE.MathUtils.degToRad(lon);
      const target = new THREE.Vector3(
        500 * Math.sin(phi) * Math.cos(theta),
        500 * Math.cos(phi),
        500 * Math.sin(phi) * Math.sin(theta)
      );
      camera.lookAt(target);
      renderer.render(scene, camera);
    };
    animate();

    const onResize = () => {
      if (!container) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    const ro = new ResizeObserver(onResize);
    ro.observe(container);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      dom.removeEventListener('pointerdown', onPointerDown);
      dom.removeEventListener('pointermove', onPointerMove);
      dom.removeEventListener('pointerup', onPointerUp);
      dom.removeEventListener('pointercancel', onPointerUp);
      dom.removeEventListener('wheel', onWheel);
      geometry.dispose();
      material.dispose();
      texture.dispose();
      renderer.dispose();
      if (dom.parentNode) dom.parentNode.removeChild(dom);
    };
  }, [src]);

  return <div ref={containerRef} className={className} />;
};
