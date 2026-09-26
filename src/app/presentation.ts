import { Droplets, Flame, Leaf, Mountain, Shield, Sparkles } from 'lucide-react';
import type { RegionId } from '../game/adventure';
import type { WorldZone } from '../game/world';

export type Panel =
  | 'checkin'
  | 'journal'
  | 'expedition'
  | 'guide'
  | 'treasure'
  | 'map'
  | 'capture'
  | 'relic'
  | null;
export const zoneKeys: WorldZone[] = ['ruins', 'grove', 'shore'];
export const waypointNames: Record<RegionId, string[]> = {
  meadow: ['风语遗迹', '萤火森林', '镜蓝湖畔'],
  water: ['潮汐祭坛', '珊瑚花园', '珍珠海湾'],
  fire: ['熔火祭坛', '余烬石林', '流焰湖畔'],
  earth: ['大地祭坛', '岩柱峡谷', '琥珀河岸'],
  steel: ['动力核心', '齿轮工坊', '镜钢水库'],
  fairy: ['月辉祭坛', '蘑菇花林', '星露湖畔'],
};
export const elementIcons = {
  meadow: Leaf,
  water: Droplets,
  fire: Flame,
  earth: Mountain,
  steel: Shield,
  fairy: Sparkles,
};
