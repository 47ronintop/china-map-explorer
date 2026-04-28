// 中国历史场景数据
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

export type Era = 'ancient' | 'tang-song' | 'ming-qing' | 'modern';

export interface Scene {
  id: string;
  title: string;
  description: string;
  image: string;
  /** 可选:360° equirectangular 全景图(2:1) */
  panorama?: string;
  // 真实地点经纬度 [lng, lat]
  location: [number, number];
  locationName: string;
  // 真实年份 (公元年, BCE 用负数)
  year: number;
  era: Era;
  source: string;
}

export const ERAS: Record<Era, { label: string; range: string }> = {
  modern: { label: '现代', range: '1912 至今' },
  'ming-qing': { label: '明清', range: '1368 - 1912' },
  'tang-song': { label: '唐宋', range: '618 - 1279' },
  ancient: { label: '秦汉及更早', range: '公元前 221 之前 - 公元 220' },
};

export const SCENES: Scene[] = [
  {
    id: 'changan-tang',
    title: '长安城朱雀大街',
    description: '盛唐长安，朱雀大街熙攘，胡商汉客往来如织。',
    image: imgChanganTang,
    panorama: panoChanganTang,
    location: [108.94, 34.34],
    locationName: '陕西西安',
    year: 750,
    era: 'tang-song',
    source: '历史复原',
  },
  {
    id: 'kaifeng-song',
    title: '汴京虹桥',
    description: '北宋东京汴梁，虹桥之上车马喧腾，《清明上河图》所绘之景。',
    image: imgKaifengSong,
    location: [114.35, 34.8],
    locationName: '河南开封',
    year: 1120,
    era: 'tang-song',
    source: '清明上河图',
  },
  {
    id: 'forbidden-city',
    title: '紫禁城太和殿',
    description: '明永乐年间建成的紫禁城，皇权象征。',
    image: imgForbiddenCity,
    location: [116.397, 39.918],
    locationName: '北京',
    year: 1420,
    era: 'ming-qing',
    source: '明史',
  },
  {
    id: 'xian-terracotta',
    title: '秦始皇陵兵马俑',
    description: '秦始皇陵东侧地下军阵，千人千面。',
    image: imgXianTerracotta,
    location: [109.27, 34.38],
    locationName: '陕西临潼',
    year: -210,
    era: 'ancient',
    source: '考古发现',
  },
  {
    id: 'dunhuang-mogao',
    title: '敦煌莫高窟',
    description: '丝路重镇，千年壁画与彩塑荟萃。',
    image: imgDunhuangMogao,
    location: [94.81, 40.04],
    locationName: '甘肃敦煌',
    year: 700,
    era: 'tang-song',
    source: '敦煌研究院',
  },
  {
    id: 'great-wall',
    title: '居庸关长城',
    description: '明代加固之雄关，京师屏障。',
    image: imgGreatWall,
    location: [116.07, 40.29],
    locationName: '北京昌平',
    year: 1500,
    era: 'ming-qing',
    source: '明长城',
  },
  {
    id: 'shanghai-bund',
    title: '上海外滩',
    description: '万国建筑博览群，民国十里洋场。',
    image: imgShanghaiBund,
    location: [121.49, 31.24],
    locationName: '上海',
    year: 1935,
    era: 'modern',
    source: '近代摄影',
  },
  {
    id: 'hangzhou-westlake',
    title: '杭州西湖',
    description: '南宋偏安，"暖风熏得游人醉"。',
    image: imgHangzhouWestlake,
    location: [120.15, 30.25],
    locationName: '浙江杭州',
    year: 1180,
    era: 'tang-song',
    source: '南宋画作',
  },
  {
    id: 'luoyang-han',
    title: '东汉洛阳城',
    description: '东汉都城洛阳，太学云集。',
    image: imgLuoyangHan,
    location: [112.46, 34.62],
    locationName: '河南洛阳',
    year: 100,
    era: 'ancient',
    source: '后汉书',
  },
  {
    id: 'lijiang-old',
    title: '丽江古城',
    description: '南宋纳西木氏所建，茶马古道枢纽。',
    image: imgLijiangOld,
    location: [100.23, 26.87],
    locationName: '云南丽江',
    year: 1450,
    era: 'ming-qing',
    source: '明清木氏',
  },
];

export const ROUNDS_PER_GAME = 5;
export const ROUND_SECONDS = 60;

// 计分: 距离 km + 年份差 → 0-1000 分
export function calcScore(distanceKm: number, yearError: number): number {
  // 中国对角线约 5500km；最大年份差约 2300
  const distScore = Math.max(0, 500 * Math.exp(-distanceKm / 800));
  const yearScore = Math.max(0, 500 * Math.exp(-yearError / 150));
  return Math.round(distScore + yearScore);
}

// Haversine 距离 (km)
export function haversine(a: [number, number], b: [number, number]): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b[1] - a[1]);
  const dLng = toRad(b[0] - a[0]);
  const lat1 = toRad(a[1]);
  const lat2 = toRad(b[1]);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function formatYear(y: number): string {
  return y < 0 ? `公元前 ${-y} 年` : `公元 ${y} 年`;
}
