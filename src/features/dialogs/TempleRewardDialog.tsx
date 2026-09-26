import { ArrowRight, Check, Gem } from 'lucide-react';
import type { CSSProperties } from 'react';
import { REGION_IDS } from '../../game/adventure';
import { getDialogModel, type DialogProps } from './types';

export default function TempleRewardDialog(props: DialogProps) {
  const { templeProgress, templeTheme, closeModal, setPanel } = getDialogModel(props);
  return (
    <div className="temple-reward">
      <div
        className="artifact-emblem"
        style={{ '--artifact-color': templeTheme.color } as CSSProperties}
      >
        <Gem size={60} strokeWidth={1} />
        <i />
        <i />
      </div>
      <div className="eyebrow">A MEMORY OF THE ANCIENT WORLD</div>
      <h2>发现了{templeTheme.artifact}</h2>
      <p>{templeTheme.story}</p>
      <span className="reward-xp">
        <Check size={16} />
        神庙遗物 · 已收藏 {templeProgress.completed.length} / {REGION_IDS.length}
      </span>
      <button className="primary" onClick={closeModal}>
        继续探索
        <ArrowRight size={16} />
      </button>
      <button className="text-action" onClick={() => setPanel('journal')}>
        查看我的收藏
      </button>
    </div>
  );
}
