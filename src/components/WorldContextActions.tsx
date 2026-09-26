import type { FieldProgress } from '../game/fieldActivities';
import type { DiscoveryProximity } from '../game/discoveryProximity';
import type { FieldActivityView } from './fieldActivityRuntime';
import DiscoveryPrompt from './DiscoveryPrompt';
import FieldActivityHud from './FieldActivityHud';
import '../styles/worldContextActions.css';

/** Nearby actions share one mobile lane; desktop retains its wider HUD layout. */
export default function WorldContextActions({
  field,
  fieldView,
  startRace,
  cancelRace,
  observe,
  discovery,
  companion,
  onDiscovery,
  nearWild,
  canCapture,
  onCapture,
  nearTemple,
  onEnterTemple,
}: {
  field?: FieldProgress;
  fieldView: FieldActivityView;
  startRace(): void;
  cancelRace(): void;
  observe(held: boolean): void;
  discovery?: DiscoveryProximity;
  companion: boolean;
  onDiscovery(): void;
  nearWild: boolean;
  canCapture: boolean;
  onCapture(): void;
  nearTemple: boolean;
  onEnterTemple(): void;
}) {
  // An ongoing activity keeps its controls; completed discoveries make room for the next action.
  const active =
    field && fieldView.race
      ? 'field'
      : discovery?.near
        ? 'discovery'
        : nearWild && canCapture
          ? 'capture'
          : nearTemple
            ? 'temple'
            : 'field';
  return (
    <div className="world-context-actions">
      {field && (
        <div data-mobile-visible={active === 'field'}>
          <FieldActivityHud
            view={fieldView}
            field={field}
            start={startRace}
            cancel={cancelRace}
            observe={observe}
          />
        </div>
      )}
      {fieldView.race?.status !== 'running' && discovery && (
        <div data-mobile-visible={active === 'discovery'}>
          <DiscoveryPrompt proximity={discovery} companion={companion} onInteract={onDiscovery} />
        </div>
      )}
      {nearWild && (
        <div className="wild-bond-prompt" data-mobile-visible={active === 'capture'}>
          {canCapture ? (
            <button className="wild-bond-button" onClick={onCapture}>
              <span>与伙伴建立羁绊</span>
              <kbd>E</kbd>
            </button>
          ) : (
            <span>收集三枚符印后，可以与这里的伙伴建立羁绊</span>
          )}
        </div>
      )}
      {nearTemple && (
        <div className="temple-enter-prompt" data-mobile-visible={active === 'temple'}>
          <button onClick={onEnterTemple}>
            进入神庙 <kbd>{nearWild && canCapture ? '↗' : 'E'}</kbd>
          </button>
        </div>
      )}
    </div>
  );
}
