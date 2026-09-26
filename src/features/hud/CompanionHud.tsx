import { ChevronDown, Heart, PawPrint } from 'lucide-react';
import type { AdventureController } from '../../app/useAdventureController';
import CompanionPortrait from '../../components/CompanionPortrait';
import { getPetLevel } from '../../game';
import { PETS } from '../../game/adventure';

export default function CompanionHud({ game }: { game: AdventureController }) {
  const { progress, adventure, setPanel, companion, shownStage, isModal } = game;
  return (
    <div className="companion-hud" inert={isModal}>
      <button
        className="companion-avatar"
        aria-label="选择随行伙伴"
        onClick={() => setPanel('journal')}
      >
        {companion ? (
          <CompanionPortrait
            petId={companion.id}
            stage={companion.id === 'ember' ? shownStage : 1}
          />
        ) : (
          <PawPrint size={30} />
        )}
        <span>
          <Heart size={10} fill="currentColor" />
        </span>
      </button>
      <button className="companion-summary" onClick={() => setPanel('journal')}>
        <div>
          <b>{companion?.name || '独自探索'}</b>
          <span>{companion ? `${companion.element} · 随行` : '选择伙伴'}</span>
        </div>
        <p>
          冒险者 Lv.{Math.max(1, getPetLevel(progress))} · 已结识 {adventure.capturedPets.length} /{' '}
          {Object.keys(PETS).length} 位伙伴
        </p>
        <div className="xp-track">
          <span style={{ width: `${((progress.xp % 120) / 120) * 100}%` }} />
        </div>
        <small>
          切换伙伴 <ChevronDown size={9} />
        </small>
      </button>
    </div>
  );
}
