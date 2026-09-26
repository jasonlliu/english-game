import { ArrowRight, Compass, Map, PawPrint, Volume2 } from 'lucide-react';
import { PETS } from '../../game/adventure';
import { getWorldSurvey } from '../../game/worldSurvey';
import { getDialogModel, type DialogProps } from './types';
import './adventureMenu.css';

export default function AdventureMenu(props: DialogProps) {
  const { menu, region, templeTheme, adventure, expedition, mode, setPanel, closeModal } =
    getDialogModel(props);
  if (!menu) return null;
  const companion = adventure.activePet ? PETS[adventure.activePet] : null;
  function resume(action: () => void) {
    closeModal();
    action();
  }
  return (
    <div className="adventure-menu">
      <div className="eyebrow">旅途暂歇 · {mode === 'demo' ? '演示世界' : '我的世界'}</div>
      <h2>冒险菜单</h2>
      <p className="menu-summary">
        {region.name} · {expedition.stars} 星砂
      </p>
      <div className="menu-destinations">
        <button onClick={() => setPanel('map')}>
          <Map size={21} />
          <span>
            <b>世界地图</b>
            <small>已探索 {getWorldSurvey(props.survey).percent}%</small>
          </span>
          <ArrowRight size={16} />
        </button>
        <button onClick={() => setPanel('journal')}>
          <PawPrint size={21} />
          <span>
            <b>随行伙伴</b>
            <small>{companion ? `${companion.name}随行中` : '选择伙伴 · 骑乘飞行'}</small>
          </span>
          <ArrowRight size={16} />
        </button>
        <button onClick={() => setPanel('expedition')}>
          <Compass size={21} />
          <span>
            <b>探险手记</b>
            <small>任务线索 · 动物 · 竞速</small>
          </span>
          <ArrowRight size={16} />
        </button>
        <button onClick={() => setPanel('sound')}>
          <Volume2 size={21} />
          <span>
            <b>声音设置</b>
            <small>音乐和音效</small>
          </span>
          <ArrowRight size={16} />
        </button>
      </div>
      <section className="menu-quest">
        <small>接下来可以做</small>
        <h3>{menu.questTitle}</h3>
        <p>
          {adventure.capturedPets.includes(region.petId) && adventure.currentRegion !== 'meadow'
            ? '带上新伙伴，去地图上还没走过的地方看看。'
            : region.challenge}
        </p>
        <button onClick={() => resume(menu.questAction)}>
          {menu.questButton}
          <ArrowRight size={16} />
        </button>
      </section>
      <button
        className="menu-temple"
        onClick={() => resume(menu.insideTemple ? menu.exitTemple : menu.enterTemple)}
      >
        <Compass size={17} />
        {menu.insideTemple ? '离开神庙，返回旷野' : `探索${templeTheme.name}`}
        <ArrowRight size={16} />
      </button>
      <div className="menu-footer">
        <button onClick={() => setPanel('guide')}>玩法帮助</button>
        <button onClick={() => resume(() => menu.changeMode(mode === 'real' ? 'demo' : 'real'))}>
          {mode === 'demo' ? '返回真实世界' : '进入演示世界'}
        </button>
      </div>
      {mode === 'demo' && (
        <details className="menu-demo">
          <summary>演示工具</summary>
          <div>
            <button onClick={props.simulateTomorrow}>模拟明天</button>
            <button onClick={() => props.checkin(true)}>模拟打卡 +40</button>
            <button onClick={() => resume(menu.resetDemo)}>重置演示进度</button>
          </div>
        </details>
      )}
      <button className="menu-resume" onClick={closeModal}>
        继续探索
      </button>
    </div>
  );
}
