import type { ComponentType } from 'react';
import type { Panel } from '../../app/presentation';
import AsyncView from '../../loading/AsyncView';
import { createModuleLoader } from '../../loading/createModuleLoader';
import type { DialogProps } from './types';

type DialogName = Exclude<Panel, null> | 'reward';
type DialogModule = { default: ComponentType<DialogProps> };
const registry: Record<DialogName, () => Promise<DialogModule>> = {
  menu: () => import('./AdventureMenu'),
  sound: () => import('./SoundDialog'),
  checkin: () => import('./CheckinDialog'),
  journal: () => import('./CompanionJournal'),
  expedition: () => import('./ExpeditionJournal'),
  map: () => import('./TravelAtlas'),
  guide: () => import('./GuideDialog'),
  capture: () => import('./CaptureDialog'),
  treasure: () => import('./TreasureDialog'),
  relic: () => import('./TempleRewardDialog'),
  reward: () => import('./RewardDialog'),
};
const dialogs = createModuleLoader(registry);
const requests = Object.fromEntries(
  Object.keys(registry).map((key) => [key, () => dialogs.load(key as DialogName)]),
) as Record<DialogName, () => Promise<DialogModule>>;
export default function DialogHost(props: DialogProps) {
  const name = props.reward ? 'reward' : props.panel;
  if (!name) return null;
  return (
    <AsyncView key={name} load={requests[name]} label="正在打开…">
      {({ default: Dialog }) => <Dialog {...props} />}
    </AsyncView>
  );
}
