import { ArrowRight, Check, Gem, LockKeyhole, Wind } from 'lucide-react';
import type { CSSProperties } from 'react';
import CompanionPortrait from '../../components/CompanionPortrait';
import { PETS, REGION_IDS, REGIONS } from '../../game/adventure';
import { TEMPLE_THEMES } from '../../game/temple';
import { getDialogModel, type DialogProps } from './types';

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
  } = getDialogModel(props);
  return (
    <div className="journal">
      <div className="eyebrow">YOUR TRAVELLING COMPANIONS</div>
      <h2>每一段旅程，都有新朋友。</h2>
      <p>控制人类主人公旅行，选择一位已捕获的伙伴随行。</p>
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
      <div className="pet-collection">
        {REGION_IDS.map((id) => {
          const pet = PETS[REGIONS[id].petId],
            caught = adventure.capturedPets.includes(pet.id),
            active = adventure.activePet === pet.id;
          return (
            <article
              key={id}
              className={`pet-card ${caught ? 'caught' : 'undiscovered'} ${active ? 'active' : ''}`}
              style={{ '--pet-color': pet.color } as CSSProperties}
            >
              <div className="pet-card-art">
                <CompanionPortrait petId={pet.id} stage={pet.id === 'ember' ? shownStage : 1} />
                <span className="element-badge">{pet.element}</span>
                {!caught && <LockKeyhole className="pet-lock" size={18} />}
              </div>
              <div className="pet-card-info">
                <h3>
                  {pet.name}
                  {active && <span>随行中</span>}
                </h3>
                <p>{pet.description}</p>
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
                <small>
                  {REGIONS[id].name} · {caught ? '已结识' : `第 ${REGIONS[id].day} 个到访日解锁`}
                </small>
                <button
                  disabled={active || (caught && flight.flying)}
                  className={active ? 'selected' : ''}
                  onClick={() => (caught ? choosePet(pet.id) : setPanel('map'))}
                >
                  {active ? (
                    <>
                      <Check size={13} />
                      正在随行
                    </>
                  ) : caught ? (
                    '选择随行'
                  ) : (
                    '前往发现'
                  )}
                </button>
              </div>
            </article>
          );
        })}
      </div>
      <p className="journal-note">
        烁牙随累计打卡 3 / 6
        次解锁晶甲与星翼。星翼烁牙和绮露可以载你飞行。飞行中先降落，再切换伙伴。
      </p>
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
