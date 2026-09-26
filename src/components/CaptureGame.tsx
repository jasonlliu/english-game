import { Check, Heart, Sparkles } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { SoundCue } from '../audio/types';
import { PETS, isCaptureHit, type PetId } from '../game/adventure';
import CompanionPortrait from './CompanionPortrait';

export default function CaptureGame({
  petId,
  onComplete,
  onSound,
}: {
  petId: PetId;
  onComplete: () => void;
  onSound?: (cue: SoundCue) => void;
}) {
  const [hits, setHits] = useState(0);
  const [phase, setPhase] = useState(0);
  const [slow, setSlow] = useState(false);
  const [message, setMessage] = useState('等光点进入绿色区域，轻轻安抚它。');
  const [cooldown, setCooldown] = useState(false);
  const phaseRef = useRef(0);
  const hitRef = useRef(0);
  const cooldownRef = useRef(false);
  const cooldownTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pet = PETS[petId];
  const centers = [0.3, 0.65, 0.45],
    widths = [0.14, 0.12, 0.1];
  useEffect(() => {
    let frame = 0,
      previous = 0,
      elapsed = 0;
    const tick = (time: number) => {
      if (previous) elapsed += Math.min(time - previous, 80);
      previous = time;
      const value = (elapsed / (slow ? 5500 : 3000)) % 2;
      phaseRef.current = value <= 1 ? value : 2 - value;
      setPhase(phaseRef.current);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [slow]);
  useEffect(() => () => clearTimeout(cooldownTimer.current), []);
  function soothe() {
    if (cooldownRef.current || hitRef.current >= 3) return;
    cooldownRef.current = true;
    setCooldown(true);
    if (isCaptureHit(phaseRef.current, hitRef.current)) {
      hitRef.current += 1;
      setHits(hitRef.current);
      if (hitRef.current === 3) {
        onComplete();
        return;
      }
      onSound?.('seal');
      setMessage(
        hitRef.current === 1 ? '它放松了下来，再靠近一点。' : '它已经开始信任你，最后一次！',
      );
    } else {
      onSound?.('mistake');
      setMessage('它还有一点害羞。没关系，可以继续尝试。');
    }
    cooldownTimer.current = setTimeout(() => {
      cooldownRef.current = false;
      setCooldown(false);
    }, 450);
  }
  return (
    <div className="capture-game">
      <div className="eyebrow">A NEW FRIEND IS WAITING</div>
      <h2>和{pet.name}建立羁绊</h2>
      <div className="capture-pet" style={{ '--pet-color': pet.color } as React.CSSProperties}>
        <CompanionPortrait petId={petId} />
      </div>
      <span className="element-badge" style={{ color: pet.color }}>
        {pet.element}属性 · 野生伙伴
      </span>
      <p>{pet.description}</p>
      <div className="bond-hearts" aria-label={`信任度 ${hits} / 3`}>
        {[0, 1, 2].map((i) => (
          <Heart
            key={i}
            size={25}
            fill={hits > i ? 'currentColor' : 'none'}
            className={hits > i ? 'filled' : ''}
          />
        ))}
      </div>
      <div
        className="bond-meter"
        role="meter"
        aria-label="安抚光点位置"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(phase * 100)}
      >
        <span
          className="bond-target"
          style={{
            left: `${(centers[hits] - widths[hits]) * 100}%`,
            width: `${widths[hits] * 200}%`,
          }}
        />
        <span className="bond-marker" style={{ left: `${phase * 100}%` }} />
      </div>
      <p className="bond-message" aria-live="polite">
        {message}
      </p>
      <button className="primary" aria-disabled={cooldown} onClick={soothe}>
        <Sparkles size={17} />
        轻轻安抚 · {hits} / 3
      </button>
      <button className="text-action" aria-pressed={slow} onClick={() => setSlow(!slow)}>
        {slow && <Check size={12} />} {slow ? '从容模式已开启' : '放慢光点，慢慢来'}
      </button>
      <small>完成三次安抚 · 失误不扣奖励 · 随时可以重试</small>
    </div>
  );
}
