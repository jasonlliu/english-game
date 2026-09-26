import { Music2, Volume2, VolumeX, X } from 'lucide-react';
import { useEffect, useRef, useSyncExternalStore } from 'react';
import type { GameAudioController } from '../../audio/types';
import { statusLabels } from './statusLabels';

export default function SoundPanel({
  audio,
  close,
  embedded = false,
}: {
  audio: GameAudioController;
  close(): void;
  embedded?: boolean;
}) {
  const { preferences, status } = useSyncExternalStore(
    audio.subscribe,
    audio.getSnapshot,
    audio.getSnapshot,
  );
  const closeButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!embedded) closeButton.current?.focus();
  }, [embedded]);
  function toggleMute() {
    audio.setPreferences({ muted: !preferences.muted });
    if (preferences.muted) void audio.unlock();
  }
  return (
    <section
      className="sound-panel"
      aria-label="旅途声音"
      onBlur={(event) => {
        if (embedded) return;
        if (!event.currentTarget.parentElement?.contains(event.relatedTarget as Node | null))
          close();
      }}
    >
      <div className="sound-panel-heading">
        <span>
          <Music2 size={16} />
          旅途声音
        </span>
        <button ref={closeButton} aria-label="关闭声音设置" onClick={close}>
          <X size={17} />
        </button>
      </div>
      <p className="sound-status" role="status">
        {statusLabels[status]}
      </p>
      <button
        className={`sound-mute ${preferences.muted ? 'is-muted' : ''}`}
        aria-pressed={preferences.muted}
        onClick={toggleMute}
      >
        {preferences.muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
        {preferences.muted ? '开启声音' : '静音'}
      </button>
      <label className="sound-slider">
        <span>
          背景音乐 <output>{Math.round(preferences.musicVolume * 100)}%</output>
        </span>
        <input
          aria-label="背景音乐音量"
          type="range"
          min="0"
          max="100"
          step="5"
          value={Math.round(preferences.musicVolume * 100)}
          onChange={(event) =>
            audio.setPreferences({ musicVolume: Number(event.target.value) / 100 })
          }
        />
      </label>
      <label className="sound-slider">
        <span>
          游戏音效 <output>{Math.round(preferences.effectsVolume * 100)}%</output>
        </span>
        <input
          aria-label="游戏音效音量"
          type="range"
          min="0"
          max="100"
          step="5"
          value={Math.round(preferences.effectsVolume * 100)}
          onChange={(event) =>
            audio.setPreferences({ effectsVolume: Number(event.target.value) / 100 })
          }
        />
      </label>
      <button
        className="sound-preview"
        disabled={preferences.muted || preferences.effectsVolume === 0 || status === 'loading'}
        onClick={() => {
          void audio.unlock().then(() => audio.play('collect'));
        }}
      >
        {status === 'unavailable' || status === 'locked' || status === 'paused'
          ? '开启并试听'
          : '试听音效'}
      </button>
      <small>声音随场景变化 · 离开页面自动暂停</small>
    </section>
  );
}
