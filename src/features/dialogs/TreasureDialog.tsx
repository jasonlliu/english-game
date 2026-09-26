import { ArrowRight, Compass, RotateCcw, Star } from 'lucide-react';
import { getDialogModel, type DialogProps } from './types';

export default function TreasureDialog(props: DialogProps) {
  const { expedition, setPanel, newExpedition } = getDialogModel(props);
  return (
    <div className="treasure-dialog">
      <div className="relic-emblem">
        <Compass size={65} />
      </div>
      <div className="eyebrow">A SECRET OF THE MEADOW</div>
      <h2>又发现一份原野宝藏！</h2>
      <p>星砂在掌心闪闪发光。下一位伙伴，正在远方等你。</p>
      <span className="reward-xp">
        <Star size={17} />
        +3 星砂 · 累计 {expedition.totalTreasures} 份宝藏
      </span>
      <button className="primary" onClick={() => setPanel('map')}>
        看看下一站
        <ArrowRight size={17} />
      </button>
      <button className="text-action" onClick={newExpedition}>
        再来一次原野寻宝
        <RotateCcw size={13} />
      </button>
    </div>
  );
}
