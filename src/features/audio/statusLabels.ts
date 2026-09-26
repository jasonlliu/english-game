import type { AudioStatus } from '../../audio/types';
export const statusLabels: Record<AudioStatus, string> = {
  locked: '点击开启旅途声音',
  loading: '正在准备声音…',
  playing: '旅途声音已开启',
  muted: '声音已静音',
  paused: '声音已暂停',
  unavailable: '声音暂未开启，可点击重试',
};
