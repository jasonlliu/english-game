import { Compass, FlaskConical, Map, PawPrint, RotateCcw, Sparkles, Sun } from 'lucide-react';
import { type CSSProperties } from 'react';
import type { AdventureController } from '../../app/useAdventureController';
import { IndoorScene, OutdoorScene } from '../../loading/SceneHost';

import DialogHost from '../../features/dialogs/DialogHost';
import ModalShell from '../../features/dialogs/ModalShell';

import CompanionHud from './CompanionHud';
import FlightHud from './FlightHud';
import GameHeader from './GameHeader';
import MinimapHud from './MinimapHud';
import QuestPanel from './QuestPanel';
import WorldTitle from './WorldTitle';

export default function GameShell({ game }: { game: AdventureController }) {
  const {
    playSound,
    sceneId,
    reportSceneReady,
    interactWithPet,
    mode,
    progress,
    expedition,
    adventure,
    templeProgress,
    discovery,
    field,
    today,
    insideTemple,
    spawnPoint,
    travelPoint,
    travelTarget,
    travelRequest,
    flightRequest,
    flight,
    setPosition,
    reportFlight,
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
    templeVisited,
    owned,
    shownStage,
    isMeadow,
    seals,
    readyToCapture,
    isModal,
    notify,
    closeModal,
    changeMode,
    checkin,
    collect,
    investigateDiscovery,
    recordWildlife,
    recordMeadowRace,
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
  } = game;
  return (
    <div
      className={`game-shell ${insideTemple ? 'inside-temple' : ''}`}
      style={{ '--region-color': region.color } as CSSProperties}
    >
      <main
        className="world-stage"
        inert={isModal}
        onContextMenu={(event) => event.preventDefault()}
      >
        {insideTemple ? (
          <IndoorScene
            key={`${mode}-${regionId}`}
            region={regionId}
            stage={shownStage}
            companionId={adventure.activePet}
            paused={isModal}
            completed={templeVisited}
            onSound={playSound}
            onComplete={claimTempleRelic}
            onExit={exitTemple}
          />
        ) : (
          <OutdoorScene
            key={sceneId}
            onReady={reportSceneReady}
            discovery={discovery}
            field={field}
            today={today}
            onDiscoveryInteract={investigateDiscovery}
            onWildlifeObserved={recordWildlife}
            onRaceFinished={recordMeadowRace}
            region={regionId}
            spawnPoint={spawnPoint}
            travelPoint={travelPoint}
            onNearTemple={setNearTemple}
            onEnterTemple={enterTemple}
            templeVisited={templeVisited}
            companionId={adventure.activePet}
            wildPetId={owned ? null : region.petId}
            canCapture={readyToCapture}
            onNearWild={setNearWild}
            onCaptureRequest={startCapture}
            stage={shownStage}
            collectedCrystals={seals}
            onCollectCrystal={collect}
            onPetInteract={interactWithPet}
            petExcited={petExcited}
            treasureOpened={isMeadow ? expedition.treasureOpened : owned}
            onExplore={() => {}}
            travelTarget={travelTarget}
            travelRequest={travelRequest}
            onPosition={setPosition}
            paused={isModal}
            flightRequest={flightRequest}
            onSound={playSound}
            onFlightState={reportFlight}
            onFlightMessage={notify}
          />
        )}
      </main>
      <div className="hud-vignette" />
      {insideTemple && (
        <div className="temple-quick-menu" inert={isModal}>
          <button aria-label="室内打开伙伴图鉴" onClick={() => setPanel('journal')}>
            <PawPrint size={19} />
            <span>伙伴</span>
          </button>
          <button aria-label="室内打开旅行地图" onClick={() => setPanel('map')}>
            <Map size={19} />
            <span>地图</span>
          </button>
        </div>
      )}
      <GameHeader game={game} />

      <WorldTitle game={game} />

      <QuestPanel game={game} />

      <CompanionHud game={game} />

      <MinimapHud game={game} />

      <FlightHud game={game} />
      <div className="movement-help">
        <span>
          <kbd>W A S D</kbd> {flight.flying ? '飞行方向' : '移动主人公'}
        </span>
        <i />
        <span>
          <kbd>空格</kbd> {flight.flying ? '上升' : '跳跃'}
        </span>
        <i />
        <span>
          {flight.flying ? 'Shift / Ctrl 下降 · F 降落' : 'Shift 奔跑 · 拖拽视角 · 点击前往'}
        </span>
      </div>
      <div className="world-tools" inert={isModal}>
        <button
          aria-label="原野探险手记"
          title="原野探险手记"
          onClick={() => setPanel('expedition')}
        >
          <Compass size={18} />
        </button>
        <button aria-label="我的伙伴" onClick={() => setPanel('journal')}>
          <PawPrint size={18} />
        </button>
        <button aria-label="旅行地图" onClick={() => setPanel('map')}>
          <Map size={18} />
        </button>
      </div>
      <div className={`mode-toolbar ${mode === 'demo' ? 'demo' : ''}`} inert={isModal}>
        <button onClick={() => changeMode(mode === 'real' ? 'demo' : 'real')}>
          <FlaskConical size={12} />
          {mode === 'demo' ? '演示世界 · 返回真实' : '进入演示世界'}
        </button>
        {mode === 'demo' && (
          <>
            <button onClick={simulateTomorrow}>
              模拟明天 <Sun size={11} />
            </button>
            <button onClick={() => checkin(true)}>
              模拟打卡 <b>+40</b>
            </button>
            <button aria-label="重置演示进度" onClick={resetDemo}>
              <RotateCcw size={12} />
            </button>
          </>
        )}
      </div>
      {storageWarning && (
        <div className="storage-warning">浏览器暂时无法保存进度，请保持此页面开启。</div>
      )}
      {toast && (
        <div className="toast" role="status">
          <Sparkles size={17} />
          {toast}
        </div>
      )}
      {isModal && (
        <ModalShell panel={panel} reward={reward} onClose={closeModal}>
          <DialogHost
            panel={panel}
            reward={reward}
            mode={mode}
            progress={progress}
            expedition={expedition}
            adventure={adventure}
            templeProgress={templeProgress}
            discovery={discovery}
            field={field}
            today={today}
            flight={flight}
            closeModal={closeModal}
            setPanel={setPanel}
            checkin={checkin}
            choosePet={choosePet}
            newExpedition={newExpedition}
            enterRegion={enterRegion}
            simulateTomorrow={simulateTomorrow}
            travelTo={travelTo}
            travelToPlace={travelToPlace}
            playSound={playSound}
            finishCapture={finishCapture}
          />
        </ModalShell>
      )}
    </div>
  );
}
