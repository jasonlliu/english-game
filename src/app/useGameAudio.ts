import { useEffect, useState } from 'react';
import { createGameAudioController } from '../audio/controller';
import type { AudioScene } from '../audio/types';

/** Audio is an application service; scene components only emit typed cues. */
export function useGameAudio(scene: AudioScene) {
  const [audio] = useState(() => createGameAudioController());
  useEffect(() => audio.start(), [audio]);
  useEffect(() => {
    audio.setScene(scene);
  }, [audio, scene.region, scene.temple, scene.flying, scene.ducked]);
  return audio;
}
