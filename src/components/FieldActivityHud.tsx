import type { FieldProgress } from '../game/fieldActivities';
import { RACE_DURATION, getRaceRating } from '../game/fieldActivities';
import { RACE_GATES } from '../game/fieldActivityRules';
import { FIELD_GUIDE } from '../game/fieldGuide';
import type { FieldActivityView } from './fieldActivityRuntime';
import '../styles/fieldActivities.css';

export default function FieldActivityHud({
  view,
  field,
  start,
  cancel,
  observe,
}: {
  view: FieldActivityView;
  field: FieldProgress;
  start(): void;
  cancel(): void;
  observe(held: boolean): void;
}) {
  const race = view.race;
  const running = race?.status === 'running';
  const animal = view.animal;
  if (!view.nearStart && !race && !animal) return null;
  const release = () => observe(false);
  return (
    <section className={`field-activity-hud ${running ? 'is-racing' : ''}`} aria-label="原野活动">
      {race ? (
        <div className="field-race-progress">
          <div>
            <small>
              {running
                ? '风车竞速 · 穿过下一个亮环'
                : race.status === 'finished'
                  ? `${{ gold: '金色风翼', silver: '银色风翼', bronze: '铜色风翼' }[getRaceRating(race.elapsed)]} · 挑战完成`
                  : race.status === 'timed-out'
                    ? '时间到，下次再挑战'
                    : '已结束地面竞速'}
            </small>
            <strong>
              {running
                ? `${race.nextGate} / ${RACE_GATES.length}`
                : `${race.elapsed.toFixed(2)} 秒`}
            </strong>
          </div>
          {running && (
            <>
              <b>
                {(RACE_DURATION - race.elapsed).toFixed(1)}
                <small>秒</small>
              </b>
              <button className="field-cancel" onClick={cancel} aria-label="退出竞速">
                ×
              </button>
            </>
          )}
          {!running && view.nearStart && (
            <button onClick={start}>
              再试一次 <kbd>R</kbd>
            </button>
          )}
          {!running && (
            <button className="field-cancel" onClick={cancel} aria-label="收起竞速结果">
              ×
            </button>
          )}
        </div>
      ) : (
        view.nearStart && (
          <div className="field-race-invite">
            <div>
              <small>限时穿环 · 奔跑路线由你掌握</small>
              <strong>风车竞速</strong>
            </div>
            <button onClick={start}>
              开始挑战 <kbd>R</kbd>
            </button>
          </div>
        )
      )}
      {running && (
        <p className="field-tip">下一环：{race.direction} · Shift 奔跑 · 骑乘会结束挑战</p>
      )}
      {!running && animal && (
        <div className="field-observation">
          <span className="field-species-icon" aria-hidden="true">
            {FIELD_GUIDE[animal.kind].icon}
          </span>
          <div>
            <strong>
              {FIELD_GUIDE[animal.kind].name}
              <small>{animal.recorded ? '已收录' : `${field.observed.length} / 5 种`}</small>
            </strong>
            <p>
              {animal.startled
                ? '它受惊了，停下来等一等'
                : animal.recorded
                  ? '这位邻居已经记在手记里'
                  : '停下脚步，按住观察 3 秒'}
            </p>
            {!animal.recorded && (
              <progress max={3} value={animal.progress} aria-label="动物观察进度" />
            )}
          </div>
          {!animal.recorded && (
            <button
              disabled={animal.startled}
              onPointerDown={(e) => {
                if (e.button !== 0) return;
                e.preventDefault();
                e.currentTarget.setPointerCapture(e.pointerId);
                observe(true);
              }}
              onPointerUp={release}
              onPointerCancel={release}
              onLostPointerCapture={release}
              onBlur={release}
              onKeyDown={(e) => {
                if (e.code === 'Space' || e.code === 'Enter') {
                  e.preventDefault();
                  observe(true);
                }
              }}
              onKeyUp={(e) => {
                if (e.code === 'Space' || e.code === 'Enter') {
                  e.preventDefault();
                  release();
                }
              }}
            >
              观察 <kbd>Q</kbd>
            </button>
          )}
        </div>
      )}
    </section>
  );
}
