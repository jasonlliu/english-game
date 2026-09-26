import { useAdventureController } from './app/useAdventureController';
import GameShell from './features/hud/GameShell';

export default function App() {
  const game = useAdventureController();
  return <GameShell game={game} />;
}
