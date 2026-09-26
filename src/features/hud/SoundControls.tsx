import { Volume2, VolumeX } from 'lucide-react';
import { useEffect, useId, useRef, useState, useSyncExternalStore } from 'react';
import type { GameAudioController } from '../../audio/types';
import AsyncView from '../../loading/AsyncView';
import { createModuleLoader } from '../../loading/createModuleLoader';
import { statusLabels } from '../audio/statusLabels';

const panels = createModuleLoader({ settings: () => import('../audio/SoundPanel') });
const loadPanel = () => panels.load('settings');

export default function SoundControls({
  audio,
  blocked,
}: {
  audio: GameAudioController;
  blocked: boolean;
}) {
  const { preferences, status } = useSyncExternalStore(
    audio.subscribe,
    audio.getSnapshot,
    audio.getSnapshot,
  );
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const id = useId();
  const silent =
    preferences.muted || (preferences.musicVolume === 0 && preferences.effectsVolume === 0);
  useEffect(() => {
    if (blocked) setOpen(false);
  }, [blocked]);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [open]);
  function close() {
    setOpen(false);
    trigger.current?.focus();
  }
  return (
    <div
      className="sound-controls"
      ref={root}
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === 'Escape') {
          event.preventDefault();
          close();
        }
      }}
    >
      <button
        ref={trigger}
        className={`sound-toggle ${status === 'playing' && !silent ? 'is-playing' : ''}`}
        aria-label="声音设置"
        title={statusLabels[status]}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => {
          setOpen((value) => !value);
          if (!preferences.muted) void audio.unlock();
        }}
      >
        {silent ? <VolumeX size={17} /> : <Volume2 size={17} />}
        <span className="sound-indicator" aria-hidden="true" />
      </button>
      {open && (
        <div id={id} className="sound-panel-anchor">
          <AsyncView load={loadPanel} label="正在打开声音设置…">
            {({ default: Panel }) => <Panel audio={audio} close={close} />}
          </AsyncView>
        </div>
      )}
    </div>
  );
}
