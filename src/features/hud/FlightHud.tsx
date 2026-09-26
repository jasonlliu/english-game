import { Wind } from 'lucide-react';
import { useSyncExternalStore } from 'react';
import type { AdventureController } from '../../app/useAdventureController';

export default function FlightHud({ game }: { game: AdventureController }) {
  const { telemetry, companion, canFly, isModal, toggleFlight, sceneReady } = game;
  const flight = useSyncExternalStore(
    telemetry.flight.subscribe,
    telemetry.flight.getSnapshot,
    telemetry.flight.getSnapshot,
  );
  return (
    <div
      className={`flight-hud ${flight.flying ? 'airborne' : ''} ${canFly ? 'can-fly' : ''}`}
      inert={isModal}
    >
      <button
        className="flight-toggle"
        onClick={toggleFlight}
        disabled={!sceneReady || flight.landing}
        aria-label={
          !sceneReady
            ? '场景准备中'
            : flight.landing
              ? '正在安全降落'
              : flight.flying
                ? '安全降落'
                : canFly
                  ? '骑乘起飞'
                  : '选择飞行伙伴'
        }
      >
        <Wind size={18} />
        <span>
          {!sceneReady
            ? '场景准备中'
            : flight.landing
              ? '正在降落'
              : flight.flying
                ? '安全降落'
                : canFly
                  ? '骑乘起飞'
                  : '选择飞行伙伴'}
        </span>
        {sceneReady && canFly && !flight.landing && <kbd>F</kbd>}
      </button>
      {flight.flying ? (
        <>
          <div className="flight-altitude">
            <span>离地高度</span>
            <b>
              {Math.round(flight.altitude)} <small>m</small>
            </b>
          </div>
          <p>{flight.landing ? '正在寻找并降落到附近空地' : '空格上升 · Shift / Ctrl 下降'}</p>
        </>
      ) : (
        <p>
          {!sceneReady
            ? '风景就绪后即可出发'
            : canFly
              ? `${companion?.name}准备好带你翱翔了`
              : '星翼烁牙 / 绮露可骑乘飞行'}
        </p>
      )}
    </div>
  );
}
