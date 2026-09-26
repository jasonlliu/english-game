import { Map, MapPin } from 'lucide-react';
import { useSyncExternalStore } from 'react';
import type { AdventureController } from '../../app/useAdventureController';
import WorldMap from '../../features/hud/WorldMap';
import { REGION_PLACES } from '../../game/landmarks';
import { getRegionZones } from '../../game/worldLayout';
import { getRegionSurvey } from '../../game/worldSurvey';

import { waypointNames, zoneKeys } from '../../app/presentation';

export default function MinimapHud({ game }: { game: AdventureController }) {
  const { telemetry, setPanel, regionId, region, seals, isModal } = game;
  const WORLD_ZONES = getRegionZones(regionId);
  const position = useSyncExternalStore(
    telemetry.position.subscribe,
    telemetry.position.getSnapshot,
    telemetry.position.getSnapshot,
  );
  const nearest = zoneKeys.findIndex(
    (key) => Math.hypot(position.x - WORLD_ZONES[key].x, position.z - WORLD_ZONES[key].z) < 11,
  );
  const nearbyPlace = REGION_PLACES[regionId].find(
    (place) => Math.hypot(position.x - place.x, position.z - place.z) < 8,
  );
  const locationName =
    nearbyPlace?.name || (nearest >= 0 ? waypointNames[regionId][nearest] : region.name);
  return (
    <div className="minimap-hud" inert={isModal}>
      <button
        className="minimap-button"
        aria-label="打开世界探索地图"
        onClick={() => setPanel('map')}
      >
        <WorldMap regionId={regionId} seals={seals} position={position} />
        <span className="map-north">N</span>
        <span className="map-expand">
          <Map size={13} />
        </span>
      </button>
      <span className="map-location">
        <MapPin size={11} />
        {locationName}
      </span>
      <span className="minimap-survey">
        地标探索 {getRegionSurvey(regionId, game.survey).percent}%
      </span>
    </div>
  );
}
