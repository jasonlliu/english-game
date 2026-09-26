import { ArrowRight, Heart, Zap } from 'lucide-react';
import CompanionPortrait from '../../components/CompanionPortrait';
import { PETS } from '../../game/adventure';
import { getDialogModel, type DialogProps } from './types';

export default function RewardDialog(props: DialogProps) {
  const { reward, shownStage, choosePet, closeModal } = getDialogModel(props);
  if (!reward) return null;
  return (
    <div className="reward-content">
      <div className="reward-sparkles">
        ✧ <span>✦</span> ✧
      </div>
      <div className="reward-pet">
        <CompanionPortrait
          petId={reward === 'checkin' ? 'ember' : reward}
          stage={reward === 'checkin' ? shownStage : 1}
        />
      </div>
      <div className="eyebrow">
        {reward === 'checkin' ? 'ONE MORE DAY, ONE MORE ADVENTURE' : 'WELCOME TO THE TEAM'}
      </div>
      <h2>
        {reward === 'checkin' ? '打卡成功，又成长了一点！' : `${PETS[reward].name}加入了队伍！`}
      </h2>
      <p>{reward === 'checkin' ? '每一次坚持，都成为下一场冒险的勇气。' : PETS[reward].ability}</p>
      <span className="reward-xp">
        {reward === 'checkin' ? (
          <>
            <Zap size={16} />
            +40 成长能量
          </>
        ) : (
          <>
            <Heart size={16} />
            新伙伴已永久收录
          </>
        )}
      </span>
      <button
        className="primary"
        onClick={() => {
          if (reward !== 'checkin') choosePet(reward);
          closeModal();
        }}
      >
        {reward === 'checkin' ? '回到冒险' : '带上它，一起出发'}
        <ArrowRight size={17} />
      </button>
      {reward !== 'checkin' && (
        <button className="text-action" onClick={closeModal}>
          先让它在营地休息
        </button>
      )}
    </div>
  );
}
