// 中国历史场景数据 (占位图，后续可替换为真实图片/AI生成)
export type Era = 'ancient' | 'tang-song' | 'ming-qing' | 'modern';

export interface Scene {
  id: string;
  title: string;
  description: string;
  image: string;
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

// SVG 占位图生成器
const ph = (label: string, hue: number) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 800"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${hue},45%,75%)"/><stop offset="1" stop-color="hsl(${hue + 20},35%,40%)"/></linearGradient></defs><rect width="1200" height="800" fill="url(%23g)"/><g fill="hsl(${hue},30%,20%)" opacity="0.6" font-family="serif"><text x="600" y="380" text-anchor="middle" font-size="72" font-weight="700">${label}</text><text x="600" y="450" text-anchor="middle" font-size="28" opacity="0.7">场景占位图</text></g><g stroke="hsl(${hue},30%,25%)" stroke-width="2" fill="none" opacity="0.3"><path d="M0,600 Q300,500 600,580 T1200,560 L1200,800 L0,800 Z"/><path d="M0,650 Q400,560 800,620 T1200,610 L1200,800 L0,800 Z"/></g></svg>`
  )}`;

export const SCENES: Scene[] = [
  {
    id: 'changan-tang',
    title: '长安城朱雀大街',
    description: '盛唐长安，朱雀大街熙攘，胡商汉客往来如织。',
    image: ph('长安·朱雀大街', 30),
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
    image: ph('汴京·虹桥', 25),
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
    image: ph('紫禁城·太和殿', 0),
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
    image: ph('秦俑·军阵', 35),
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
    image: ph('莫高窟·飞天', 40),
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
    image: ph('居庸关·长城', 200),
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
    image: ph('上海·外滩', 210),
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
    image: ph('西湖·苏堤', 130),
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
    image: ph('洛阳·汉城', 50),
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
    image: ph('丽江·古城', 150),
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
