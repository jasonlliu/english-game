import { X } from 'lucide-react';
import { useEffect, useRef, type ReactNode } from 'react';
import type { Panel } from '../../app/presentation';
import type { PetId } from '../../game/adventure';
const labels: Record<Exclude<Panel, null>, string> = {
  checkin: '确认今日打卡',
  journal: '我的伙伴',
  expedition: '原野探险手记',
  map: '世界探索地图',
  capture: '建立羁绊',
  treasure: '发现宝藏',
  relic: '发现神庙遗物',
  guide: '玩法帮助',
};
export default function ModalShell({
  panel,
  reward,
  onClose,
  children,
}: {
  panel: Panel;
  reward: 'checkin' | PetId | null;
  onClose(): void;
  children: ReactNode;
}) {
  const container = useRef<HTMLDivElement>(null),
    close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null,
      overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close.current();
      if (event.key !== 'Tab') return;
      const items = container.current?.querySelectorAll<HTMLElement>(
        'button:not(:disabled),a[href],input:not(:disabled),[tabindex="0"]',
      );
      if (!items?.length) return;
      const first = items[0],
        last = items[items.length - 1];
      if (!container.current?.contains(document.activeElement)) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener('keydown', onKey);
      if (previous?.isConnected) previous.focus();
    };
  }, []);
  useEffect(() => {
    container.current?.scrollTo({ top: 0 });
    container.current?.querySelector<HTMLElement>('button')?.focus();
  }, [panel, reward]);
  const rewardLayout = reward || ['checkin', 'treasure', 'capture', 'relic'].includes(panel || '');
  return (
    <div
      className="modal-backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className={`modal ${rewardLayout ? 'reward-modal' : ''} ${panel === 'map' ? 'travel-modal' : ''} ${panel === 'expedition' ? 'expedition-modal' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={reward ? '冒险奖励' : panel ? labels[panel] : '冒险'}
        ref={container}
      >
        <button className="modal-close" aria-label="关闭窗口" onClick={onClose}>
          <X size={20} />
        </button>
        {children}
      </div>
    </div>
  );
}
