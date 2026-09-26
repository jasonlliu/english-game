import type { DiscoveryProximity } from '../game/discoveryProximity';
import '../styles/discoveryScene.css';

export default function DiscoveryPrompt({
  proximity,
  companion,
  onInteract,
}: {
  proximity: DiscoveryProximity;
  companion: boolean;
  onInteract: () => void;
}) {
  if (!proximity.near && !proximity.sense) return null;
  return (
    <div className={`discovery-prompt${proximity.near ? '' : ' is-passive'}`}>
      {proximity.near ? (
        <button onClick={onInteract}>
          <span>
            <small>发现 · {proximity.near.name}</small>
            {proximity.near.prompt}
          </span>
          <kbd>E</kbd>
        </button>
      ) : (
        <p role="status">
          <span aria-hidden="true">✧</span>
          {companion ? '伙伴留意到了什么，附近似乎有线索…' : '风里有细微的光，附近似乎有线索…'}
        </p>
      )}
    </div>
  );
}
