import { FIELD_GUIDE } from '../../game/fieldGuide';
import {
  FIELD_SPECIES,
  GOLD_RACE_TIME,
  SILVER_RACE_TIME,
  getRaceRating,
  type FieldProgress,
} from '../../game/fieldActivities';

const medals = { gold: '金色风翼', silver: '银色风翼', bronze: '铜色风翼' };
export default function FieldNotebook({ field }: { field: FieldProgress }) {
  const best = field.raceBest;
  return (
    <section className="field-notebook" aria-label="原野活动记录">
      <div className="field-notebook-title">
        <span>PLAY & DISCOVER</span>
        <h3>让这趟旅行有点不一样</h3>
      </div>
      <div className="race-notebook">
        <span aria-hidden="true">⚑</span>
        <div>
          <h4>风车竞速</h4>
          <p>出生地右侧的橙色旗帜旁，按 R 或点击开始。奔跑穿过 6 个光环，试试能有多快。</p>
          <small>
            金色风翼 ≤ {GOLD_RACE_TIME} 秒 · 银色风翼 ≤ {SILVER_RACE_TIME} 秒
          </small>
        </div>
        <strong>
          {best === null ? '等你挑战' : `${best.toFixed(2)} 秒`}
          <small>{best === null ? '尚无个人纪录' : medals[getRaceRating(best)]}</small>
        </strong>
      </div>
      <div className="field-notebook-heading">
        <h4>原野自然笔记</h4>
        <b>
          {field.observed.length} / {FIELD_SPECIES.length}
        </b>
      </div>
      <p>
        放慢脚步走近动物，停下来按住 Q 或“观察”3
        秒。奔跑会惊动它们，集齐五种即可获得「原野观察家」。
      </p>
      <div className="field-species-grid">
        {FIELD_SPECIES.map((kind) => {
          const seen = field.observed.includes(kind),
            info = FIELD_GUIDE[kind];
          return (
            <article className={seen ? 'is-observed' : ''} key={kind}>
              <span aria-hidden="true">{info.icon}</span>
              <div>
                <h4>{info.name}</h4>
                <small>{seen ? '✓ 已观察' : '等你认识'}</small>
                <p>{seen ? info.note : '循着它的身影，留下一页观察记录。'}</p>
              </div>
            </article>
          );
        })}
      </div>
      {field.observed.length === FIELD_SPECIES.length && (
        <div className="field-naturalist">
          ✧ 原野观察家 <small>五位原野邻居，已全部记在心里。</small>
        </div>
      )}
    </section>
  );
}
