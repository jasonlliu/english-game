import {
  ArrowRight,
  Check,
  ChevronDown,
  ChevronUp,
  Compass,
  Gem,
  Gift,
  PawPrint,
} from 'lucide-react';
import type { AdventureController } from '../../app/useAdventureController';

import { waypointNames, zoneKeys } from '../../app/presentation';

export default function QuestPanel({ game }: { game: AdventureController }) {
  const {
    collapsed,
    regionId,
    region,
    wildPet,
    owned,
    isMeadow,
    seals,
    isModal,
    toggleTask,
    travelTo,
    questAction,
    questTitle,
    questButton,
  } = game;
  return (
    <aside className={`adventure-objective ${collapsed ? 'is-collapsed' : ''}`} inert={isModal}>
      <button
        className="quest-toggle"
        aria-expanded={!collapsed}
        aria-controls="quest-details"
        onClick={toggleTask}
      >
        <span className="quest-glyph">
          <Compass size={21} />
        </span>
        <span className="quest-toggle-copy">
          <span className="small-kicker">当前探索 · {seals.length} / 3</span>
          <strong>{questTitle}</strong>
        </span>
        {collapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
        <span className="sr-only">{collapsed ? '展开任务面板' : '收起任务面板'}</span>
      </button>
      {!collapsed && (
        <div id="quest-details">
          <p>
            {isMeadow
              ? '探索三个地点，收集光晶并发现宝藏。'
              : owned
                ? '你们的故事才刚刚开始，带它去新的风景。'
                : region.challenge}
          </p>
          <div className="crystal-progress">
            {zoneKeys.map((key, id) => (
              <button
                key={key}
                className={`crystal-waypoint crystal-${id} ${seals.includes(id) ? 'collected' : ''}`}
                aria-label={`前往${waypointNames[regionId][id]}`}
                onClick={() => travelTo(key)}
              >
                <span>{seals.includes(id) ? <Check size={15} /> : <Gem size={15} />}</span>
                <small>{['祭坛', '林地', '湖畔'][id]}</small>
              </button>
            ))}
            <span className="crystal-count">
              <b>{seals.length}</b>/3
            </span>
          </div>
          <button className="quest-action" onClick={questAction}>
            {questButton}
            <ArrowRight size={16} />
          </button>
          <div className="quest-prize">
            {isMeadow ? (
              <>
                <Gift size={11} />
                藏品 · 3 星砂
              </>
            ) : (
              <>
                <PawPrint size={11} />
                {wildPet.element}属性伙伴 · {wildPet.name}
              </>
            )}
          </div>
        </div>
      )}
    </aside>
  );
}
