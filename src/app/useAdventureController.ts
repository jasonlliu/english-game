import { useEffect, useRef, useState } from 'react';
import { getPetStage, getTodayKey, type Mode } from '../game';
import { getUnlockedRegions, PETS, REGIONS, type PetId, type RegionId } from '../game/adventure';
import type { FlightStatus } from '../game/flight';
import { canPetFly } from '../game/flightEligibility';
import { getDiscoveryObjective } from '../game/discovery';
import { MIN_RACE_SECONDS, RACE_DURATION } from '../game/fieldActivities';
import { REGION_PLACES, TEMPLE_ENTRANCE, type RegionPlace } from '../game/landmarks';
import { TEMPLE_THEMES } from '../game/temple';
import { SPAWN_POSITION, type WorldPoint, type WorldZone } from '../game/worldLayout';
import { useGameAudio } from './useGameAudio';
import { useGameSession } from './useGameSession';
import { createWorldTelemetry } from './worldTelemetry';

import { elementIcons, waypointNames, zoneKeys, type Panel } from './presentation';
const uniqueId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

export function useAdventureController() {
  const { snapshot, session } = useGameSession();
  const {
    mode,
    progress,
    expedition,
    adventure,
    templeProgress,
    discovery,
    field,
    today,
    storageWarning,
  } = snapshot;
  const [insideTemple, setInsideTemple] = useState(false);
  const [nearTemple, setNearTemple] = useState(false);
  const [spawnPoint, setSpawnPoint] = useState<WorldPoint | undefined>();
  const [travelPoint, setTravelPoint] = useState<WorldPoint | null>(null);
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem('lumen.taskCollapsed') !== 'false';
    } catch {
      return true;
    }
  });
  const [travelTarget, setTravelTarget] = useState<WorldZone | null>(null);
  const [travelRequest, setTravelRequest] = useState(0);
  const [worldReset, setWorldReset] = useState(0);
  const [readyScene, setReadyScene] = useState<string | null>(null);
  const [flightRequest, setFlightRequest] = useState(0);
  const [flight, setFlight] = useState<FlightStatus>({
    flying: false,
    landing: false,
    altitude: 0,
  });
  const [telemetry] = useState(createWorldTelemetry);
  const setPosition = telemetry.position.set;
  function reportFlight(next: FlightStatus) {
    telemetry.flight.set(next);
    setFlight((current) =>
      current.flying === next.flying && current.landing === next.landing ? current : next,
    );
  }
  const [nearWild, setNearWild] = useState(false);
  const [panel, setPanel] = useState<Panel>(null);
  const [reward, setReward] = useState<'checkin' | PetId | null>(null);
  const [petExcited, setPetExcited] = useState(0);
  const [toast, setToast] = useState('');
  const missionId = useRef('');
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const regionId = adventure.currentRegion;
  const sceneId = `${mode}-${regionId}-${worldReset}`;
  const sceneReady = readyScene === sceneId && !insideTemple;
  const reportSceneReady = (ready: boolean) => setReadyScene(ready ? sceneId : null);
  const region = REGIONS[regionId];
  const templeTheme = TEMPLE_THEMES[regionId];
  const templeVisited = templeProgress.completed.includes(regionId);
  const wildPet = PETS[region.petId];
  const owned = adventure.capturedPets.includes(region.petId);
  const companion = adventure.activePet ? PETS[adventure.activePet] : null;
  const unlocked = getUnlockedRegions(adventure);
  const stage = getPetStage(progress);
  const canFly = canPetFly(adventure.activePet, stage);
  const shownStage = Math.max(1, stage) as 1 | 2 | 3;
  const isMeadow = regionId === 'meadow';
  const seals = isMeadow ? expedition.crystals : adventure.seals[regionId];
  const readyToCapture = !owned && seals.length === 3;
  const doneToday = mode === 'real' && progress.completedDates.includes(today);
  const isModal = panel !== null || reward !== null;
  const discoveryContext = useRef({ isModal, insideTemple });
  discoveryContext.current = { isModal, insideTemple };
  const discoveryObjective = getDiscoveryObjective(discovery);
  const audio = useGameAudio({
    region: regionId,
    temple: insideTemple,
    flying: flight.flying,
    ducked: isModal,
  });
  const playSound = audio.play;
  const nextCrystal = [0, 1, 2].find((id) => !seals.includes(id));
  const RegionIcon = elementIcons[regionId];
  const notify = (message: string) => {
    setToast(message);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 4500);
  };
  const closeModal = () => {
    setPanel(null);
    setReward(null);
  };

  useEffect(() => () => clearTimeout(toastTimer.current), []);

  function returnToCamp() {
    setInsideTemple(false);
    setNearTemple(false);
    setSpawnPoint(undefined);
    setTravelPoint(null);
    setTravelTarget(null);
    setTravelRequest(0);
    setNearWild(false);
    setFlightRequest(0);
    reportFlight({ flying: false, landing: false, altitude: 0 });
    setPosition({ ...SPAWN_POSITION, heading: 0 });
    setWorldReset((n) => n + 1);
  }
  function changeMode(next: Mode) {
    const url = new URL(window.location.href);
    if (next === 'demo') url.searchParams.set('mode', 'demo');
    else url.searchParams.delete('mode');
    window.history.replaceState(null, '', url);
    session.switchMode(next);
    returnToCamp();
    closeModal();
    notify(
      next === 'demo'
        ? '演示世界独立保存，可以模拟明天解锁新场景。'
        : '已回到真实旅程，打卡和伙伴都在。',
    );
  }
  function toggleTask() {
    setCollapsed((current) => {
      try {
        localStorage.setItem('lumen.taskCollapsed', String(!current));
      } catch {
        /* Optional UI preference. */
      }
      return !current;
    });
  }
  function startCheckin() {
    missionId.current = mode === 'real' ? `daily-${getTodayKey()}` : `demo-${uniqueId()}`;
    setPanel('checkin');
  }
  function checkin(quick = false) {
    if (quick && mode !== 'demo') return;
    const result = session.checkin(quick ? `demo-${uniqueId()}` : missionId.current);
    if (!result.rewarded) {
      closeModal();
      notify('今天已经打卡啦，去和伙伴探索新风景吧。');
      return;
    }
    setPanel(null);
    setReward('checkin');
    audio.play('reward');
    setPetExcited((n) => n + 1);
  }

  function collect(id: number) {
    const result = session.collect(id, regionId);
    if (!result.collected) return;
    audio.play('collect');
    if (result.region === 'meadow')
      notify(
        result.count === 3 ? '三枚光晶齐了，可以打开原野宝箱！' : `发现光晶 ${result.count} / 3`,
      );
    else {
      const place = REGIONS[result.region];
      notify(
        result.count === 3
          ? `三枚${place.sealName}集齐了！去祭坛寻找${PETS[place.petId].name}。`
          : `找到${place.sealName} ${result.count} / 3`,
      );
    }
  }
  function investigateDiscovery(id: string, position: WorldPoint) {
    const current = session.getSnapshot();
    // This callback belongs to the scene that received it, even after a mode/region change.
    if (current.mode !== mode || current.adventure.currentRegion !== regionId) return;
    if (discoveryContext.current.isModal || discoveryContext.current.insideTemple) return;
    const currentFlight = telemetry.flight.getSnapshot();
    if (currentFlight.flying || currentFlight.landing) {
      notify('先安全降落，再靠近查看线索。');
      return;
    }
    const result = session.investigateDiscovery(id, position, regionId);
    if (result.feedback) playSound(result.feedback === 'bell-wrong' ? 'mistake' : 'seal');
    else if (result.changed) playSound(result.reward ? 'reward' : 'collect');
    if (result.changed && result.reward) setPetExcited((n) => n + 1);
    notify(result.message);
  }
  function canRecordFieldActivity() {
    const current = session.getSnapshot();
    return (
      current.mode === mode &&
      current.adventure.currentRegion === regionId &&
      regionId === 'meadow' &&
      !discoveryContext.current.isModal &&
      !discoveryContext.current.insideTemple &&
      !telemetry.flight.getSnapshot().flying
    );
  }
  function recordWildlife(kind: string) {
    if (!canRecordFieldActivity()) return;
    const result = session.recordWildlife(kind, regionId);
    if (!result.changed) return;
    playSound(result.completed ? 'reward' : 'collect');
    setPetExcited((n) => n + 1);
    notify(
      result.completed
        ? '五种动物都认识了！获得「原野观察家」徽章。'
        : `自然笔记 +1 · 已观察 ${result.state.observed.length} / 5 种动物，打开手记查看。`,
    );
  }
  function recordMeadowRace(seconds: number) {
    if (
      !canRecordFieldActivity() ||
      !Number.isFinite(seconds) ||
      seconds < MIN_RACE_SECONDS ||
      seconds > RACE_DURATION
    )
      return;
    const result = session.recordMeadowRace(seconds, regionId);
    if (!canRecordFieldActivity()) return;
    playSound('reward');
    setPetExcited((n) => n + 1);
    notify(
      `${seconds.toFixed(2)} 秒完成风车竞速${result.changed ? '，刷新个人最好成绩！' : '，可以再试一次挑战纪录。'}`,
    );
  }
  function unlockTreasure() {
    const result = session.openTreasure();
    if (!result.opened) return;
    audio.play('reward');
    setPetExcited((n) => n + 1);
    setPanel('treasure');
  }
  function newExpedition() {
    session.newExpedition();
    returnToCamp();
    closeModal();
    notify('已回到营地，开始新一轮原野寻宝。');
  }
  function resetDemo() {
    if (mode !== 'demo') return;
    session.resetDemo();
    returnToCamp();
    closeModal();
    notify('演示已重置，真实旅程不变。');
  }
  function simulateTomorrow() {
    const next = session.simulateTomorrow();
    setPanel('map');
    notify(
      getUnlockedRegions(next).length > unlocked.length
        ? `新的旅行地已解锁：${REGIONS[getUnlockedRegions(next).at(-1)!].name}`
        : '六个场景已经全部解锁，去收集所有伙伴吧。',
    );
  }
  function enterRegion(id: RegionId) {
    const result = session.enterRegion(id);
    if (!result.entered) {
      notify(`第 ${REGIONS[id].day} 个到访日解锁，不需要连续登录。`);
      return;
    }
    returnToCamp();
    closeModal();
    audio.play('travel');
    notify(`抵达${REGIONS[id].name}。${REGIONS[id].challenge}`);
  }
  function travelTo(next: WorldZone) {
    if (flight.flying) {
      closeModal();
      notify('先安全降落，再使用地面自动带路。');
      return;
    }
    if (insideTemple) exitTemple();
    setTravelPoint(null);
    setTravelTarget(next);
    setTravelRequest((n) => n + 1);
    closeModal();
    notify(`正在前往${waypointNames[regionId][zoneKeys.indexOf(next)]}，方向键可以接管。`);
  }
  function enterTemple() {
    if (flight.flying) {
      notify('先降落，再走进神庙。');
      return;
    }
    if (!nearTemple) {
      travelToPlace(REGION_PLACES[regionId][0]);
      return;
    }
    audio.play('travel');
    setInsideTemple(true);
    setTravelTarget(null);
    setTravelPoint(null);
    setNearWild(false);
    setNearTemple(false);
    closeModal();
  }
  function exitTemple() {
    setInsideTemple(false);
    setSpawnPoint({ ...TEMPLE_ENTRANCE });
    setTravelTarget(null);
    setTravelPoint(null);
    setTravelRequest(0);
    setPosition({ ...TEMPLE_ENTRANCE, heading: 0 });
    setWorldReset((n) => n + 1);
  }
  function travelToPlace(place: RegionPlace) {
    if (flight.flying) {
      closeModal();
      notify('先安全降落，再使用地面自动带路。');
      return;
    }
    if (insideTemple) exitTemple();
    setTravelTarget(null);
    setTravelPoint({ x: place.x, z: place.z });
    setTravelRequest((n) => n + 1);
    closeModal();
    notify(`正在前往${place.name}，方向键可以随时接管。`);
  }
  function claimTempleRelic() {
    const result = session.claimTemple(regionId);
    if (!result.completed) return;
    setPanel('relic');
    audio.play('reward');
  }
  function startCapture() {
    if (flight.flying) {
      notify('先降落，再和新伙伴打招呼。');
      return;
    }
    if (readyToCapture && nearWild) setPanel('capture');
    else if (readyToCapture) travelTo('ruins');
    else notify(`先找齐三枚${region.sealName}，再与${wildPet.name}建立羁绊。`);
  }
  function finishCapture() {
    const result = session.capturePet(region.petId);
    if (!result.captured) {
      closeModal();
      return;
    }
    setPanel(null);
    setReward(region.petId);
    audio.play('capture');
    setPetExcited((n) => n + 1);
  }
  function choosePet(id: PetId | null) {
    if (flight.flying) {
      notify('飞行中请先降落，再切换或休息伙伴。');
      return;
    }
    const result = session.choosePet(id);
    if (!result.chosen) {
      notify('伙伴状态已更新，请重新选择随行伙伴。');
      return;
    }
    if (id) audio.play('pet');
    notify(id ? `${PETS[id].name}会陪你一起旅行。` : '伙伴在营地休息，独自去看看吧。');
  }
  function interactWithPet() {
    if (companion) audio.play('pet');
    setPetExcited((n) => n + 1);
    notify(companion ? `${companion.name}开心地回应了你！` : '先在伙伴图鉴选择一位随行伙伴吧。');
  }
  function toggleFlight() {
    if (!sceneReady) return;
    if (flight.landing) return;
    if (!canFly && !flight.flying) {
      setPanel('journal');
      return;
    }
    setFlightRequest((n) => n + 1);
  }
  function questAction() {
    if (isMeadow) {
      if (expedition.treasureOpened) newExpedition();
      else if (nextCrystal === undefined) unlockTreasure();
      else travelTo(zoneKeys[nextCrystal]);
    } else if (owned) setPanel('map');
    else if (readyToCapture) startCapture();
    else if (nextCrystal !== undefined) travelTo(zoneKeys[nextCrystal]);
  }
  const questTitle = isMeadow
    ? expedition.treasureOpened
      ? '原野宝藏已收好'
      : '寻找原野的三束光'
    : owned
      ? `${wildPet.name}已加入队伍`
      : `寻找${wildPet.name}`;
  const questButton = isMeadow
    ? expedition.treasureOpened
      ? '再来一次原野寻宝'
      : nextCrystal === undefined
        ? '打开原野宝箱'
        : `前往${waypointNames[regionId][nextCrystal]}`
    : owned
      ? '探索其他场景'
      : readyToCapture
        ? nearWild
          ? '与伙伴建立羁绊'
          : '去祭坛寻找伙伴'
        : `前往${waypointNames[regionId][nextCrystal ?? 0]}`;

  return {
    audio,
    playSound,
    sceneId,
    sceneReady,
    reportSceneReady,
    interactWithPet,
    mode,
    progress,
    expedition,
    adventure,
    templeProgress,
    discovery,
    field,
    discoveryObjective,
    today,
    insideTemple,
    nearTemple,
    spawnPoint,
    travelPoint,
    collapsed,
    travelTarget,
    travelRequest,
    worldReset,
    flightRequest,
    flight,
    telemetry,
    setPosition,
    reportFlight,
    nearWild,
    setNearWild,
    setNearTemple,
    panel,
    setPanel,
    reward,
    petExcited,
    toast,
    storageWarning,
    regionId,
    region,
    templeTheme,
    templeVisited,
    wildPet,
    owned,
    companion,
    unlocked,
    stage,
    canFly,
    shownStage,
    isMeadow,
    seals,
    readyToCapture,
    doneToday,
    isModal,
    nextCrystal,
    RegionIcon,
    notify,
    closeModal,
    returnToCamp,
    changeMode,
    toggleTask,
    startCheckin,
    checkin,
    collect,
    investigateDiscovery,
    recordWildlife,
    recordMeadowRace,
    unlockTreasure,
    newExpedition,
    resetDemo,
    simulateTomorrow,
    enterRegion,
    travelTo,
    enterTemple,
    exitTemple,
    travelToPlace,
    claimTempleRelic,
    startCapture,
    finishCapture,
    choosePet,
    toggleFlight,
    questAction,
    questTitle,
    questButton,
  };
}
export type AdventureController = ReturnType<typeof useAdventureController>;
