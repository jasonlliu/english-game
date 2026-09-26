import {
  ArrowRight,
  CalendarCheck,
  Compass,
  Droplets,
  Gem,
  LockKeyhole,
  Mountain,
  Sun,
} from 'lucide-react';
import type { CSSProperties } from 'react';
import { elementIcons, waypointNames, zoneKeys } from '../../app/presentation';
import CompanionPortrait from '../../components/CompanionPortrait';
import { PETS, REGION_IDS, REGIONS } from '../../game/adventure';
import { REGION_PLACES } from '../../game/landmarks';
import { preloadRegionScene } from '../../loading/SceneHost';
import { getDialogModel, type DialogProps } from './types';

export default function TravelAtlas(props: DialogProps) {
  const {
    mode,
    adventure,
    regionId,
    region,
    shownStage,
    unlocked,
    seals,
    templeVisited,
    enterRegion,
    simulateTomorrow,
    travelTo,
    travelToPlace,
  } = getDialogModel(props);
  return (
    <div className="travel-atlas">
      <div className="eyebrow">SIX WORLDS, SIX NEW STORIES</div>
      <h2>下一站，会遇见谁？</h2>
      <p>每天首次进入，解锁下一片风景。不用连续登录，已解锁的场景一直保留。</p>
      <div className="travel-progress">
        <CalendarCheck size={17} />
        <span>
          已开启 <b>{unlocked.length}</b> / {REGION_IDS.length} 个场景
        </span>
        <small>
          {unlocked.length === REGION_IDS.length ? '完整旅图已点亮' : '明天再来，发现下一站'}
        </small>
      </div>
      <div className="region-grid">
        {REGION_IDS.map((id) => {
          const item = REGIONS[id],
            pet = PETS[item.petId],
            Icon = elementIcons[id],
            available = unlocked.includes(id),
            current = regionId === id,
            caught = adventure.capturedPets.includes(pet.id);
          return (
            <button
              key={id}
              className={`region-card region-${id} ${available ? 'available' : 'locked'} ${current ? 'current' : ''}`}
              disabled={!available}
              onPointerEnter={() => {
                if (available) preloadRegionScene(id);
              }}
              onFocus={() => {
                if (available) preloadRegionScene(id);
              }}
              onClick={() => enterRegion(id)}
              style={{ '--scene-accent': item.color } as CSSProperties}
            >
              <div className="region-card-scene">
                <span className="scene-moon" />
                <span className="scene-hill one" />
                <span className="scene-hill two" />
                <Icon size={35} strokeWidth={1.2} />
                <CompanionPortrait petId={pet.id} stage={pet.id === 'ember' ? shownStage : 1} />
                <span className="region-day">DAY {String(item.day).padStart(2, '0')}</span>
                {!available && (
                  <span className="scene-lock">
                    <LockKeyhole size={19} />
                  </span>
                )}
              </div>
              <div className="region-card-text">
                <span className="element-badge">{item.element}属性</span>
                <h3>{item.name}</h3>
                <p>{available ? `当地伙伴 · ${pet.name}` : `第 ${item.day} 个到访日开启`}</p>
                <span className="region-status">
                  {!available
                    ? '等待下一次到访'
                    : current
                      ? '正在探索'
                      : caught
                        ? '重访 · 伙伴已结识'
                        : '进入探索'}
                  {available ? <ArrowRight size={14} /> : <LockKeyhole size={12} />}
                </span>
              </div>
            </button>
          );
        })}
      </div>
      {mode === 'demo' && (
        <button
          className="primary demo-next-day"
          disabled={unlocked.length === REGION_IDS.length}
          onClick={simulateTomorrow}
        >
          <Sun size={17} />
          {unlocked.length === REGION_IDS.length ? '全部场景已解锁' : '模拟明天 · 解锁下一片场景'}
        </button>
      )}
      <div className="current-waypoints">
        <h3>当前场景 · {region.name}</h3>
        <div className="map-destinations">
          {zoneKeys.map((key, i) => (
            <button key={key} onClick={() => travelTo(key)}>
              <Gem size={18} />
              <b>{waypointNames[regionId][i]}</b>
              <small>
                {seals.includes(i) ? '已探索' : '带我前往'}
                <ArrowRight size={11} />
              </small>
            </button>
          ))}
        </div>
        <h3 className="landmark-list-heading">建筑与自然奇观</h3>
        <div className="landmark-list">
          {REGION_PLACES[regionId].map((place) => (
            <button key={place.id} onClick={() => travelToPlace(place)}>
              <span>
                {place.kind === 'temple' ? (
                  <Compass size={21} />
                ) : place.kind === 'waterfall' || place.kind === 'spring' ? (
                  <Droplets size={21} />
                ) : (
                  <Mountain size={21} />
                )}
              </span>
              <div>
                <b>
                  {place.name}
                  {place.kind === 'temple' && (
                    <em>{templeVisited ? '遗物已收藏' : '可进入探索'}</em>
                  )}
                </b>
                <p>{place.description}</p>
              </div>
              <ArrowRight size={15} />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
