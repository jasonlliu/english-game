import type { Panel } from '../../app/presentation';
import type { SoundCue } from '../../audio/types';
import {
  getUnlockedRegions,
  REGIONS,
  type Adventure,
  type PetId,
  type RegionId,
} from '../../game/adventure';
import type { Exploration } from '../../game/exploration';
import type { FieldProgress } from '../../game/fieldActivities';
import type { DiscoveryProgress } from '../../game/discovery';
import type { FlightStatus } from '../../game/flight';
import type { RegionPlace } from '../../game/landmarks';
import { getPetStage, type Mode, type Progress } from '../../game/progress';
import { TEMPLE_THEMES, type TempleProgress } from '../../game/temple';
import type { WorldZone } from '../../game/world';

/** Dialogs are presenters; only application commands may change a saved game. */
export interface DialogProps {
  panel: Panel;
  reward: 'checkin' | PetId | null;
  mode: Mode;
  progress: Progress;
  expedition: Exploration;
  adventure: Adventure;
  templeProgress: TempleProgress;
  discovery: DiscoveryProgress;
  field: FieldProgress;
  today: string;
  flight: FlightStatus;
  closeModal(): void;
  setPanel(panel: Panel): void;
  checkin(quick?: boolean): void;
  choosePet(id: PetId | null): void;
  newExpedition(): void;
  enterRegion(id: RegionId): void;
  simulateTomorrow(): void;
  travelTo(zone: WorldZone): void;
  travelToPlace(place: RegionPlace): void;
  finishCapture(): void;
  playSound(cue: SoundCue): void;
}
export function getDialogModel(props: DialogProps) {
  const regionId = props.adventure.currentRegion;
  const stage = getPetStage(props.progress);
  return {
    ...props,
    regionId,
    region: REGIONS[regionId],
    stage,
    shownStage: Math.max(1, stage) as 1 | 2 | 3,
    unlocked: getUnlockedRegions(props.adventure),
    seals: regionId === 'meadow' ? props.expedition.crystals : props.adventure.seals[regionId],
    templeTheme: TEMPLE_THEMES[regionId],
    templeVisited: props.templeProgress.completed.includes(regionId),
  };
}
