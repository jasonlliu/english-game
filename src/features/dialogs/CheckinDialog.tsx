import { CalendarCheck, Check, Zap } from 'lucide-react';
import CompanionPortrait from '../../components/CompanionPortrait';
import { getDialogModel, type DialogProps } from './types';

export default function CheckinDialog(props: DialogProps) {
  const { mode, shownStage, checkin } = getDialogModel(props);
  return (
    <div className="checkin-dialog">
      <div className="completion-emblem">
        <CalendarCheck size={35} />
      </div>
      <div className="eyebrow">A LITTLE EFFORT, A LITTLE MAGIC</div>
      <h2>今天的学习，完成啦！</h2>
      <p>
        在你平时学习的地方完成后，
        <br />
        来这里记下今天的坚持。
      </p>
      <div className="checkin-reward-preview">
        <CompanionPortrait petId="ember" stage={shownStage} />
        <div>
          <b>给主人公和伙伴的成长能量</b>
          <span>
            <Zap size={14} />
            40 XP · 烁牙会逐渐进化
          </span>
        </div>
      </div>
      <button className="primary" onClick={() => checkin()}>
        我已完成学习，确认打卡
        <Check size={18} />
      </button>
      <small>
        {mode === 'demo' ? '演示打卡，不计入真实记录' : '每天一次 · 由孩子或家长确认完成'}
      </small>
    </div>
  );
}
