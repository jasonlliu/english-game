import CaptureGame from '../../components/CaptureGame';
import { REGIONS } from '../../game/adventure';
import type { DialogProps } from './types';
export default function CaptureDialog({ adventure, finishCapture }: DialogProps) {
  const petId = REGIONS[adventure.currentRegion].petId;
  return <CaptureGame key={petId} petId={petId} onComplete={finishCapture} />;
}
