import { ArrowRight, Check, Compass, Gem, LockKeyhole, MapPin, Wind } from 'lucide-react';
import { useState, type CSSProperties } from 'react';
import CompanionPortrait from '../../components/CompanionPortrait';
import { PETS, REGION_IDS, REGIONS } from '../../game/adventure';
import { EMBER_FORMS, PET_IDENTITIES } from '../../game/petIdentity';
import { TEMPLE_THEMES } from '../../game/temple';
import { getDialogModel, type DialogProps } from './types';
import './petCollection.css';

export default function CompanionJournal(props: DialogProps) {
  const {
    progress,
    adventure,
    templeProgress,
    shownStage,
    stage,
    flight,
    unlocked,
    closeModal,
    setPanel,
    choosePet,
    enterRegion,
  } = getDialogModel(props);
  const [filter, setFilter] = useState<'all' | 'caught' | 'wild'>('all');
  const remaining = REGION_IDS.length - adventure.capturedPets.length;
  return (
    <div className="journal creature-journal">
      <div className="eyebrow">THE CREATURE ATLAS</div>
      <h2>六种身影，六段冒险。</h2>
      <p>海鳍、熔岩甲、星蝶翼……循着线索相遇，带上喜欢的伙伴出发。</p>
      <div className="journal-stats">
        <div>
          <b>
            {adventure.capturedPets.length}/{Object.keys(PETS).length}
          </b>
          <span>已结识伙伴</span>
        </div>
        <div>
          <b>
            {unlocked.length}/{REGION_IDS.length}
          </b>
          <span>已解锁场景</span>
        </div>
        <div>
          <b>{progress.totalMissions}</b>
          <span>累计打卡</span>
        </div>
      </div>
      <nav className="collection-filters" aria-label="筛选伙伴">
        {(
          [
            ['all', '全部伙伴', REGION_IDS.length],
            ['caught', '已结识', adventure.capturedPets.length],
            ['wild', '待发现', remaining],
          ] as const
        ).map(([value, label, count]) => (
          <button key={value} aria-pressed={filter === value} onClick={() => setFilter(value)}>
            {label}
            <span>{count}</span>
          </button>
        ))}
      </nav>
      <div className="pet-collection">
        {REGION_IDS.filter((id) => {
          const caught = adventure.capturedPets.includes(REGIONS[id].petId);
          return filter === 'all' || (filter === 'caught' ? caught : !caught);
        }).map((id) => {
          const pet = PETS[REGIONS[id].petId],
            identity = PET_IDENTITIES[pet.id],
            region = REGIONS[id],
            caught = adventure.capturedPets.includes(pet.id),
            active = adventure.activePet === pet.id,
            available = unlocked.includes(id),
            current = adventure.currentRegion === id;
          const epithet = pet.id === 'ember' ? EMBER_FORMS[shownStage - 1].name : identity.epithet;
          return (
            <article
              key={id}
              className={`pet-card ${caught ? 'caught' : 'undiscovered'} ${active ? 'active' : ''}`}
              data-species={pet.id}
              style={{ '--pet-color': pet.color, '--pet-ink': identity.ink } as CSSProperties}
            >
              <div className="pet-card-art">
                <CompanionPortrait petId={pet.id} stage={pet.id === 'ember' ? shownStage : 1} />
                <span className="element-badge">{pet.element}</span>
                <span className="specimen-number">
                  {String(REGION_IDS.indexOf(id) + 1).padStart(2, '0')} / 06
                </span>
                <span className="specimen-species">{identity.species}</span>
              </div>
              <div className="pet-card-info">
                <span className="pet-epithet">{epithet}</span>
                <h3>
                  {pet.name}
                  {active && <span>随行中</span>}
                </h3>
                <div className="pet-signature">{identity.signature}</div>
                <p>{identity.personality}</p>
                <span className="pet-flight-badge">
                  {pet.id === 'ember' ? (
                    <>
                      <Wind size={11} />
                      {stage === 3 ? '星翼已觉醒 · 可骑乘飞行' : '累计打卡 6 次解锁飞行'}
                    </>
                  ) : pet.id === 'lumi' ? (
                    <>
                      <Wind size={11} />
                      天生星翼 · 可骑乘飞行
                    </>
                  ) : null}
                </span>
                <details className="pet-fieldnote">
                  <summary>
                    <Compass size={13} />
                    {caught ? '翻开栖地手记' : '寻找它的线索'}
                  </summary>
                  <strong>{identity.habitat}</strong>
                  <p>{identity.clue}</p>
                </details>
                <small className="pet-destination">
                  {caught ? (
                    <Check size={12} />
                  ) : available ? (
                    <MapPin size={12} />
                  ) : (
                    <LockKeyhole size={12} />
                  )}
                  {region.name} ·{' '}
                  {caught
                    ? '已结识'
                    : available
                      ? '已开放，等待相遇'
                      : `第 ${region.day} 个到访日开启`}
                </small>
                <button
                  disabled={active || (caught && flight.flying)}
                  className={active ? 'selected' : ''}
                  onClick={() => {
                    if (caught) choosePet(pet.id);
                    else if (!available) setPanel('map');
                    else if (current) closeModal();
                    else enterRegion(id);
                  }}
                >
                  {active ? (
                    <>
                      <Check size={13} />
                      正在随行
                    </>
                  ) : caught ? (
                    '选择随行'
                  ) : available ? (
                    current ? (
                      `继续寻找${pet.name}`
                    ) : (
                      `前往${region.name}`
                    )
                  ) : (
                    '查看解锁路线'
                  )}
                </button>
              </div>
            </article>
          );
        })}
      </div>
      {filter === 'wild' && remaining === 0 && (
        <p className="collection-complete">
          六位伙伴都已结识。选一位喜欢的，去看看还没到过的地方吧。
        </p>
      )}
      <section className="pet-evolution" aria-label="烁牙成长形态">
        <div className="pet-evolution-heading">
          <div className="eyebrow">ONE DRAGON, THREE FORMS</div>
          <h3>和烁牙一起长大</h3>
        </div>
        <div className="pet-evolution-forms">
          {EMBER_FORMS.map((form) => (
            <article key={form.stage} className={stage >= form.stage ? 'is-unlocked' : ''}>
              <CompanionPortrait petId="ember" stage={form.stage} />
              <h4>{form.name}</h4>
              <p>{form.detail}</p>
              <small>{stage >= form.stage ? '形态已觉醒' : `累计打卡 ${form.missions} 次`}</small>
            </article>
          ))}
        </div>
      </section>
      <p className="journal-note">星翼烁牙和绮露可以载你飞行。飞行中先降落，再切换伙伴。</p>
      <button className="text-action" disabled={flight.flying} onClick={() => choosePet(null)}>
        {adventure.activePet ? '让伙伴休息，独自探索' : '当前独自探索'}
      </button>
      <section className="artifact-collection">
        <div>
          <h3>秘境遗物</h3>
          <span>
            {templeProgress.completed.length} / {REGION_IDS.length} 已发现
          </span>
        </div>
        <p>走入各地区神庙，解开光印机关，带回属于这片土地的记忆。</p>
        <div className="artifact-grid">
          {REGION_IDS.map((id) => {
            const t = TEMPLE_THEMES[id],
              found = templeProgress.completed.includes(id);
            return (
              <article
                key={id}
                className={found ? 'found' : ''}
                style={{ '--artifact-color': t.color } as CSSProperties}
              >
                <span>{found ? <Gem size={23} /> : <LockKeyhole size={18} />}</span>
                <b>{found ? t.artifact : '尚未发现'}</b>
                <small>{t.name}</small>
              </article>
            );
          })}
        </div>
      </section>
      <button className="primary journal-return" onClick={closeModal}>
        回到旅行
        <ArrowRight size={17} />
      </button>
    </div>
  );
}
