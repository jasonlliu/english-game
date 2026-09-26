import { useId, type CSSProperties } from 'react';
import { REGIONS, type RegionId } from '../../game/adventure';
import { REGION_PLACES, REGION_VOLUMES } from '../../game/landmarks';
import { getRegionTrails, getWorldBounds, LAKE, type WorldPoint } from '../../game/worldLayout';
import { SURVEY_GRID_SIZE, type WorldSurvey } from '../../game/worldSurvey';

export interface RegionSurveyMapProps {
  regionId: RegionId;
  survey: WorldSurvey;
  position?: WorldPoint & { heading: number };
  selectedPlace: string | null;
  onSelectPlace(id: string): void;
}

const EDGE = 28;
const MAP_SIZE = 424;
const PALETTES: Record<RegionId, [string, string]> = {
  meadow: ['#c2d1a5', '#658166'],
  water: ['#b9d4cb', '#53878e'],
  fire: ['#d9c3ae', '#a17469'],
  earth: ['#dbc5a0', '#9b7d55'],
  steel: ['#c4cbd0', '#697c8c'],
  fairy: ['#d4c7d8', '#8a739b'],
};

/** Map glyphs stay in this lazy dialog; no renderer or image assets are loaded. */
function PlaceGlyph({ kind }: { kind: string }) {
  switch (kind) {
    case 'temple':
    case 'ruins':
      return <path d="M-8-3 0-8 8-3ZM-6 0V7M0 0V7M6 0V7M-8 8H8" />;
    case 'waterfall':
    case 'spring':
      return <path d="M-6-8V1Q-6 6-9 6M0-8V4M6-8V1Q6 6 9 6M-8 9Q-4 6 0 9T8 9" />;
    case 'camp':
      return <path d="M-9 7 0-8 9 7ZM-3 7 0 0 3 7M-12 7H12" />;
    case 'garden':
    case 'treehouse':
      return <path d="M0 9V-1M0 3Q-10 3-7-5Q0-6 0 3ZM0-1Q0-9 7-8Q11 0 0-1Z" />;
    case 'glacier':
    case 'vista':
      return <path d="M-10 8 0-9 10 8ZM-4-2 0 1 4-2M-10 8H10" />;
    case 'harbor':
      return <path d="M-7 8-5-4H5L7 8M-6-4 0-9 6-4M-2-1H2M-10 9H10" />;
    case 'bridge':
    case 'aqueduct':
      return <path d="M-10-5H10M-10-2V8M10-2V8M-10 2Q0-9 10 2M-5 0V-4M5 0V-4" />;
    case 'observatory':
      return <path d="M-9 0A9 9 0 0 1 9 0ZM-7 1V8H7V1M0-9V-12M-10 8H10" />;
    case 'tower':
    case 'workshop':
      return <path d="M-6 8V-8H-2V-4H2V-8H6V8ZM-2 8V3H2V8" />;
    default:
      return <path d="M-10-1 0-9 10-1M-7-2V8H7V-2M-2 8V2H2V8" />;
  }
}

export default function RegionSurveyMap({
  regionId,
  survey,
  position,
  selectedPlace,
  onSelectPlace,
}: RegionSurveyMapProps) {
  const id = useId();
  const bounds = getWorldBounds(regionId);
  const scaleX = MAP_SIZE / (bounds.maxX - bounds.minX);
  const scaleZ = MAP_SIZE / (bounds.maxZ - bounds.minZ);
  const project = ({ x, z }: WorldPoint) => ({
    x: EDGE + (x - bounds.minX) * scaleX,
    y: EDGE + (z - bounds.minZ) * scaleZ,
  });
  const regionSurvey = survey.regions[regionId];
  const exploredCells = new Set(regionSurvey.cells);
  const places = REGION_PLACES[regionId];
  const lake = project(LAKE);
  const cellSize = MAP_SIZE / SURVEY_GRID_SIZE;
  const player =
    position &&
    Number.isFinite(position.x) &&
    Number.isFinite(position.z) &&
    Number.isFinite(position.heading) &&
    position.x >= bounds.minX &&
    position.x <= bounds.maxX &&
    position.z >= bounds.minZ &&
    position.z <= bounds.maxZ
      ? project(position)
      : null;
  const [land, ink] = PALETTES[regionId];
  return (
    <div
      className="region-survey-map"
      data-region={regionId}
      style={{ '--survey-land': land, '--survey-ink': ink } as CSSProperties}
    >
      <svg
        viewBox="0 0 480 480"
        role="group"
        aria-labelledby={`${id}-title`}
        aria-describedby={`${id}-description`}
        className="survey-chart"
      >
        <title id={`${id}-title`}>{`${REGIONS[regionId].name}探索地图`}</title>
        <desc id={`${id}-description`}>
          浅色迷雾是尚未走过的区域。选择地点标记查看详情，问号代表待探索地点。
          {player ? '蓝色箭头标出你的位置与朝向。' : '当前不在此地区，不显示人物位置。'}
        </desc>
        <defs>
          <clipPath id={`${id}-bounds`}>
            <rect x={EDGE} y={EDGE} width={MAP_SIZE} height={MAP_SIZE} rx="18" />
          </clipPath>
          <pattern id={`${id}-paper`} width="12" height="12" patternUnits="userSpaceOnUse">
            <circle cx="3" cy="4" r="0.55" fill="#6e705b" opacity="0.15" />
            <path d="m8 10 2-1" stroke="#fff9e8" strokeWidth="0.8" opacity="0.45" />
          </pattern>
          <pattern
            id={`${id}-unexplored`}
            width="14"
            height="14"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(35)"
          >
            <path d="M0 0V14" stroke="#898b79" strokeWidth="0.8" opacity="0.15" />
          </pattern>
        </defs>

        <rect className="survey-paper" x="9" y="9" width="462" height="462" rx="23" />
        <g clipPath={`url(#${id}-bounds)`} aria-hidden="true">
          <rect className="survey-land" x={EDGE} y={EDGE} width={MAP_SIZE} height={MAP_SIZE} />
          <g className="survey-contours">
            <path d="M4 134C64 204 27 268 103 322S134 436 110 482M-4 94C87 172 49 246 123 290S165 421 143 478M16 57C107 135 88 236 160 265S199 402 180 483" />
            <path d="M88 2C106 60 183 39 212 93S300 131 348 98 405 86 487 124M123-8C153 28 183 16 236 59S311 96 353 63 436 73 490 89" />
          </g>
          <ellipse
            className="survey-lake-bank"
            cx={lake.x}
            cy={lake.y}
            rx={LAKE.radiusX * scaleX + 4}
            ry={LAKE.radiusZ * scaleZ + 4}
          />
          <ellipse
            className="survey-lake"
            cx={lake.x}
            cy={lake.y}
            rx={LAKE.radiusX * scaleX}
            ry={LAKE.radiusZ * scaleZ}
          />
          <path className="survey-water-ripples" d={`M${lake.x - 9} ${lake.y - 5}h12m-6 8h13`} />
          {getRegionTrails(regionId).map((path, index) => (
            <polyline
              key={index}
              className="survey-trail"
              points={path
                .map((point) => {
                  const mapped = project(point);
                  return `${mapped.x},${mapped.y}`;
                })
                .join(' ')}
            />
          ))}
          {REGION_VOLUMES[regionId].map((volume) => {
            const point = project(volume);
            return (
              <rect
                key={volume.id}
                className="survey-building"
                x={point.x - volume.halfX * scaleX}
                y={point.y - volume.halfZ * scaleZ}
                width={volume.halfX * scaleX * 2}
                height={volume.halfZ * scaleZ * 2}
                rx="1.5"
              />
            );
          })}
          {Array.from({ length: SURVEY_GRID_SIZE ** 2 }, (_, cell) => {
            if (exploredCells.has(cell)) return null;
            const x = EDGE + (cell % SURVEY_GRID_SIZE) * cellSize;
            const y = EDGE + Math.floor(cell / SURVEY_GRID_SIZE) * cellSize;
            return (
              <g key={cell} data-unexplored-cell={cell}>
                <rect
                  className="survey-fog"
                  x={x}
                  y={y}
                  width={cellSize + 0.4}
                  height={cellSize + 0.4}
                />
                <rect
                  fill={`url(#${id}-unexplored)`}
                  x={x}
                  y={y}
                  width={cellSize + 0.4}
                  height={cellSize + 0.4}
                />
              </g>
            );
          })}
          <rect fill={`url(#${id}-paper)`} x={EDGE} y={EDGE} width={MAP_SIZE} height={MAP_SIZE} />
        </g>
        <g className="survey-compass" transform="translate(426 55)" aria-hidden="true">
          <path d="m0 5-5 10L0-5l5 20Z" />
          <text y="-12">北</text>
        </g>
        {places.map((place, index) => {
          const point = project(place);
          const known = regionSurvey.places.includes(place.id);
          const selected = selectedPlace === place.id;
          const name = known ? place.name : `待探索地点 ${index + 1}`;
          // Offset labels from dense village/temple markers without changing their true position.
          const above = ['village', 'falls', 'temple', 'watch', 'glacier', 'garden'].includes(
            place.id,
          );
          return (
            <g
              key={place.id}
              role="button"
              tabIndex={0}
              aria-label={name}
              aria-pressed={selected}
              data-place={place.id}
              data-known={known}
              className={`survey-place${known ? ' is-known' : ''}${selected ? ' is-selected' : ''}`}
              transform={`translate(${point.x} ${point.y})`}
              onClick={() => onSelectPlace(place.id)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onSelectPlace(place.id);
                }
              }}
            >
              <title>{name}</title>
              <circle className="survey-place-hit" r="22" />
              <circle className="survey-place-ring" r="19" />
              <circle className="survey-place-disc" r="14" />
              {known ? (
                <g className="survey-place-glyph" aria-hidden="true">
                  <PlaceGlyph kind={place.kind} />
                </g>
              ) : (
                <text className="survey-place-question" y="5" aria-hidden="true">
                  ?
                </text>
              )}
              {(known || selected) && (
                <text className="survey-place-label" y={above ? -24 : 29} aria-hidden="true">
                  {known ? place.name : '待探索'}
                </text>
              )}
            </g>
          );
        })}
        {player && position && (
          <g
            className="survey-player"
            transform={`translate(${player.x} ${player.y})`}
            role="img"
            aria-label="你的位置"
          >
            <circle className="survey-player-halo" r="16" />
            <g transform={`rotate(${(-position.heading * 180) / Math.PI})`}>
              <path className="survey-player-cone" d="M0 0-12-26Q0-33 12-26Z" />
              <path className="survey-player-arrow" d="M0-10 7 7 0 4-7 7Z" />
            </g>
          </g>
        )}
        <g className="survey-scale" aria-hidden="true">
          <path d={`M40 431v5h${20 * scaleX}v-5`} />
          <text x={40 + 10 * scaleX} y="449">
            20 米
          </text>
        </g>
      </svg>
      <div className="survey-legend" aria-label="地图图例">
        <span>
          <i className="survey-legend-known" />
          已探索
        </span>
        <span>
          <i className="survey-legend-fog" />
          待探索
        </span>
        {player && (
          <span>
            <i className="survey-legend-player" />
            当前位置
          </span>
        )}
      </div>
    </div>
  );
}
