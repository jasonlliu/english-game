import type { PetId } from './adventure';

/** Field-guide lore lives with the lazy collection dialogs, outside the startup data. */
export interface PetIdentity {
  species: string;
  epithet: string;
  signature: string;
  personality: string;
  habitat: string;
  clue: string;
  ink: string;
  bondLines: readonly [string, string, string];
}

export const PET_IDENTITIES: Record<PetId, PetIdentity> = {
  ember: {
    species: '曙光龙族',
    epithet: '晨辉幼龙',
    signature: '琥珀龙冠 · 灯焰长尾',
    personality: '总想走在你前面，遇到陌生事物却会偷偷回头确认你还在。',
    habitat: '晨光中的原野遗迹',
    clue: '你的第一位伙伴已经在队伍里。持续打卡，看幼龙长出晶甲与星翼。',
    ink: '#233044',
    bondLines: [
      '它竖起龙冠，正好奇地打量你。',
      '尾尖的光慢慢变暖，它愿意再靠近一些。',
      '它把额头轻轻低下，最后一次安抚吧。',
    ],
  },
  ripple: {
    species: '潮汐海麒',
    epithet: '踏浪的珍珠守望者',
    signature: '长流鳍 · 浮光珍珠 · 卷浪长尾',
    personality: '沉静又好奇，最喜欢听贝壳里藏着的海浪声。',
    habitat: '澄波湖境的潮汐栖地',
    clue: '沿海岸寻找三枚潮汐符印，再循伙伴标记走近澜尾。',
    ink: '#133d50',
    bondLines: [
      '它的流鳍微微扬起，先别急着靠近。',
      '它收起警惕，胸前的珍珠映出了柔和的光。',
      '它正安静地等你，最后一次安抚吧。',
    ],
  },
  cinder: {
    species: '熔脊迅龙',
    epithet: '雪火之间的疾行者',
    signature: '黑曜背甲 · 熔光脊刃 · 长尾',
    personality: '看上去气势十足，其实最喜欢有人陪它一起往前跑。',
    habitat: '赤霞峡谷的暖岩栖地',
    clue: '在雪山与火山之间找到三枚焰心符印，再靠近绯烬。',
    ink: '#48282d',
    bondLines: [
      '它停下脚步，侧着头观察你的动作。',
      '熔光背甲渐渐安静，它已经放松下来。',
      '它把长尾收在身旁，最后一次安抚吧。',
    ],
  },
  moss: {
    species: '晶林岩兽',
    epithet: '背着森林的守护者',
    signature: '巨岩肩甲 · 林晶背脊 · 弯月獠牙',
    personality: '走得慢，心却很细。每一株从石缝里冒出的新芽，它都会记得。',
    habitat: '琥珀石谷的苔岩栖地',
    clue: '穿过石桥与绿洲，收集三枚琥珀符印，再与岩芽相遇。',
    ink: '#304238',
    bondLines: [
      '它像一块安静的巨石，眼睛却一直看着你。',
      '岩甲下传来轻轻的呼吸，它愿意相信你。',
      '它低下巨大的脑袋，最后一次安抚吧。',
    ],
  },
  bolt: {
    species: '星核机龙',
    epithet: '沉睡工坊的银翼哨兵',
    signature: '折角钢甲 · 发光星核 · 刃形尾翼',
    personality: '喜欢整齐的东西，连路边的小石子也想一颗颗排好。',
    habitat: '银辉遗庭的星核栖地',
    clue: '寻找遗庭里的三枚银辉符印，铠曜正在古老工坊之间等候。',
    ink: '#25364e',
    bondLines: [
      '它的星核一明一暗，正认真观察你。',
      '金属翼甲慢慢垂下，它不再紧张了。',
      '它向你点了点头，最后一次安抚吧。',
    ],
  },
  lumi: {
    species: '星蝶灵鹿',
    epithet: '月枝间的星空旅者',
    signature: '枝形星角 · 蝶翼 · 轻盈鹿足',
    personality: '会为每一朵花停下来，也愿意让信任的朋友坐上它的背。',
    habitat: '星花梦境的月花栖地',
    clue: '沿花雾寻找三枚星花符印，靠近绮露时，看看它的星角与蝶翼。',
    ink: '#382d53',
    bondLines: [
      '它的蝶翼轻轻张开，先让它熟悉你的气息。',
      '它向前迈了一小步，星角映着柔和的光。',
      '它已经愿意与你同行，最后一次安抚吧。',
    ],
  },
};

export const EMBER_FORMS = [
  { stage: 1, name: '晨辉幼龙', detail: '相遇时的模样', missions: 1 },
  { stage: 2, name: '晶甲游龙', detail: '龙冠与晶甲生长', missions: 3 },
  { stage: 3, name: '星翼天龙', detail: '展开星翼 · 可骑乘飞行', missions: 6 },
] as const;
