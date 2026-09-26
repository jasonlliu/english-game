import type { FieldSpecies } from './fieldActivities';

export const FIELD_GUIDE: Record<FieldSpecies, { name: string; icon: string; note: string }> = {
  deer: {
    name: '原野鹿',
    icon: '🦌',
    note: '东侧湖畔住着一大一小两只鹿。成年鹿沿岸饮水，幼鹿在附近觅食；慢慢靠近，它们会抬头留意你。',
  },
  rabbit: {
    name: '棉尾兔',
    icon: '🐇',
    note: '鹿溪营地东边的林缘住着一只棉尾兔。它在草窝旁觅食，歇脚时会竖耳梳毛。',
  },
  bird: {
    name: '青羽雀',
    icon: '🐦',
    note: '旧路牌旁的青羽雀喜欢低枝。放慢脚步，它会短短飞一段路，再停下来等你。',
  },
  fox: {
    name: '赤尾狐',
    icon: '🦊',
    note: '西北遗迹与森林之间的林隙里，赤尾狐会安静巡游。白胸和蓬松长尾很容易辨认，别追赶它。',
  },
  butterfly: {
    name: '花间蝶',
    icon: '🦋',
    note: '晴风花海的两只花间蝶各守着一小片花丛。站在花边，耐心等它经过视线。',
  },
};
