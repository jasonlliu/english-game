import type { FieldSpecies } from './fieldActivities';

export const FIELD_GUIDE: Record<FieldSpecies, { name: string; icon: string; note: string }> = {
  deer: {
    name: '原野鹿',
    icon: '🦌',
    note: '幼鹿喜欢待在成年鹿身边。放慢脚步，就能看到它们低头吃草。',
  },
  rabbit: {
    name: '棉尾兔',
    icon: '🐇',
    note: '停下赶路时，小兔会竖起耳朵，或者坐下来梳理自己的毛。',
  },
  bird: {
    name: '青羽雀',
    icon: '🐦',
    note: '草地上的小鸟会啄食、歇脚，也会突然飞起换一处落脚点。',
  },
  fox: {
    name: '赤尾狐',
    icon: '🦊',
    note: '白色的胸口和蓬松长尾很容易辨认。别追赶它，等它自己靠近。',
  },
  butterfly: {
    name: '花间蝶',
    icon: '🦋',
    note: '蝴蝶沿花丛起伏飞舞。站在花边，耐心等它经过视线。',
  },
};
