// 中国历史场景数据 - 从数据库动态加载,带静态回退
import { supabase } from '@/integrations/supabase/client';
import imgChanganTang from '@/assets/scenes/changan-tang.jpg';
import panoChanganTang from '@/assets/panoramas/changan-tang-360.jpg';
import imgKaifengSong from '@/assets/scenes/kaifeng-song.jpg';
import panoKaifengSong from '@/assets/panoramas/kaifeng-song-360.jpg';
import imgForbiddenCity from '@/assets/scenes/forbidden-city.jpg';
import panoForbiddenCity from '@/assets/panoramas/forbidden-city-360.jpg';
import imgXianTerracotta from '@/assets/scenes/xian-terracotta.jpg';
import panoXianTerracotta from '@/assets/panoramas/xian-terracotta-360.jpg';
import imgDunhuangMogao from '@/assets/scenes/dunhuang-mogao.jpg';
import panoDunhuangMogao from '@/assets/panoramas/dunhuang-mogao-360.jpg';
import imgGreatWall from '@/assets/scenes/great-wall.jpg';
import panoGreatWall from '@/assets/panoramas/great-wall-360.jpg';
import imgShanghaiBund from '@/assets/scenes/shanghai-bund.jpg';
import panoShanghaiBund from '@/assets/panoramas/shanghai-bund-360.jpg';
import imgHangzhouWestlake from '@/assets/scenes/hangzhou-westlake.jpg';
import panoHangzhouWestlake from '@/assets/panoramas/hangzhou-westlake-360.jpg';
import imgLuoyangHan from '@/assets/scenes/luoyang-han.jpg';
import panoLuoyangHan from '@/assets/panoramas/luoyang-han-360.jpg';
import imgLijiangOld from '@/assets/scenes/lijiang-old.jpg';
import panoLijiangOld from '@/assets/panoramas/lijiang-old-360.jpg';

export type Era = 'ancient' | 'recent' | 'modern';

// 根据年份推断时代：古代(先秦-1840) / 近代(1840-1949) / 现代(1949至今)
export function eraFromYear(year: number): Era {
  if (year >= 1949) return 'modern';
  if (year >= 1840) return 'recent';
  return 'ancient';
}

export interface Scene {
  id: string;
  title: string;
  description: string;
  image: string;
  panorama?: string;
  location: [number, number];
  locationName: string;
  year: number;
  era: Era;
  source: string;
}

export const ERAS: Record<Era, { label: string; range: string }> = {
  ancient: { label: '古代', range: '先秦 - 1840' },
  recent: { label: '近代', range: '1840 - 1949' },
  modern: { label: '现代', range: '1949 至今' },
};

// 静态回退数据(数据库未加载时使用)
const FALLBACK_SCENES: Scene[] = [
  { id: 'changan-tang', title: '长安城朱雀大街', description: '盛唐长安，朱雀大街熙攘，胡商汉客往来如织。', image: imgChanganTang, panorama: panoChanganTang, location: [108.94, 34.34], locationName: '陕西西安', year: 750, era: eraFromYear(750), source: '历史复原' },
  { id: 'kaifeng-song', title: '汴京虹桥', description: '北宋东京汴梁，虹桥之上车马喧腾。', image: imgKaifengSong, panorama: panoKaifengSong, location: [114.35, 34.8], locationName: '河南开封', year: 1120, era: eraFromYear(1120), source: '清明上河图' },
  { id: 'forbidden-city', title: '紫禁城太和殿', description: '明永乐年间建成的紫禁城，皇权象征。', image: imgForbiddenCity, panorama: panoForbiddenCity, location: [116.397, 39.918], locationName: '北京', year: 1420, era: eraFromYear(1420), source: '明史' },
  { id: 'xian-terracotta', title: '秦始皇陵兵马俑', description: '秦始皇陵东侧地下军阵。', image: imgXianTerracotta, panorama: panoXianTerracotta, location: [109.27, 34.38], locationName: '陕西临潼', year: -210, era: eraFromYear(-210), source: '考古发现' },
  { id: 'dunhuang-mogao', title: '敦煌莫高窟', description: '丝路重镇，千年壁画。', image: imgDunhuangMogao, panorama: panoDunhuangMogao, location: [94.81, 40.04], locationName: '甘肃敦煌', year: 700, era: eraFromYear(700), source: '敦煌研究院' },
  { id: 'great-wall', title: '居庸关长城', description: '明代加固之雄关。', image: imgGreatWall, panorama: panoGreatWall, location: [116.07, 40.29], locationName: '北京昌平', year: 1500, era: eraFromYear(1500), source: '明长城' },
  { id: 'shanghai-bund', title: '上海外滩', description: '万国建筑博览群。', image: imgShanghaiBund, panorama: panoShanghaiBund, location: [121.49, 31.24], locationName: '上海', year: 1935, era: eraFromYear(1935), source: '近代摄影' },
  { id: 'hangzhou-westlake', title: '杭州西湖', description: '南宋偏安。', image: imgHangzhouWestlake, panorama: panoHangzhouWestlake, location: [120.15, 30.25], locationName: '浙江杭州', year: 1180, era: eraFromYear(1180), source: '南宋画作' },
  { id: 'luoyang-han', title: '东汉洛阳城', description: '东汉都城洛阳。', image: imgLuoyangHan, panorama: panoLuoyangHan, location: [112.46, 34.62], locationName: '河南洛阳', year: 100, era: eraFromYear(100), source: '后汉书' },
  { id: 'lijiang-old', title: '丽江古城', description: '茶马古道枢纽。', image: imgLijiangOld, panorama: panoLijiangOld, location: [100.23, 26.87], locationName: '云南丽江', year: 1450, era: eraFromYear(1450), source: '明清木氏' },
];

// 运行时场景列表(可变),默认先用回退,加载成功后替换
export let SCENES: Scene[] = FALLBACK_SCENES;

export async function loadScenes(): Promise<Scene[]> {
  const { data, error } = await supabase
    .from('scenes')
    .select('*')
    .order('sort_order', { ascending: true });
  if (error || !data || data.length === 0) {
    return SCENES;
  }
  SCENES = data.map(r => ({
    id: r.id,
    title: r.title,
    description: r.description,
    image: r.image_url,
    panorama: r.panorama_url ?? undefined,
    location: [Number(r.lng), Number(r.lat)],
    locationName: r.location_name,
    year: r.year,
    era: eraFromYear(r.year),
    source: r.source,
  }));
  return SCENES;
}

export const ROUNDS_PER_GAME = 5;
export const ROUND_SECONDS = 60;

export function calcScore(distanceKm: number, yearError: number): number {
  const distScore = Math.max(0, 500 * Math.exp(-distanceKm / 800));
  const yearScore = Math.max(0, 500 * Math.exp(-yearError / 150));
  return Math.round(distScore + yearScore);
}

export function haversine(a: [number, number], b: [number, number]): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b[1] - a[1]);
  const dLng = toRad(b[0] - a[0]);
  const lat1 = toRad(a[1]);
  const lat2 = toRad(b[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function formatYear(y: number): string {
  return y < 0 ? `公元前 ${-y} 年` : `公元 ${y} 年`;
}
