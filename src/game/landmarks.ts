import type { RegionId } from './adventure';
import { TEMPLE_THEMES } from './temple';

export interface RegionPlace {
  id: string;
  name: string;
  description: string;
  x: number;
  z: number;
  kind: string;
  lookAt?: { x: number; z: number };
}
/** Shared by visible architecture, navigation, takeoff clearance and landing. */
export interface LandmarkVolume {
  id: string;
  x: number;
  z: number;
  halfX: number;
  halfZ: number;
  height: number;
  minY?: number;
}
export interface ScenerySite {
  id: string;
  kind: string;
  x: number;
  z: number;
}
export const TEMPLE_ENTRANCE = { x: -8, z: -23 } as const;
const temple = (region: RegionId): RegionPlace => ({
  id: 'temple',
  name: TEMPLE_THEMES[region].name,
  description: '走入殿堂，点亮光印机关，寻找地区遗物。',
  ...TEMPLE_ENTRANCE,
  kind: 'temple',
});

export const REGION_PLACES: Record<RegionId, RegionPlace[]> = {
  meadow: [
    temple('meadow'),
    {
      id: 'village',
      name: '风车谷村',
      description: '风车、石屋和麦田围绕山谷里的小广场。',
      x: -20,
      z: 16,
      kind: 'village',
    },
    {
      id: 'farm',
      name: '金穗农庄',
      description: '穿过菜园小径，看看谷仓与成排的金色麦穗。',
      x: 11,
      z: 23,
      kind: 'farm',
    },
    {
      id: 'falls',
      name: '青岚瀑布',
      description: '山泉从古老石桥下落入山谷。',
      x: -38,
      z: -17,
      kind: 'waterfall',
    },
    {
      id: 'deer-camp',
      name: '鹿溪营地',
      description: '循着林间小径来到溪泉营地，看看帐篷旁慢慢踱步的鹿群。',
      x: -79,
      z: 40,
      kind: 'camp',
      lookAt: { x: -82, z: 34 },
    },
    {
      id: 'flower-sea',
      name: '晴风花海',
      description: '穿过野花与石拱，玻璃花房和小兔藏在东边的暖坡上。',
      x: 73,
      z: 56,
      kind: 'garden',
      lookAt: { x: 79, z: 62 },
    },
    {
      id: 'bell-hill',
      name: '风铃山丘',
      description: '沿山脊步道登上旧钟亭，在风铃声里眺望整个原野。',
      x: -4,
      z: -88,
      kind: 'vista',
      lookAt: { x: -4, z: -98 },
    },
  ],
  water: [
    temple('water'),
    {
      id: 'harbor',
      name: '白帆灯港',
      description: '白石灯塔守望蓝色湖湾，帆船停在木码头旁。',
      x: 47,
      z: 23,
      kind: 'harbor',
    },
    {
      id: 'arcade',
      name: '贝光拱廊',
      description: '沿着白色拱廊漫步，听见远方海鸟与水声。',
      x: -28,
      z: 17,
      kind: 'ruins',
    },
    {
      id: 'cascade',
      name: '银流阶瀑',
      description: '三级瀑布流过蓝白岩层，汇入静谧水潭。',
      x: -35,
      z: -25,
      kind: 'waterfall',
    },
  ],
  fire: [
    temple('fire'),
    {
      id: 'glacier',
      name: '霜火冰川',
      description: '雪山与黑色火山岩相接，冰川映出冷蓝的光。',
      x: -32,
      z: 8,
      kind: 'glacier',
    },
    {
      id: 'spring',
      name: '暖雾温泉',
      description: '白汽升起的温泉旁，有供旅人歇脚的小屋。',
      x: 11,
      z: 25,
      kind: 'spring',
    },
    {
      id: 'watch',
      name: '熔岩瞭望台',
      description: '从黑曜石塔前远望熔岩湖和火山口。',
      x: 12,
      z: -18,
      kind: 'tower',
    },
  ],
  earth: [
    temple('earth'),
    {
      id: 'caves',
      name: '赤壁穴居',
      description: '阶梯状红色峭壁中藏着古老石屋与岩窟门廊。',
      x: -36,
      z: 5,
      kind: 'village',
    },
    {
      id: 'bridge',
      name: '千层峡谷桥',
      description: '古桥连接两岸的层叠岩壁，桥下是深色峡谷。',
      x: -28,
      z: -26,
      kind: 'bridge',
    },
    {
      id: 'oasis',
      name: '琥珀绿洲',
      description: '废墟水庭与沙岩柱围绕清澈的泉眼。',
      x: 12,
      z: 24,
      kind: 'spring',
    },
  ],
  steel: [
    temple('steel'),
    {
      id: 'observatory',
      name: '旧星穹台',
      description: '铜色穹顶与巨型望远镜，仍静静朝向天空。',
      x: -28,
      z: 20,
      kind: 'observatory',
    },
    {
      id: 'aqueduct',
      name: '高架星渠',
      description: '水渠穿过高大的石拱与金属支架。',
      x: 14,
      z: 8,
      kind: 'aqueduct',
    },
    {
      id: 'workshop',
      name: '齿轮工坊',
      description: '遗落的工坊和巨型齿轮，记忆着往日的城市。',
      x: 43,
      z: 23,
      kind: 'workshop',
    },
  ],
  fairy: [
    temple('fairy'),
    {
      id: 'treehouse',
      name: '月枝树屋',
      description: '巨树托起木屋与灯笼，树下是一圈安静的花园。',
      x: -27,
      z: 20,
      kind: 'treehouse',
    },
    {
      id: 'mushrooms',
      name: '绮梦菇镇',
      description: '彩色蘑菇屋围着星光小径，窗中透出暖光。',
      x: 13,
      z: 26,
      kind: 'village',
    },
    {
      id: 'garden',
      name: '浮光花园',
      description: '攀花石门后，浮石与发光花静静悬在空中。',
      x: -36,
      z: -20,
      kind: 'garden',
    },
  ],
};

export const REGION_SITES: Record<RegionId, ScenerySite[]> = {
  meadow: [
    { id: 'village', kind: 'windmill-village', x: -29, z: 13 },
    { id: 'farm', kind: 'farm', x: 17, z: 23 },
    { id: 'falls', kind: 'valley-falls', x: -45, z: -30 },
    { id: 'deer-camp', kind: 'woodland-camp', x: -84, z: 38 },
    { id: 'flower-sea', kind: 'flower-garden', x: 77, z: 57 },
    { id: 'bell-hill', kind: 'hilltop-belfry', x: -4, z: -95 },
  ],
  water: [
    { id: 'harbor', kind: 'harbor', x: 48, z: 17 },
    { id: 'arcade', kind: 'white-arcade', x: -30, z: 9 },
    { id: 'cascade', kind: 'cascade', x: -42, z: -36 },
  ],
  fire: [
    { id: 'glacier', kind: 'glacier', x: -44, z: -6 },
    { id: 'spring', kind: 'hot-spring', x: 17, z: 19 },
    { id: 'watch', kind: 'obsidian-watch', x: 12, z: -26 },
  ],
  earth: [
    { id: 'caves', kind: 'cave-village', x: -45, z: -4 },
    { id: 'bridge', kind: 'canyon-bridge', x: -36, z: -36 },
    { id: 'oasis', kind: 'oasis', x: 18, z: 18 },
  ],
  steel: [
    { id: 'observatory', kind: 'observatory', x: -30, z: 10 },
    { id: 'aqueduct', kind: 'aqueduct', x: 12, z: -10 },
    { id: 'workshop', kind: 'workshop', x: 48, z: 17 },
  ],
  fairy: [
    { id: 'treehouse', kind: 'treehouse', x: -30, z: 9 },
    { id: 'mushrooms', kind: 'mushroom-village', x: 17, z: 19 },
    { id: 'garden', kind: 'floating-garden', x: -43, z: -31 },
  ],
};

const volume = (
  id: string,
  x: number,
  z: number,
  halfX: number,
  halfZ: number,
  height: number,
  minY = 0,
): LandmarkVolume => ({ id, x, z, halfX, halfZ, height, minY });
const templeVolumes = [
  volume('temple-sanctum', -8, -34, 8.6, 5.5, 15.5),
  volume('temple-left-tower', -19, -32, 2, 2.4, 11.5),
  volume('temple-right-tower', 3, -32, 2, 2.4, 11.5),
];
export const REGION_VOLUMES: Record<RegionId, LandmarkVolume[]> = {
  meadow: [
    ...templeVolumes,
    volume('windmill', -31, 6, 2.6, 2.6, 16),
    volume('cottage-west', -36, 15, 3.1, 2.6, 6.6),
    volume('cottage-east', -25, 12, 2.6, 2.6, 6),
    volume('cottage-south', -31, 22, 3, 2.5, 6.5),
    volume('barn', 18, 25, 3.6, 3.1, 7.2),
    volume('falls-cliff', -46, -32, 6.4, 9, 24),
    volume('falls-bridge', -41, -26, 12.2, 2, 17, 8),
    volume('falls-bridge-left', -52.3, -26, 0.8, 1.5, 14),
    volume('falls-bridge-right', -29.7, -26, 0.8, 1.5, 14),
    volume('camp-lodge', -86, 31, 3.9, 3.6, 8),
    volume('camp-tent-east', -73, 32, 3.6, 3.1, 4.2),
    volume('camp-tent-west', -86, 49, 3, 2.8, 3.8),
    volume('camp-spring-rock', -92, 35, 2.7, 2.5, 5.7),
    volume('camp-spring-pool', -92, 38.2, 3.1, 2.1, 0.6),
    volume('camp-firepit', -80, 34, 1.35, 1.35, 1.2),
    volume('flower-glasshouse', 81, 63, 4.2, 3.2, 7.4),
    volume('flower-gate-west', 66.5, 50, 0.5, 0.65, 6),
    volume('flower-gate-east', 73.5, 50, 0.5, 0.65, 6),
    volume('flower-gate-arch', 70, 50, 4, 0.65, 6.6, 4.4),
    volume('hill-belfry', -4, -99, 3, 3, 13),
    volume('hill-gate-west', -11, -90, 0.6, 0.8, 6.6),
    volume('hill-gate-east', 3, -90, 0.6, 0.8, 6.6),
    volume('hill-gate-lintel', -4, -90, 7.8, 0.8, 7.2, 5.8),
    volume('hill-stone-west', -13, -97, 1.4, 2.4, 3.5),
    volume('hill-stone-east', 5, -99, 1.4, 2.4, 3.5),
  ],
  water: [
    ...templeVolumes,
    volume('lighthouse', 48, 13, 2.6, 2.6, 20),
    volume('harbor-house', 54, 22, 3.3, 2.7, 7),
    volume('harbor-store', 42, 26, 2.8, 2.2, 6),
    volume('arcade-back', -30, 7, 7, 1.5, 8.5),
    volume('arcade-left', -36, 10, 1.2, 3, 8.5),
    volume('arcade-right', -24, 10, 1.2, 3, 8.5),
    volume('arcade-front-left', -38.25, 10, 0.35, 0.75, 7.5),
    volume('arcade-front-mid-left', -32.9, 10, 0.8, 0.75, 7.5),
    volume('arcade-front-mid-right', -27.1, 10, 0.8, 0.75, 7.5),
    volume('arcade-front-right', -21.75, 10, 0.35, 0.75, 7.5),
    volume('cascade-cliffs', -44, -39, 8.5, 9, 27),
  ],
  fire: [
    ...templeVolumes,
    volume('glacier-mass', -46, -13, 8, 8, 29),
    volume('ice-spire', -40, 0, 3.5, 3.5, 17),
    volume('spring-pool', 18, 18, 4.6, 3.7, 1.3),
    volume('spring-lodge', 22, 27, 3.7, 3, 7.5),
    volume('watchtower', 12, -27, 3.3, 3.3, 18),
  ],
  earth: [
    ...templeVolumes,
    volume('cave-cliff', -47, -6, 7, 8, 23),
    volume('cave-house', -41, 13, 3.3, 2.8, 7),
    volume('bridge-west', -47, -36, 4.5, 5, 20),
    volume('bridge-east', -25, -37, 3, 4.6, 17),
    volume('bridge-span', -36, -36, 12.5, 1.9, 17, 9),
    volume('oasis-pool', 18, 17, 4.8, 4, 2.7),
    volume('oasis-ruin', 23, 26, 3.8, 2.8, 7.5),
  ],
  steel: [
    ...templeVolumes,
    volume('observatory', -30, 9, 6.3, 6.3, 18),
    volume('observatory-annex', -40, 14, 3.2, 2.8, 7),
    volume('aqueduct-north-pier', 12, -24, 1.4, 2.3, 13),
    volume('aqueduct-center-pier', 12, -10, 1.4, 2.3, 13),
    volume('aqueduct-south-pier', 12, 3, 1.4, 2.3, 13),
    volume('aqueduct-channel', 12, -11, 2, 16, 14, 9),
    volume('workshop', 49, 17, 5.1, 4.3, 10),
    volume('workshop-stack', 56, 17, 1.5, 1.5, 16),
  ],
  fairy: [
    ...templeVolumes,
    volume('elder-tree', -30, 8, 3.3, 3.3, 24),
    volume('tree-canopy', -30, 8, 9.5, 9.5, 25, 11),
    volume('treehouse-hut', -38, 16, 2.4, 2.4, 6.2),
    volume('mushroom-home-a', 18, 18, 2.6, 2.6, 7.5),
    volume('mushroom-home-b', 10, 19, 2.1, 2.1, 5.5),
    volume('mushroom-home-c', 22, 27, 2.8, 2.8, 8),
    volume('garden-stone-west', -48, -33, 3.3, 3.6, 17),
    volume('garden-stone-east', -38, -33, 2.5, 2.5, 13),
    volume('garden-float', -43, -32, 8.8, 5.5, 24, 13),
    volume('garden-gate-left', -38.6, -25, 0.55, 0.65, 8.7),
    volume('garden-gate-right', -33.4, -25, 0.55, 0.65, 8.7),
    volume('garden-gate-arch', -36, -25, 3, 0.65, 9, 6.5),
  ],
};

/** Additional footpaths lead to the accessible viewpoint, never into a building wall. */
export const REGION_PATHS: Record<
  RegionId,
  Array<Array<{ x: number; z: number }>>
> = Object.fromEntries(
  Object.entries(REGION_PLACES).map(([region, places]) => [
    region,
    places
      .slice(1)
      .filter((place) => !['deer-camp', 'flower-sea', 'bell-hill'].includes(place.id))
      .map((place) => {
        const start =
          place.x < -15 ? { x: -17, z: -5 } : place.x > 30 ? { x: 24, z: 8 } : { x: 3, z: 20 };
        if (place.z < -15 && place.x > 0)
          return [
            { x: -2, z: -4 },
            { x: 7, z: -11 },
            { x: place.x, z: place.z },
          ];
        if (place.z < -15)
          return [
            { x: -25, z: -5 },
            { x: -34, z: -14 },
            { x: place.x, z: place.z },
          ];
        if (place.x > 30) return [start, { x: 32, z: 20 }, { x: place.x, z: place.z }];
        return [
          start,
          { x: place.x + (place.x < 0 ? 4 : -4), z: place.z + 3 },
          { x: place.x, z: place.z },
        ];
      }),
  ]),
) as Record<RegionId, Array<Array<{ x: number; z: number }>>>;

// Deliberate winding routes preserve a wide clearing around the old core and
// connect the new destinations without drawing paths through water or buildings.
REGION_PATHS.meadow.push(
  [
    { x: 0, z: 30 },
    { x: -13, z: 32 },
    { x: -34, z: 34 },
    { x: -56, z: 38 },
    { x: -79, z: 40 },
  ],
  [
    { x: 11, z: 23 },
    { x: 25, z: 36 },
    { x: 43, z: 45 },
    { x: 59, z: 51 },
    { x: 73, z: 56 },
  ],
  [
    { x: -8, z: -23 },
    { x: 8, z: -20 },
    { x: 15, z: -35 },
    { x: 10, z: -49 },
    { x: 0, z: -62 },
    { x: -5, z: -76 },
    { x: -4, z: -88 },
  ],
  [
    { x: -79, z: 40 },
    { x: -83, z: 13 },
    { x: -82, z: -14 },
    { x: -80, z: -47 },
    { x: -68, z: -68 },
    { x: -35, z: -83 },
    { x: -4, z: -88 },
  ],
  [
    { x: 73, z: 56 },
    { x: 91, z: 37 },
    { x: 86, z: 5 },
    { x: 75, z: -28 },
    { x: 62, z: -61 },
    { x: 32, z: -82 },
    { x: -4, z: -88 },
  ],
  [
    { x: -56, z: 38 },
    { x: -41, z: 59 },
    { x: -15, z: 73 },
    { x: 14, z: 85 },
    { x: 43, z: 77 },
    { x: 73, z: 56 },
  ],
);

export function distanceToVolume(x: number, z: number, volume: LandmarkVolume): number {
  return Math.hypot(
    Math.max(0, Math.abs(x - volume.x) - volume.halfX),
    Math.max(0, Math.abs(z - volume.z) - volume.halfZ),
  );
}
