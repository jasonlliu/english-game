import { zoneKeys } from '../../app/presentation';
import { REGIONS, type RegionId } from '../../game/adventure';
import { REGION_PLACES } from '../../game/landmarks';
import {
  LAKE,
  WORLD_ZONES,
  getRegionTrails,
  getWorldBounds,
  type WorldPoint,
} from '../../game/worldLayout';
export default function WorldMap({
  regionId,
  seals,
  position,
}: {
  regionId: RegionId;
  seals: number[];
  position: WorldPoint & { heading: number };
}) {
  const region = REGIONS[regionId];
  const bounds = getWorldBounds(regionId);
  const scaleX = 176 / (bounds.maxX - bounds.minX),
    scaleZ = 176 / (bounds.maxZ - bounds.minZ);
  const x = (value: number) =>
    12 + (Math.max(bounds.minX, Math.min(bounds.maxX, value)) - bounds.minX) * scaleX;
  const z = (value: number) =>
    12 + (Math.max(bounds.minZ, Math.min(bounds.maxZ, value)) - bounds.minZ) * scaleZ;
  return (
    <svg
      className="world-map"
      viewBox="0 0 200 200"
      aria-label="当前场景地图，显示主人公、符印地点与地区景观"
    >
      <rect width="200" height="200" fill={region.color} />
      <path d="M0 0h200v39l-30-14-34 18-40-20-33 16-35-9L0 50Z" fill="#ffffff25" />
      <ellipse
        cx={x(LAKE.x)}
        cy={z(LAKE.z)}
        rx={LAKE.radiusX * scaleX}
        ry={LAKE.radiusZ * scaleZ}
        fill="#c8f0fa85"
      />
      {getRegionTrails(regionId).map((trail, index) => (
        <polyline
          key={index}
          points={trail.map((point) => `${x(point.x)},${z(point.z)}`).join(' ')}
          fill="none"
          stroke="#fff1c0"
          strokeWidth={regionId === 'meadow' ? 2.2 : 3}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
      {zoneKeys.map((key, i) => (
        <circle
          key={key}
          cx={x(WORLD_ZONES[key].x)}
          cy={z(WORLD_ZONES[key].z)}
          r="6"
          fill={seals.includes(i) ? '#fff4d1' : '#d6ffed'}
          stroke="#486757"
          strokeWidth="2"
        />
      ))}
      {REGION_PLACES[regionId].slice(1).map((place) => (
        <rect
          key={place.id}
          x={x(place.x) - 4}
          y={z(place.z) - 4}
          width="8"
          height="8"
          rx="2"
          fill="#fff2cb"
          stroke="#687266"
          strokeWidth="1.4"
        />
      ))}
      <g
        transform={`translate(${x(position.x)},${z(position.z)}) rotate(${(position.heading * 180) / Math.PI})`}
      >
        <circle r="9" fill="#fff" opacity=".45" />
        <path d="m0-7 5 12-5-3-5 3Z" fill="#fff9dc" stroke="#365653" strokeWidth="1.5" />
      </g>
    </svg>
  );
}
