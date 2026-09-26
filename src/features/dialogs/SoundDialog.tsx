import SoundPanel from '../audio/SoundPanel';
import type { DialogProps } from './types';
import './adventureMenu.css';

export default function SoundDialog({ menu, setPanel }: DialogProps) {
  return menu ? (
    <div className="menu-sound">
      <SoundPanel audio={menu.audio} close={() => setPanel('menu')} embedded />
    </div>
  ) : null;
}
