import { ArrowRight, ChevronDown, Compass } from 'lucide-react';
import type { AdventureController } from '../../app/useAdventureController';
import { REGION_IDS } from '../../game/adventure';
import { preloadTempleScene } from '../../loading/SceneHost';

export default function WorldTitle({ game }: { game: AdventureController }) {
  const {
    setPanel,
    region,
    templeTheme,
    templeVisited,
    unlocked,
    isModal,
    RegionIcon,
    enterTemple,
  } = game;
  return (
    <section className="world-title" inert={isModal}>
      <div className="region-kicker">
        <span /> CHAPTER {String(region.day).padStart(2, '0')} · {region.element}之旅
      </div>
      <h1>{region.name}</h1>
      <p>{region.description}</p>
      <button className="travel-entry" onClick={() => setPanel('map')}>
        <RegionIcon size={13} />
        {unlocked.length} / {REGION_IDS.length} 场景已解锁 <ChevronDown size={12} />
      </button>
      <button
        className="temple-discover"
        onPointerEnter={preloadTempleScene}
        onFocus={preloadTempleScene}
        onClick={enterTemple}
      >
        <Compass size={13} />
        {templeVisited ? `重访${templeTheme.name}` : `探索${templeTheme.name}`}
        <ArrowRight size={12} />
      </button>
    </section>
  );
}
