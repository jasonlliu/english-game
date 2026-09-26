import { useId } from 'react';
import { REGION_IDS, REGIONS, type RegionId } from '../../game/adventure';
import { getRegionSurvey, type WorldSurvey } from '../../game/worldSurvey';

const islands: Record<RegionId, { path: string; x: number; y: number; motif: string }> = {
  meadow: {
    x: 361,
    y: 256,
    path: 'M253 204 280 165 320 182 346 159 383 181 433 178 468 205 454 235 470 269 436 313 389 327 348 308 305 325 283 288 248 276 259 243 237 229Z',
    motif: 'M294 233 310 205 326 233ZM384 225l15-24 15 24ZM408 292l16-29 17 29Z',
  },
  water: {
    x: 325,
    y: 410,
    path: 'M205 395 232 366 270 378 302 350 350 360 388 351 420 384 459 399 447 434 409 455 361 447 335 466 300 450 253 461 215 432Z',
    motif: 'M254 406q18-18 36 0t36 0m27 20q18-18 36 0t36 0',
  },
  fire: {
    x: 568,
    y: 119,
    path: 'M459 112 475 77 507 64 530 27 569 44 600 35 621 65 665 70 680 112 653 139 661 166 623 188 582 165 549 183 519 158 478 158Z',
    motif: 'M504 104 532 58 560 104ZM581 147l26-44 27 44Z',
  },
  earth: {
    x: 129,
    y: 255,
    path: 'M24 238 56 205 52 171 91 154 122 175 165 162 189 191 203 235 192 271 204 302 175 338 134 320 102 341 72 309 36 303 46 269Z',
    motif: 'M81 242 96 215 116 242h23l15 24M70 282h49l20 18h25',
  },
  steel: {
    x: 312,
    y: 87,
    path: 'M209 85 225 56 259 58 280 23 315 36 340 20 372 45 410 49 422 78 400 107 404 130 366 149 333 133 303 145 272 123 234 127Z',
    motif: 'M260 83V62h15v21m75 30V73l12-12 12 12v40m-53-42V49h13v22',
  },
  fairy: {
    x: 647,
    y: 301,
    path: 'M539 288 556 251 586 248 613 218 653 236 693 222 721 252 752 259 766 290 740 322 743 355 705 375 668 359 633 376 605 350 567 355 545 325Z',
    motif: 'M589 285q-8-25 10-31 18 6 10 31Zm88 43q-9-27 11-34 20 7 11 34Z',
  },
};

export default function WorldAtlasChart({
  survey,
  unlocked,
  current,
  selected,
  onSelect,
}: {
  survey: WorldSurvey;
  unlocked: RegionId[];
  current: RegionId;
  selected: RegionId;
  onSelect(region: RegionId): void;
}) {
  const id = useId();
  return (
    <div className="atlas-world-chart">
      <svg viewBox="0 0 800 490" role="group" aria-label="曙光世界地图，选择区域查看探索进度">
        <defs>
          <pattern id={`${id}-sea`} width="45" height="45" patternUnits="userSpaceOnUse">
            <path d="M8 22q7-5 14 0t14 0" fill="none" stroke="#749b9222" />
          </pattern>
          <pattern
            id={`${id}-fog`}
            width="12"
            height="12"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(30)"
          >
            <path d="M0 0v12" stroke="#f0ebd850" strokeWidth="4" />
          </pattern>
        </defs>
        <rect width="800" height="490" rx="20" fill="#ceddd0" />
        <rect width="800" height="490" rx="20" fill={`url(#${id}-sea)`} />
        <path
          d="M135 251Q195 195 360 253T650 300M315 85Q363 145 360 253T325 410M360 253Q487 214 568 120"
          fill="none"
          stroke="#68877b70"
          strokeWidth="2"
          strokeDasharray="4 8"
        />
        <text x="40" y="55" className="atlas-ocean-name">
          曙光群境
        </text>
        <text x="535" y="433" className="atlas-sea-note">
          越过熟悉的风景
        </text>
        {REGION_IDS.map((regionId) => {
          const island = islands[regionId],
            region = REGIONS[regionId];
          const available = unlocked.includes(regionId),
            progress = getRegionSurvey(regionId, survey);
          return (
            <g
              key={regionId}
              role="button"
              tabIndex={0}
              aria-label={`${region.name}，${available ? `探索 ${progress.percent}%，${progress.found} / ${progress.total} 个地标` : `未解锁，第 ${region.day} 个到访日开启`}`}
              aria-pressed={selected === regionId}
              className={`atlas-island ${selected === regionId ? 'is-selected' : ''} ${available ? '' : 'is-locked'}`}
              onClick={() => onSelect(regionId)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onSelect(regionId);
                }
              }}
            >
              <path
                d={island.path}
                transform="translate(0 6)"
                fill="#69867738"
                stroke="#f5f1d4"
                strokeWidth="10"
                strokeLinejoin="round"
              />
              <path
                className="atlas-island-land"
                d={island.path}
                fill={available ? region.color : '#aab5a6'}
                stroke="#faf4d9"
                strokeWidth="3"
                strokeLinejoin="round"
              />
              {!available && <path d={island.path} fill={`url(#${id}-fog)`} />}
              <path d={island.motif} stroke="#46675055" fill="#edf1d642" strokeWidth="2" />
              <rect
                x={island.x - 64}
                y={island.y - 19}
                width="128"
                height="54"
                rx="11"
                fill={available ? '#fcf8e6ee' : '#e3e6d9e8'}
              />
              <text x={island.x} y={island.y + 2} className="atlas-region-name" textAnchor="middle">
                {region.name}
              </text>
              <text
                x={island.x}
                y={island.y + 23}
                className="atlas-region-score"
                textAnchor="middle"
              >
                {available
                  ? `${progress.percent}% · ${progress.found}/${progress.total} 地标`
                  : `第 ${region.day} 个到访日`}
              </text>
              {regionId === current && (
                <g transform={`translate(${island.x},${island.y - 37})`} aria-hidden="true">
                  <circle r="12" fill="#faf5dc" />
                  <circle r="7" fill="#365c4d" />
                  <path d="m0-4 3 6-3-1-3 1Z" fill="#fff4ce" />
                </g>
              )}
            </g>
          );
        })}
        <g transform="translate(735 69)" aria-hidden="true">
          <circle r="23" fill="none" stroke="#59796b55" />
          <path d="m0-28 7 28-7-5-7 5Z" fill="#526e60" />
          <path d="m0 28 7-28-7 5-7-5Z" fill="#8eaa97" />
          <text y="-34" textAnchor="middle" fill="#526e60" fontSize="12">
            N
          </text>
        </g>
      </svg>
      <div className="atlas-chart-caption">
        <span>
          <i /> 你的位置
        </span>
        <span>点击区域 · 查看探索详情</span>
      </div>
    </div>
  );
}
