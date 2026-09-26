import { zoneKeys } from '../../app/presentation';
import { REGIONS, type RegionId } from '../../game/adventure';
import { REGION_PLACES } from '../../game/landmarks';
import { WORLD_ZONES, type WorldPoint } from '../../game/world';
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
  return (
    <svg
      className="world-map"
      viewBox="0 0 200 200"
      aria-label="当前场景地图，显示主人公、符印地点与地区景观"
    >
      <rect width="200" height="200" fill={region.color} />
      <path d="M0 0h200v39l-30-14-34 18-40-20-33 16-35-9L0 50Z" fill="#ffffff25" />
      <path d="M162 66c28 5 29 45 10 62-13 11-34 2-37-15-4-24 8-48 27-47Z" fill="#c8f0fa85" />
      <path
        d="M100 190q-9-39 1-64T88 67m12 60q-25-7-42-23m44 20 43-13"
        fill="none"
        stroke="#fff1c0"
        strokeWidth="5"
        strokeLinecap="round"
      />
      {zoneKeys.map((key, i) => (
        <circle
          key={key}
          cx={100 + WORLD_ZONES[key].x * 1.55}
          cy={105 + WORLD_ZONES[key].z * 1.5}
          r="6"
          fill={seals.includes(i) ? '#fff4d1' : '#d6ffed'}
          stroke="#486757"
          strokeWidth="2"
        />
      ))}
      {REGION_PLACES[regionId].slice(1).map((place) => (
        <rect
          key={place.id}
          x={96 + place.x * 1.55}
          y={101 + place.z * 1.5}
          width="8"
          height="8"
          rx="2"
          fill="#fff2cb"
          stroke="#687266"
          strokeWidth="1.4"
        />
      ))}
      <g
        transform={`translate(${100 + Math.max(-55, Math.min(55, position.x)) * 1.55},${105 + Math.max(-60, Math.min(55, position.z)) * 1.5}) rotate(${(position.heading * 180) / Math.PI})`}
      >
        <circle r="9" fill="#fff" opacity=".45" />
        <path d="m0-7 5 12-5-3-5 3Z" fill="#fff9dc" stroke="#365653" strokeWidth="1.5" />
      </g>
    </svg>
  );
}
