import {
  ArrowRight,
  Check,
  Compass,
  Gem,
  LockKeyhole,
  MapPin,
  Navigation,
  Sun,
} from 'lucide-react';
import { useState, type CSSProperties } from 'react';
import { elementIcons, waypointNames, zoneKeys } from '../../app/presentation';
import { REGION_IDS, REGIONS, type RegionId } from '../../game/adventure';
import { REGION_PLACES } from '../../game/landmarks';
import { getRegionSurvey, getWorldSurvey } from '../../game/worldSurvey';
import { preloadRegionScene } from '../../loading/SceneHost';
import RegionSurveyMap from './RegionSurveyMap';
import WorldAtlasChart from './WorldAtlasChart';
import { getDialogModel, type DialogProps } from './types';

export default function TravelAtlas(props: DialogProps) {
  const {
    mode,
    regionId,
    survey,
    position,
    unlocked,
    seals,
    enterRegion,
    simulateTomorrow,
    travelTo,
    travelToPlace,
    closeModal,
    setPanel,
  } = getDialogModel(props);
  const [selected, setSelected] = useState<RegionId>(regionId);
  const [selectedPlace, setSelectedPlace] = useState<string | null>(null);
  const world = getWorldSurvey(survey),
    local = getRegionSurvey(selected, survey);
  const region = REGIONS[selected],
    available = unlocked.includes(selected),
    current = regionId === selected;
  const found = survey.regions[selected].places;
  const places = REGION_PLACES[selected];
  const place =
    places.find((item) => item.id === selectedPlace) ??
    places.find((item) => !found.includes(item.id)) ??
    places[0];
  const discovered = found.includes(place.id);
  const selectRegion = (id: RegionId) => {
    setSelected(id);
    setSelectedPlace(null);
  };

  return (
    <div className="world-atlas">
      <header className="atlas-heading">
        <div>
          <div className="eyebrow">THE WORLD, ONE FOOTSTEP AT A TIME</div>
          <h2>把足迹，留在世界里。</h2>
          <p>每一处新发现，都会成为旅程的一部分。</p>
        </div>
        <div
          className="atlas-total"
          aria-label={`世界探索度 ${world.percent}%，已到访 ${world.found} / ${world.total} 个地标`}
        >
          <svg viewBox="0 0 92 92" aria-hidden="true">
            <circle cx="46" cy="46" r="40" fill="none" stroke="#d9dfce" strokeWidth="5" />
            <circle
              cx="46"
              cy="46"
              r="40"
              fill="none"
              stroke="#547862"
              strokeWidth="5"
              strokeDasharray={`${world.percent * 2.513} 252`}
              transform="rotate(-90 46 46)"
              strokeLinecap="round"
            />
          </svg>
          <span>
            <b>
              {world.percent}
              <small>%</small>
            </b>
            <em>世界探索度</em>
          </span>
        </div>
      </header>
      <div className="atlas-summary">
        <span>
          <MapPin size={15} />
          已到访{' '}
          <b>
            {world.found} / {world.total}
          </b>{' '}
          个地标
        </span>
        <span>
          <Compass size={15} />
          已解锁{' '}
          <b>
            {unlocked.length} / {REGION_IDS.length}
          </b>{' '}
          片区域
        </span>
        <span className="atlas-shortcut">
          <kbd>M</kbd> 地图
        </span>
      </div>
      <WorldAtlasChart
        survey={survey}
        unlocked={unlocked}
        current={regionId}
        selected={selected}
        onSelect={selectRegion}
      />
      <p className="atlas-progress-note">
        探索度按已到访地标计算。解锁后仍需亲自探索，走过的范围会逐步点亮。
      </p>
      <nav className="atlas-region-tabs" aria-label="选择地图区域">
        {REGION_IDS.map((id) => {
          const item = REGIONS[id],
            Icon = elementIcons[id];
          return (
            <button
              key={id}
              aria-pressed={id === selected}
              aria-label={`${item.name}${unlocked.includes(id) ? '' : '，未解锁'}${id === regionId ? '，你在这里' : ''}`}
              onClick={() => selectRegion(id)}
              style={{ '--atlas-region': item.color } as CSSProperties}
            >
              <Icon size={15} />
              <span>{item.name}</span>
              {!unlocked.includes(id) && <LockKeyhole size={11} />}
            </button>
          );
        })}
      </nav>
      <section className="atlas-region-detail" aria-label={`${region.name}探索详情`}>
        <div className="atlas-region-heading">
          <div>
            <small>
              {region.element}之境{current ? ' · 你在这里' : ''}
            </small>
            <h3>{region.name}</h3>
          </div>
          <div className="atlas-region-percent">
            <b>{local.percent}%</b>
            <span>
              {local.found} / {local.total} 地标
            </span>
          </div>
        </div>
        <progress
          className="atlas-region-bar"
          value={local.found}
          max={local.total}
          aria-label={`${region.name}地标探索进度`}
        />
        {available ? (
          <>
            <div className="atlas-detail-grid">
              <RegionSurveyMap
                regionId={selected}
                survey={survey}
                position={current ? position : undefined}
                selectedPlace={place.id}
                onSelectPlace={setSelectedPlace}
              />
              <aside className="atlas-place-card">
                <span className={`atlas-place-state ${discovered ? 'is-found' : ''}`}>
                  {discovered ? <Check size={14} /> : <Compass size={14} />}
                  {discovered ? '足迹已记录' : '下一处新发现'}
                </span>
                <h4>{place.name}</h4>
                <p>{place.description}</p>
                {place.kind === 'temple' && (
                  <small className="atlas-temple-note">
                    {props.templeProgress.completed.includes(selected)
                      ? '神庙遗物已收藏'
                      : '抵达入口后，还可以进入神庙探索。'}
                  </small>
                )}
                <button
                  className="primary"
                  onClick={() => (current ? travelToPlace(place) : enterRegion(selected))}
                  onPointerEnter={() => {
                    if (!current) preloadRegionScene(selected);
                  }}
                  onFocus={() => {
                    if (!current) preloadRegionScene(selected);
                  }}
                >
                  <Navigation size={16} />
                  {current ? '带我前往' : `前往${region.name}`}
                  <ArrowRight size={15} />
                </button>
                <small>
                  {current
                    ? '沿路走近地标，就会自动记入地图。'
                    : '抵达区域后，在地图里选择地标带路。'}
                </small>
              </aside>
            </div>
            <div className="atlas-place-list" aria-label="区域地标清单">
              {places.map((item) => (
                <button
                  key={item.id}
                  aria-pressed={place.id === item.id}
                  onClick={() => setSelectedPlace(item.id)}
                >
                  <span>
                    {found.includes(item.id) ? <Check size={14} /> : <MapPin size={14} />}
                    {item.name}
                  </span>
                  <small>{found.includes(item.id) ? '已到访' : '待探索'}</small>
                </button>
              ))}
            </div>
            {current && (
              <div className="atlas-secondary-actions">
                <button onClick={closeModal}>
                  继续自由探索 <ArrowRight size={14} />
                </button>
                {selected === 'meadow' && (
                  <button onClick={() => setPanel('expedition')}>
                    翻开原野探险手记 <ArrowRight size={14} />
                  </button>
                )}
              </div>
            )}
          </>
        ) : (
          <div className="atlas-locked-region">
            <LockKeyhole size={28} />
            <h4>风景还在远方等你</h4>
            <p>{region.description}</p>
            <span>第 {region.day} 个到访日开启，不需要连续登录。</span>
            {mode === 'demo' && (
              <button className="primary" onClick={simulateTomorrow}>
                <Sun size={16} />
                模拟明天 · 解锁下一片区域
              </button>
            )}
          </div>
        )}
      </section>
      {current && available && (
        <details className="atlas-seal-routes">
          <summary>
            <Gem size={15} />
            符印寻踪 <span>{seals.length} / 3</span>
          </summary>
          <div>
            {zoneKeys.map((key, index) => (
              <button key={key} onClick={() => travelTo(key)}>
                {waypointNames[regionId][index]}
                <small>
                  {seals.includes(index) ? '符印已收集' : '带我前往'} <ArrowRight size={12} />
                </small>
              </button>
            ))}
          </div>
        </details>
      )}
      {mode === 'demo' && unlocked.length < REGION_IDS.length && available && (
        <button className="atlas-demo-next" onClick={simulateTomorrow}>
          <Sun size={14} />
          模拟明天 · 解锁下一片区域
        </button>
      )}
    </div>
  );
}
