import { CalendarCheck, Check, Compass, Map, Menu, PawPrint, Star, Sun } from 'lucide-react';
import type { AdventureController } from '../../app/useAdventureController';
import SoundControls from './SoundControls';
import { getWorldSurvey } from '../../game/worldSurvey';

export default function GameHeader({ game }: { game: AdventureController }) {
  const { expedition, setPanel, survey, doneToday, isModal, notify, startCheckin } = game;
  return (
    <header className="hud-header" inert={isModal}>
      <a className="brand" href="#" aria-label="曙光旷野首页">
        <span className="brand-seal">
          <Sun size={29} strokeWidth={1.3} />
        </span>
        <span>
          曙光旷野<small>LUMEN WILDS</small>
        </span>
      </a>
      <button
        className="mobile-region-button"
        aria-label="打开世界地图"
        onClick={() => setPanel('map')}
      >
        <Map size={18} />
        <span>
          {game.region.name}
          <small>地图 · 探索 {getWorldSurvey(survey).percent}%</small>
        </span>
      </button>
      <nav className="top-nav" aria-label="游戏导航">
        <span className="nav-active">
          <Compass size={15} />
          自由探索
        </span>
        <button onClick={() => setPanel('journal')}>
          <PawPrint size={15} />
          我的伙伴
        </button>
        <button onClick={() => setPanel('map')}>
          <Map size={15} />
          世界地图 <b>{getWorldSurvey(survey).percent}%</b>
        </button>
      </nav>
      <div className="header-actions">
        <span className="star-wallet">
          <Star size={15} fill="currentColor" />
          {expedition.stars}
        </span>
        <button
          className={`checkin-entry ${doneToday ? 'checked' : ''}`}
          onClick={doneToday ? () => notify('今天已经打卡，伙伴的成长能量已收好。') : startCheckin}
        >
          {doneToday ? <Check size={17} /> : <CalendarCheck size={17} />}
          <span>{doneToday ? '今日已打卡' : '今日打卡'}</span>
          {!doneToday && <i />}
        </button>
        <SoundControls audio={game.audio} blocked={isModal} />
        <button
          className="icon-button help-button"
          aria-label="玩法帮助"
          onClick={() => setPanel('guide')}
        >
          ?
        </button>
        <button
          className="mobile-menu-button"
          aria-label="打开冒险菜单"
          onClick={() => setPanel('menu')}
        >
          <Menu size={20} />
          <span>菜单</span>
        </button>
      </div>
    </header>
  );
}
