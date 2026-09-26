import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { ArrowRight, CalendarCheck, Check, ChevronDown, ChevronUp, Compass, Droplets, Flame, FlaskConical, Gem, Gift, Heart, Leaf, LockKeyhole, Map, MapPin, Mountain, Navigation, PawPrint, RotateCcw, Shield, Sparkles, Star, Sun, Wind, X, Zap } from 'lucide-react';
import WorldScene from './components/WorldScene';
import TempleScene from './components/TempleScene';
import { completeTemple, createTempleProgress, loadTempleProgress, saveTempleProgress, TEMPLE_THEMES, type TempleProgress } from './game/temple';
import { REGION_PLACES, TEMPLE_ENTRANCE, type RegionPlace } from './game/landmarks';
import CompanionPortrait from './components/CompanionPortrait';
import CaptureGame from './components/CaptureGame';
import { SPAWN_POSITION, WORLD_ZONES, type WorldZone, type WorldPoint } from './game/world';
import { canPetFly, type FlightStatus } from './game/flight';
import { collectCrystal, completeMission, createExploration, createInitialProgress, getPetLevel, getPetStage, getTodayKey, loadExploration, loadProgress, openTreasure, resetExpedition, saveExploration, saveProgress, type Exploration, type Mode, type Progress } from './game';
import { advanceDemoDay, capturePet, changeRegion, collectSeal, createAdventure, getUnlockedRegions, loadAdventure, PETS, REGION_IDS, REGIONS, saveAdventure, selectCompanion, visitAdventure, type Adventure, type PetId, type RegionId } from './game/adventure';

type Panel = 'checkin' | 'journal' | 'guide' | 'treasure' | 'map' | 'capture' | 'relic' | null;
const zoneKeys: WorldZone[] = ['ruins','grove','shore'];
const waypointNames: Record<RegionId, string[]> = {
  meadow:['风语遗迹','萤火森林','镜蓝湖畔'], water:['潮汐祭坛','珊瑚花园','珍珠海湾'],
  fire:['熔火祭坛','余烬石林','流焰湖畔'], earth:['大地祭坛','岩柱峡谷','琥珀河岸'],
  steel:['动力核心','齿轮工坊','镜钢水库'], fairy:['月辉祭坛','蘑菇花林','星露湖畔'],
};
const elementIcons = {meadow:Leaf,water:Droplets,fire:Flame,earth:Mountain,steel:Shield,fairy:Sparkles};
const uniqueId = () => `${Date.now()}-${Math.random().toString(36).slice(2,10)}`;

export default function App() {
  const [mode,setMode] = useState<Mode>(()=>new URLSearchParams(window.location.search).get('mode')==='demo'?'demo':'real');
  const [progress,setProgress] = useState<Progress>(()=>loadProgress(mode));
  const [expedition,setExpedition] = useState<Exploration>(()=>loadExploration(mode));
  const [adventure,setAdventure] = useState<Adventure>(()=>loadAdventure(mode,progress));
  const adventureRef = useRef(adventure);
  const [templeProgress,setTempleProgress] = useState(()=>loadTempleProgress(mode));
  const [insideTemple,setInsideTemple] = useState(false);
  const [nearTemple,setNearTemple] = useState(false);
  const [spawnPoint,setSpawnPoint] = useState<WorldPoint|undefined>();
  const [travelPoint,setTravelPoint] = useState<WorldPoint|null>(null);
  const [today,setToday] = useState(getTodayKey);
  const [collapsed,setCollapsed] = useState(()=>{try{return localStorage.getItem('lumen.taskCollapsed')!=='false';}catch{return true;}});
  const [travelTarget,setTravelTarget] = useState<WorldZone|null>(null);
  const [travelRequest,setTravelRequest] = useState(0);
  const [worldReset,setWorldReset] = useState(0);
  const [flightRequest,setFlightRequest] = useState(0);
  const [flight,setFlight] = useState<FlightStatus>({flying:false,landing:false,altitude:0});
  const [position,setPosition] = useState({...SPAWN_POSITION,heading:0});
  const [nearWild,setNearWild] = useState(false);
  const [panel,setPanel] = useState<Panel>(null);
  const [reward,setReward] = useState<'checkin'|PetId|null>(null);
  const [petExcited,setPetExcited] = useState(0);
  const [toast,setToast] = useState('');
  const [storageWarning,setStorageWarning] = useState(false);
  const missionId = useRef('');
  const toastTimer = useRef<ReturnType<typeof setTimeout>|undefined>(undefined);
  const modalRef = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement|null>(null);
  const volatileProgress = useRef<Partial<Record<Mode,Progress>>>({});
  const volatileExploration = useRef<Partial<Record<Mode,Exploration>>>({});
  const volatileTemple = useRef<Partial<Record<Mode,TempleProgress>>>({});
  const volatileAdventure = useRef<Partial<Record<Mode,Adventure>>>({});
  const regionId = adventure.currentRegion;
  const region = REGIONS[regionId];
  const templeTheme = TEMPLE_THEMES[regionId];
  const templeVisited = templeProgress.completed.includes(regionId);
  const wildPet = PETS[region.petId];
  const owned = adventure.capturedPets.includes(region.petId);
  const companion = adventure.activePet ? PETS[adventure.activePet] : null;
  const unlocked = getUnlockedRegions(adventure);
  const stage = getPetStage(progress);
  const canFly = canPetFly(adventure.activePet,stage);
  const shownStage = Math.max(1,stage) as 1|2|3;
  const isMeadow = regionId==='meadow';
  const seals = isMeadow ? expedition.crystals : adventure.seals[regionId];
  const readyToCapture = !owned && seals.length===3;
  const doneToday = mode==='real'&&progress.completedDates.includes(today);
  const isModal = panel!==null||reward!==null;
  const nextCrystal = [0,1,2].find(id=>!seals.includes(id));
  const nearest = zoneKeys.findIndex(key=>Math.hypot(position.x-WORLD_ZONES[key].x,position.z-WORLD_ZONES[key].z)<11);
  const nearbyPlace = REGION_PLACES[regionId].find(place=>Math.hypot(position.x-place.x,position.z-place.z)<8);
  const locationName = nearbyPlace?.name || (nearest>=0 ? waypointNames[regionId][nearest] : region.name);
  const RegionIcon = elementIcons[regionId];
  const notify = (message:string)=>{setToast(message);clearTimeout(toastTimer.current);toastTimer.current=setTimeout(()=>setToast(''),4500);};
  const closeModal = ()=>{setPanel(null);setReward(null);};

  function persistTemple(value:TempleProgress){
    setTempleProgress(value);
    if(!saveTempleProgress(value.mode,value)){volatileTemple.current[value.mode]=value;setStorageWarning(true);}else delete volatileTemple.current[value.mode];
  }
  function persistAdventure(value:Adventure) {
    adventureRef.current=value; setAdventure(value);
    if(!saveAdventure(value.mode,value)){volatileAdventure.current[value.mode]=value;setStorageWarning(true);}else delete volatileAdventure.current[value.mode];
  }
  function persistProgress(value:Progress) {
    setProgress(value);
    if(!saveProgress(value.mode,value)){volatileProgress.current[value.mode]=value;setStorageWarning(true);}else delete volatileProgress.current[value.mode];
  }
  function persistExpedition(value:Exploration) {
    setExpedition(value);
    if(!saveExploration(value.mode,value)){volatileExploration.current[value.mode]=value;setStorageWarning(true);}else delete volatileExploration.current[value.mode];
  }
  useEffect(()=>{
    persistAdventure(adventureRef.current);
    const refresh=()=>{
      const currentProgress=volatileProgress.current[mode]||loadProgress(mode);
      setToday(getTodayKey());setProgress(currentProgress);
      setExpedition(volatileExploration.current[mode]||loadExploration(mode));
      setTempleProgress(volatileTemple.current[mode]||loadTempleProgress(mode));
      persistAdventure(volatileAdventure.current[mode]?visitAdventure(volatileAdventure.current[mode]!,currentProgress):loadAdventure(mode,currentProgress));
    };
    const timer=setInterval(refresh,60000);
    window.addEventListener('storage',refresh);window.addEventListener('focus',refresh);
    return()=>{clearInterval(timer);window.removeEventListener('storage',refresh);window.removeEventListener('focus',refresh);};
  },[mode]);
  useEffect(()=>()=>clearTimeout(toastTimer.current),[]);
  useEffect(()=>{
    if(!isModal)return;
    previousFocus.current=document.activeElement as HTMLElement;
    const overflow=document.body.style.overflow;document.body.style.overflow='hidden';
    return()=>{document.body.style.overflow=overflow;previousFocus.current?.focus();};
  },[isModal]);
  useEffect(()=>{
    if(!isModal)return;
    modalRef.current?.scrollTo({top:0});
    const id=setTimeout(()=>modalRef.current?.querySelector<HTMLElement>('button')?.focus(),20);
    return()=>clearTimeout(id);
  },[isModal,panel,reward]);
  useEffect(()=>{
    if(!isModal)return;
    const onKey=(event:KeyboardEvent)=>{
      if(event.key==='Escape')closeModal();
      if(event.key!=='Tab')return;
      const items=modalRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled),[tabindex="0"]');
      if(!items?.length)return;
      const first=items[0],last=items[items.length-1];
      if(!modalRef.current?.contains(document.activeElement)){event.preventDefault();first.focus();}
      else if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
    };
    window.addEventListener('keydown',onKey);return()=>window.removeEventListener('keydown',onKey);
  },[isModal]);

  function returnToCamp(){setInsideTemple(false);setNearTemple(false);setSpawnPoint(undefined);setTravelPoint(null);setTravelTarget(null);setTravelRequest(0);setNearWild(false);setFlightRequest(0);setFlight({flying:false,landing:false,altitude:0});setPosition({...SPAWN_POSITION,heading:0});setWorldReset(n=>n+1);}
  function changeMode(next:Mode){
    const url=new URL(window.location.href);if(next==='demo')url.searchParams.set('mode','demo');else url.searchParams.delete('mode');window.history.replaceState(null,'',url);
    const nextProgress=volatileProgress.current[next]||loadProgress(next);
    setMode(next);setProgress(nextProgress);setTempleProgress(volatileTemple.current[next]||loadTempleProgress(next));setExpedition(volatileExploration.current[next]||loadExploration(next));
    persistAdventure(volatileAdventure.current[next]?visitAdventure(volatileAdventure.current[next]!,nextProgress):loadAdventure(next,nextProgress));
    returnToCamp();closeModal();notify(next==='demo'?'演示世界独立保存，可以模拟明天解锁新场景。':'已回到真实旅程，打卡和伙伴都在。');
  }
  function toggleTask(){setCollapsed(current=>{try{localStorage.setItem('lumen.taskCollapsed',String(!current));}catch{/* Optional UI preference. */}return !current;});}
  function startCheckin(){missionId.current=mode==='real'?`daily-${getTodayKey()}`:`demo-${uniqueId()}`;setPanel('checkin');}
  function checkin(quick=false){
    if(quick&&mode!=='demo')return;
    const current=volatileProgress.current[mode]||loadProgress(mode);
    const result=completeMission(current,quick?`demo-${uniqueId()}`:missionId.current);
    setToday(getTodayKey());
    if(!result.rewarded){setProgress(result.progress);closeModal();notify('今天已经打卡啦，去和伙伴探索新风景吧。');return;}
    persistProgress(result.progress);setPanel(null);setReward('checkin');setPetExcited(n=>n+1);
  }
  function collect(id:number){
    if(id!==0&&id!==1&&id!==2)return;
    if(isMeadow){
      const current=volatileExploration.current[mode]||loadExploration(mode),result=collectCrystal(current,id);
      if(!result.collected)return;persistExpedition(result.state);
      notify(result.state.crystals.length===3?'三枚光晶齐了，可以打开原野宝箱！':`发现光晶 ${result.state.crystals.length} / 3`);
    }else{
      const result=collectSeal(adventureRef.current,id);if(!result.collected)return;persistAdventure(result.state);
      notify(result.state.seals[regionId].length===3?`三枚${region.sealName}集齐了！去祭坛寻找${wildPet.name}。`:`找到${region.sealName} ${result.state.seals[regionId].length} / 3`);
    }
  }
  function unlockTreasure(){
    const result=openTreasure(volatileExploration.current[mode]||loadExploration(mode));if(!result.opened)return;
    persistExpedition(result.state);setPetExcited(n=>n+1);setPanel('treasure');
  }
  function newExpedition(){persistExpedition(resetExpedition(volatileExploration.current[mode]||loadExploration(mode)));returnToCamp();closeModal();notify('已回到营地，开始新一轮原野寻宝。');}
  function resetDemo(){
    if(mode!=='demo')return;
    const fresh=createInitialProgress('demo');persistTemple(createTempleProgress('demo'));persistProgress(fresh);persistExpedition(createExploration('demo'));persistAdventure(visitAdventure(createAdventure('demo',fresh),fresh));
    returnToCamp();closeModal();notify('演示已重置，真实旅程不变。');
  }
  function simulateTomorrow(){
    const next=advanceDemoDay(adventureRef.current);persistAdventure(next);setPanel('map');
    notify(getUnlockedRegions(next).length>unlocked.length?`新的旅行地已解锁：${REGIONS[getUnlockedRegions(next).at(-1)!].name}`:'六个场景已经全部解锁，去收集所有伙伴吧。');
  }
  function enterRegion(id:RegionId){
    const next=changeRegion(adventureRef.current,id);
    if(next.currentRegion!==id){notify(`第 ${REGIONS[id].day} 个到访日解锁，不需要连续登录。`);return;}
    persistAdventure(next);returnToCamp();closeModal();notify(`抵达${REGIONS[id].name}。${REGIONS[id].challenge}`);
  }
  function travelTo(next:WorldZone){if(flight.flying){closeModal();notify('先安全降落，再使用地面自动带路。');return;}if(insideTemple)exitTemple();setTravelPoint(null);setTravelTarget(next);setTravelRequest(n=>n+1);closeModal();notify(`正在前往${waypointNames[regionId][zoneKeys.indexOf(next)]}，方向键可以接管。`);}
  function enterTemple(){
    if(flight.flying){notify('先降落，再走进神庙。');return;}
    if(!nearTemple){travelToPlace(REGION_PLACES[regionId][0]);return;}
    setInsideTemple(true);setTravelTarget(null);setTravelPoint(null);setNearWild(false);setNearTemple(false);closeModal();
  }
  function exitTemple(){
    setInsideTemple(false);setSpawnPoint({...TEMPLE_ENTRANCE});setTravelTarget(null);setTravelPoint(null);setTravelRequest(0);setPosition({...TEMPLE_ENTRANCE,heading:0});setWorldReset(n=>n+1);
  }
  function travelToPlace(place:RegionPlace){
    if(flight.flying){closeModal();notify('先安全降落，再使用地面自动带路。');return;}
    if(insideTemple)exitTemple();
    setTravelTarget(null);setTravelPoint({x:place.x,z:place.z});setTravelRequest(n=>n+1);closeModal();notify(`正在前往${place.name}，方向键可以随时接管。`);
  }
  function claimTempleRelic(){
    const result=completeTemple(volatileTemple.current[mode]||loadTempleProgress(mode),regionId);
    if(!result.completed)return;
    persistTemple(result.state);setPanel('relic');
  }
  function startCapture(){if(flight.flying){notify('先降落，再和新伙伴打招呼。');return;}if(readyToCapture&&nearWild)setPanel('capture');else if(readyToCapture)travelTo('ruins');else notify(`先找齐三枚${region.sealName}，再与${wildPet.name}建立羁绊。`);}
  function finishCapture(){
    const result=capturePet(adventureRef.current,region.petId);if(!result.captured){closeModal();return;}
    persistAdventure(result.state);setPanel(null);setReward(region.petId);setPetExcited(n=>n+1);
  }
  function choosePet(id:PetId|null){if(flight.flying){notify('飞行中请先降落，再切换或休息伙伴。');return;}persistAdventure(selectCompanion(adventureRef.current,id));notify(id?`${PETS[id].name}会陪你一起旅行。`:'伙伴在营地休息，独自去看看吧。');}
  function toggleFlight(){if(flight.landing)return;if(!canFly&&!flight.flying){setPanel('journal');return;}setFlightRequest(n=>n+1);}
  function questAction(){
    if(isMeadow){if(expedition.treasureOpened)newExpedition();else if(nextCrystal===undefined)unlockTreasure();else travelTo(zoneKeys[nextCrystal]);}
    else if(owned)setPanel('map');else if(readyToCapture)startCapture();else if(nextCrystal!==undefined)travelTo(zoneKeys[nextCrystal]);
  }
  const questTitle=isMeadow?(expedition.treasureOpened?'原野宝藏已收好':'寻找原野的三束光'):owned?`${wildPet.name}已加入队伍`:`寻找${wildPet.name}`;
  const questButton=isMeadow?(expedition.treasureOpened?'再来一次原野寻宝':nextCrystal===undefined?'打开原野宝箱':`前往${waypointNames[regionId][nextCrystal]}`):owned?'探索其他场景':readyToCapture?(nearWild?'与伙伴建立羁绊':'去祭坛寻找伙伴'):`前往${waypointNames[regionId][nextCrystal??0]}`;

  function WorldMap(){return <svg className="world-map" viewBox="0 0 200 200" aria-label="当前场景地图，显示主人公、符印地点与地区景观">
    <rect width="200" height="200" fill={region.color}/><path d="M0 0h200v39l-30-14-34 18-40-20-33 16-35-9L0 50Z" fill="#ffffff25"/><path d="M162 66c28 5 29 45 10 62-13 11-34 2-37-15-4-24 8-48 27-47Z" fill="#c8f0fa85"/>
    <path d="M100 190q-9-39 1-64T88 67m12 60q-25-7-42-23m44 20 43-13" fill="none" stroke="#fff1c0" strokeWidth="5" strokeLinecap="round"/>
    {zoneKeys.map((key,i)=><circle key={key} cx={100+WORLD_ZONES[key].x*1.55} cy={105+WORLD_ZONES[key].z*1.5} r="6" fill={seals.includes(i)?'#fff4d1':'#d6ffed'} stroke="#486757" strokeWidth="2"/>)}
    {REGION_PLACES[regionId].slice(1).map(place=><rect key={place.id} x={96+place.x*1.55} y={101+place.z*1.5} width="8" height="8" rx="2" fill="#fff2cb" stroke="#687266" strokeWidth="1.4"/>)}
    <g transform={`translate(${100+Math.max(-55,Math.min(55,position.x))*1.55},${105+Math.max(-60,Math.min(55,position.z))*1.5}) rotate(${position.heading*180/Math.PI})`}><circle r="9" fill="#fff" opacity=".45"/><path d="m0-7 5 12-5-3-5 3Z" fill="#fff9dc" stroke="#365653" strokeWidth="1.5"/></g>
  </svg>;}

  return <div className={`game-shell ${insideTemple?'inside-temple':''}`} style={{'--region-color':region.color} as CSSProperties}>
    <main className="world-stage" inert={isModal}>{insideTemple?<TempleScene key={`${mode}-${regionId}`} region={regionId} stage={shownStage} companionId={adventure.activePet} paused={isModal} completed={templeVisited} onComplete={claimTempleRelic} onExit={exitTemple}/>:<WorldScene key={`${mode}-${regionId}-${worldReset}`} region={regionId} spawnPoint={spawnPoint} travelPoint={travelPoint} onNearTemple={setNearTemple} onEnterTemple={enterTemple} templeVisited={templeVisited} companionId={adventure.activePet} wildPetId={owned?null:region.petId} canCapture={readyToCapture} onNearWild={setNearWild} onCaptureRequest={startCapture} stage={shownStage} collectedCrystals={seals} onCollectCrystal={collect} onPetInteract={()=>{setPetExcited(n=>n+1);notify(companion?`${companion.name}开心地回应了你！`:'先在伙伴图鉴选择一位随行伙伴吧。');}} petExcited={petExcited} treasureOpened={isMeadow?expedition.treasureOpened:owned} onExplore={()=>{}} travelTarget={travelTarget} travelRequest={travelRequest} onPosition={setPosition} paused={isModal} flightRequest={flightRequest} onFlightState={setFlight} onFlightMessage={notify}/>}</main>
    <div className="hud-vignette"/>
    {insideTemple&&<div className="temple-quick-menu" inert={isModal}><button aria-label="室内打开伙伴图鉴" onClick={()=>setPanel('journal')}><PawPrint size={19}/><span>伙伴</span></button><button aria-label="室内打开旅行地图" onClick={()=>setPanel('map')}><Map size={19}/><span>地图</span></button></div>}
    <header className="hud-header" inert={isModal}>
      <a className="brand" href="#" aria-label="曙光旷野首页"><span className="brand-seal"><Sun size={29} strokeWidth={1.3}/></span><span>曙光旷野<small>LUMEN WILDS</small></span></a>
      <nav className="top-nav" aria-label="游戏导航"><span className="nav-active"><Compass size={15}/>自由探索</span><button onClick={()=>setPanel('journal')}><PawPrint size={15}/>我的伙伴</button><button onClick={()=>setPanel('map')}><Map size={15}/>旅行地图 <b>{unlocked.length}/6</b></button></nav>
      <div className="header-actions"><span className="star-wallet"><Star size={15} fill="currentColor"/>{expedition.stars}</span><button className={`checkin-entry ${doneToday?'checked':''}`} onClick={doneToday?()=>notify('今天已经打卡，伙伴的成长能量已收好。'):startCheckin}>{doneToday?<Check size={17}/>:<CalendarCheck size={17}/>}<span>{doneToday?'今日已打卡':'今日打卡'}</span>{!doneToday&&<i/>}</button><button className="icon-button help-button" aria-label="玩法帮助" onClick={()=>setPanel('guide')}>?</button></div>
    </header>
    <section className="world-title" inert={isModal}><div className="region-kicker"><span/> CHAPTER {String(region.day).padStart(2,'0')} · {region.element}之旅</div><h1>{region.name}</h1><p>{region.description}</p><button className="travel-entry" onClick={()=>setPanel('map')}><RegionIcon size={13}/>{unlocked.length} / 6 场景已解锁 <ChevronDown size={12}/></button><button className="temple-discover" onClick={enterTemple}><Compass size={13}/>{templeVisited?`重访${templeTheme.name}`:`探索${templeTheme.name}`}<ArrowRight size={12}/></button></section>
    <aside className={`adventure-objective ${collapsed?'is-collapsed':''}`} inert={isModal}>
      <button className="quest-toggle" aria-expanded={!collapsed} aria-controls="quest-details" onClick={toggleTask}><span className="quest-glyph"><Compass size={21}/></span><span className="quest-toggle-copy"><span className="small-kicker">当前探索 · {seals.length} / 3</span><strong>{questTitle}</strong></span>{collapsed?<ChevronDown size={16}/>:<ChevronUp size={16}/>}<span className="sr-only">{collapsed?'展开任务面板':'收起任务面板'}</span></button>
      {!collapsed&&<div id="quest-details"><p>{isMeadow?'探索三个地点，收集光晶并发现宝藏。':owned?'你们的故事才刚刚开始，带它去新的风景。':region.challenge}</p><div className="crystal-progress">{zoneKeys.map((key,id)=><button key={key} className={`crystal-waypoint crystal-${id} ${seals.includes(id)?'collected':''}`} aria-label={`前往${waypointNames[regionId][id]}`} onClick={()=>travelTo(key)}><span>{seals.includes(id)?<Check size={15}/>:<Gem size={15}/>}</span><small>{['祭坛','林地','湖畔'][id]}</small></button>)}<span className="crystal-count"><b>{seals.length}</b>/3</span></div><button className="quest-action" onClick={questAction}>{questButton}<ArrowRight size={16}/></button><div className="quest-prize">{isMeadow?<><Gift size={11}/>藏品 · 3 星砂</>:<><PawPrint size={11}/>{wildPet.element}属性伙伴 · {wildPet.name}</>}</div></div>}
    </aside>
    <div className="companion-hud" inert={isModal}><button className="companion-avatar" aria-label="选择随行伙伴" onClick={()=>setPanel('journal')}>{companion?<CompanionPortrait petId={companion.id} stage={companion.id==='ember'?shownStage:1}/>:<PawPrint size={30}/>}<span><Heart size={10} fill="currentColor"/></span></button><button className="companion-summary" onClick={()=>setPanel('journal')}><div><b>{companion?.name||'独自探索'}</b><span>{companion?`${companion.element} · 随行`:'选择伙伴'}</span></div><p>冒险者 Lv.{Math.max(1,getPetLevel(progress))} · 已结识 {adventure.capturedPets.length} / 6 位伙伴</p><div className="xp-track"><span style={{width:`${progress.xp%120/120*100}%`}}/></div><small>切换伙伴 <ChevronDown size={9}/></small></button></div>
    <div className="minimap-hud" inert={isModal}><button className="minimap-button" aria-label="打开旅行地图" onClick={()=>setPanel('map')}><WorldMap/><span className="map-north">N</span><span className="map-expand"><Map size={13}/></span></button><span className="map-location"><MapPin size={11}/>{locationName}</span></div>
    <div className={`flight-hud ${flight.flying?'airborne':''}`} inert={isModal}><button className="flight-toggle" onClick={toggleFlight} disabled={flight.landing} aria-label={flight.landing?'正在安全降落':flight.flying?'安全降落':canFly?'骑乘起飞':'选择飞行伙伴'}><Wind size={18}/><span>{flight.landing?'正在降落':flight.flying?'安全降落':canFly?'骑乘起飞':'选择飞行伙伴'}</span>{canFly&&!flight.landing&&<kbd>F</kbd>}</button>{flight.flying?<><div className="flight-altitude"><span>离地高度</span><b>{Math.round(flight.altitude)} <small>m</small></b></div><p>{flight.landing?'正在寻找并降落到附近空地':'空格上升 · Shift / Ctrl 下降'}</p></>:<p>{canFly?`${companion?.name}准备好带你翱翔了`:'星翼烁牙 / 绮露可骑乘飞行'}</p>}</div>
    <div className="movement-help"><span><kbd>W A S D</kbd> {flight.flying?'飞行方向':'移动主人公'}</span><i/><span><kbd>空格</kbd> {flight.flying?'上升':'跳跃'}</span><i/><span>{flight.flying?'Shift / Ctrl 下降 · F 降落':'拖拽视角 · 点击地面前往'}</span></div>
    <div className="world-tools" inert={isModal}><button aria-label="我的伙伴" onClick={()=>setPanel('journal')}><PawPrint size={18}/></button><button aria-label="旅行地图" onClick={()=>setPanel('map')}><Map size={18}/></button></div>
    <div className={`mode-toolbar ${mode==='demo'?'demo':''}`} inert={isModal}><button onClick={()=>changeMode(mode==='real'?'demo':'real')}><FlaskConical size={12}/>{mode==='demo'?'演示世界 · 返回真实':'进入演示世界'}</button>{mode==='demo'&&<><button onClick={simulateTomorrow}>模拟明天 <Sun size={11}/></button><button onClick={()=>checkin(true)}>模拟打卡 <b>+40</b></button><button aria-label="重置演示进度" onClick={resetDemo}><RotateCcw size={12}/></button></>}</div>
    {storageWarning&&<div className="storage-warning">浏览器暂时无法保存进度，请保持此页面开启。</div>}
    {toast&&<div className="toast" role="status"><Sparkles size={17}/>{toast}</div>}
    {isModal&&<div className="modal-backdrop" onClick={e=>{if(e.target===e.currentTarget)closeModal();}}><div className={`modal ${reward||panel==='checkin'||panel==='treasure'||panel==='capture'||panel==='relic'?'reward-modal':''} ${panel==='map'?'travel-modal':''}`} role="dialog" aria-modal="true" aria-label={reward?'冒险奖励':panel==='checkin'?'确认今日打卡':panel==='journal'?'我的伙伴':panel==='map'?'旅行地图':panel==='capture'?'建立羁绊':panel==='treasure'?'发现宝藏':panel==='relic'?'发现神庙遗物':'玩法帮助'} ref={modalRef}>
      <button className="modal-close" aria-label="关闭窗口" onClick={closeModal}><X size={20}/></button>
      {panel==='checkin'&&<div className="checkin-dialog"><div className="completion-emblem"><CalendarCheck size={35}/></div><div className="eyebrow">A LITTLE EFFORT, A LITTLE MAGIC</div><h2>今天的学习，完成啦！</h2><p>在你平时学习的地方完成后，<br/>来这里记下今天的坚持。</p><div className="checkin-reward-preview"><CompanionPortrait petId="ember" stage={shownStage}/><div><b>给主人公和伙伴的成长能量</b><span><Zap size={14}/>40 XP · 烁牙会逐渐进化</span></div></div><button className="primary" onClick={()=>checkin()}>我已完成学习，确认打卡<Check size={18}/></button><small>{mode==='demo'?'演示打卡，不计入真实记录':'每天一次 · 由孩子或家长确认完成'}</small></div>}
      {reward&&<div className="reward-content"><div className="reward-sparkles">✧ <span>✦</span> ✧</div><div className="reward-pet"><CompanionPortrait petId={reward==='checkin'?'ember':reward} stage={reward==='checkin'?shownStage:1}/></div><div className="eyebrow">{reward==='checkin'?'ONE MORE DAY, ONE MORE ADVENTURE':'WELCOME TO THE TEAM'}</div><h2>{reward==='checkin'?'打卡成功，又成长了一点！':`${PETS[reward].name}加入了队伍！`}</h2><p>{reward==='checkin'?'每一次坚持，都成为下一场冒险的勇气。':PETS[reward].ability}</p><span className="reward-xp">{reward==='checkin'?<><Zap size={16}/>+40 成长能量</>:<><Heart size={16}/>新伙伴已永久收录</>}</span><button className="primary" onClick={()=>{if(reward!=='checkin')choosePet(reward);closeModal();}}>{reward==='checkin'?'回到冒险':'带上它，一起出发'}<ArrowRight size={17}/></button>{reward!=='checkin'&&<button className="text-action" onClick={closeModal}>先让它在营地休息</button>}</div>}
      {panel==='relic'&&<div className="temple-reward"><div className="artifact-emblem" style={{'--artifact-color':templeTheme.color} as CSSProperties}><Gem size={60} strokeWidth={1}/><i/><i/></div><div className="eyebrow">A MEMORY OF THE ANCIENT WORLD</div><h2>发现了{templeTheme.artifact}</h2><p>{templeTheme.story}</p><span className="reward-xp"><Check size={16}/>神庙遗物 · 已收藏 {templeProgress.completed.length} / 6</span><button className="primary" onClick={closeModal}>继续探索<ArrowRight size={16}/></button><button className="text-action" onClick={()=>setPanel('journal')}>查看我的收藏</button></div>}
      {panel==='capture'&&<CaptureGame key={region.petId} petId={region.petId} onComplete={finishCapture}/>}
      {panel==='treasure'&&<div className="treasure-dialog"><div className="relic-emblem"><Compass size={65}/></div><div className="eyebrow">A SECRET OF THE MEADOW</div><h2>又发现一份原野宝藏！</h2><p>星砂在掌心闪闪发光。下一位伙伴，正在远方等你。</p><span className="reward-xp"><Star size={17}/>+3 星砂 · 累计 {expedition.totalTreasures} 份宝藏</span><button className="primary" onClick={()=>setPanel('map')}>看看下一站<ArrowRight size={17}/></button><button className="text-action" onClick={newExpedition}>再来一次原野寻宝<RotateCcw size={13}/></button></div>}
      {panel==='journal'&&<div className="journal"><div className="eyebrow">YOUR TRAVELLING COMPANIONS</div><h2>每一段旅程，都有新朋友。</h2><p>控制人类主人公旅行，选择一位已捕获的伙伴随行。</p><div className="journal-stats"><div><b>{adventure.capturedPets.length}/6</b><span>已结识伙伴</span></div><div><b>{unlocked.length}/6</b><span>已解锁场景</span></div><div><b>{progress.totalMissions}</b><span>累计打卡</span></div></div><div className="pet-collection">{REGION_IDS.map(id=>{const pet=PETS[REGIONS[id].petId],caught=adventure.capturedPets.includes(pet.id),active=adventure.activePet===pet.id;return <article key={id} className={`pet-card ${caught?'caught':'undiscovered'} ${active?'active':''}`} style={{'--pet-color':pet.color} as CSSProperties}><div className="pet-card-art"><CompanionPortrait petId={pet.id} stage={pet.id==='ember'?shownStage:1}/><span className="element-badge">{pet.element}</span>{!caught&&<LockKeyhole className="pet-lock" size={18}/>}</div><div className="pet-card-info"><h3>{pet.name}{active&&<span>随行中</span>}</h3><p>{pet.description}</p><span className="pet-flight-badge">{pet.id==='ember'?<><Wind size={11}/>{stage===3?'星翼已觉醒 · 可骑乘飞行':'累计打卡 6 次解锁飞行'}</>:pet.id==='lumi'?<><Wind size={11}/>天生星翼 · 可骑乘飞行</>:null}</span><small>{REGIONS[id].name} · {caught?'已结识':`第 ${REGIONS[id].day} 个到访日解锁`}</small><button disabled={active||(caught&&flight.flying)} className={active?'selected':''} onClick={()=>caught?choosePet(pet.id):setPanel('map')}>{active?<><Check size={13}/>正在随行</>:caught?'选择随行':'前往发现'}</button></div></article>;})}</div><p className="journal-note">烁牙随累计打卡 3 / 6 次解锁晶甲与星翼。星翼烁牙和绮露可以载你飞行。飞行中先降落，再切换伙伴。</p><button className="text-action" disabled={flight.flying} onClick={()=>choosePet(null)}>{adventure.activePet?'让伙伴休息，独自探索':'当前独自探索'}</button><section className="artifact-collection"><div><h3>秘境遗物</h3><span>{templeProgress.completed.length} / 6 已发现</span></div><p>走入各地区神庙，解开光印机关，带回属于这片土地的记忆。</p><div className="artifact-grid">{REGION_IDS.map(id=>{const t=TEMPLE_THEMES[id],found=templeProgress.completed.includes(id);return <article key={id} className={found?'found':''} style={{'--artifact-color':t.color} as CSSProperties}><span>{found?<Gem size={23}/>:<LockKeyhole size={18}/>}</span><b>{found?t.artifact:'尚未发现'}</b><small>{t.name}</small></article>;})}</div></section><button className="primary journal-return" onClick={closeModal}>回到旅行<ArrowRight size={17}/></button></div>}
      {panel==='map'&&<div className="travel-atlas"><div className="eyebrow">SIX WORLDS, SIX NEW STORIES</div><h2>下一站，会遇见谁？</h2><p>每天首次进入，解锁下一片风景。不用连续登录，已解锁的场景一直保留。</p><div className="travel-progress"><CalendarCheck size={17}/><span>已开启 <b>{unlocked.length}</b> / 6 个场景</span><small>{unlocked.length===6?'完整旅图已点亮':'明天再来，发现下一站'}</small></div><div className="region-grid">{REGION_IDS.map(id=>{const item=REGIONS[id],pet=PETS[item.petId],Icon=elementIcons[id],available=unlocked.includes(id),current=regionId===id,caught=adventure.capturedPets.includes(pet.id);return <button key={id} className={`region-card region-${id} ${available?'available':'locked'} ${current?'current':''}`} disabled={!available} onClick={()=>enterRegion(id)} style={{'--scene-accent':item.color} as CSSProperties}><div className="region-card-scene"><span className="scene-moon"/><span className="scene-hill one"/><span className="scene-hill two"/><Icon size={35} strokeWidth={1.2}/><CompanionPortrait petId={pet.id} stage={pet.id==='ember'?shownStage:1}/><span className="region-day">DAY {String(item.day).padStart(2,'0')}</span>{!available&&<span className="scene-lock"><LockKeyhole size={19}/></span>}</div><div className="region-card-text"><span className="element-badge">{item.element}属性</span><h3>{item.name}</h3><p>{available?`当地伙伴 · ${pet.name}`:`第 ${item.day} 个到访日开启`}</p><span className="region-status">{!available?'等待下一次到访':current?'正在探索':caught?'重访 · 伙伴已结识':'进入探索'}{available?<ArrowRight size={14}/>:<LockKeyhole size={12}/>}</span></div></button>;})}</div>{mode==='demo'&&<button className="primary demo-next-day" disabled={unlocked.length===6} onClick={simulateTomorrow}><Sun size={17}/>{unlocked.length===6?'全部场景已解锁':'模拟明天 · 解锁下一片场景'}</button>}<div className="current-waypoints"><h3>当前场景 · {region.name}</h3><div className="map-destinations">{zoneKeys.map((key,i)=><button key={key} onClick={()=>travelTo(key)}><Gem size={18}/><b>{waypointNames[regionId][i]}</b><small>{seals.includes(i)?'已探索':'带我前往'}<ArrowRight size={11}/></small></button>)}</div><h3 className="landmark-list-heading">建筑与自然奇观</h3><div className="landmark-list">{REGION_PLACES[regionId].map(place=><button key={place.id} onClick={()=>travelToPlace(place)}><span>{place.kind==='temple'?<Compass size={21}/>:place.kind==='waterfall'||place.kind==='spring'?<Droplets size={21}/>:<Mountain size={21}/>}</span><div><b>{place.name}{place.kind==='temple'&&<em>{templeVisited?'遗物已收藏':'可进入探索'}</em>}</b><p>{place.description}</p></div><ArrowRight size={15}/></button>)}</div></div></div>}
      {panel==='guide'&&<div className="guide"><div className="eyebrow">YOUR JOURNEY STARTS HERE</div><h2>你是冒险者，伙伴在身旁。</h2><div className="guide-item"><Navigation/><div><b>自由移动，带上伙伴</b><p>WASD 或方向键控制主人公，空格跳跃，拖拽镜头。也可以点击地面或使用手机摇杆。点击左下角头像选择随行宠物。</p></div></div><div className="guide-item"><Wind/><div><b>骑上星翼，飞过山湖</b><p>让星翼形态烁牙（累计打卡 6 次）或已捕获的绮露随行，点击“骑乘起飞”或按 F。WASD 控制方向，空格上升，Shift / Ctrl 下降，再按 F 自动寻找空地降落。手机使用摇杆和升降按钮。飞行中需落地才能拾取符印或结识宠物。</p></div></div><div className="guide-item"><Map/><div><b>每天打开，发现新的世界</b><p>六个到访日依次开启原野、水、火、土、钢、妖精场景。不必连续，不会因为漏一天失去进度。旅行地图中可重访所有已解锁场景。</p></div></div><div className="guide-item"><Heart/><div><b>探索、结识、一起出发</b><p>新场景中先收集三个属性符印，再去祭坛接近野生宠物。光点进入绿色区域时点击安抚，成功三次即可捕获。失误可重试，也可放慢光点。</p></div></div><div className="guide-item"><Compass/><div><b>寻访奇观，进入神庙</b><p>旅行地图的景点列表可以带路到村庄、瀑布、冰川和遗迹。在神庙门前按 E 或点击进入，按碑文顺序点亮三座光印，再走进殿堂深处领取地区遗物。殿内点击光印名字可自动带路，走近后按 E 交互。每区遗物会永久收入伙伴页的收藏。</p></div></div><div className="guide-item"><CalendarCheck/><div><b>学习在别处，打卡在这里</b><p>完成学习后确认打卡，每天获得 40 XP，让烁牙逐渐进化。到访解锁和学习打卡各自记录。演示世界可模拟明天，真实进度独立保存。</p></div></div><div className="guide-item"><Shield/><div><b>保存你的旅程</b><p>进度保存在当前浏览器，刷新不会丢失。清除浏览器数据会清空本地存档。任务条可以随时收起或展开。</p></div></div><button className="primary" onClick={closeModal}>出发吧<ArrowRight size={17}/></button></div>}
    </div></div>}
  </div>;
}
