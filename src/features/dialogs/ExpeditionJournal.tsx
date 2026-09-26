import { ArrowRight, Check, Compass, Gift, Sparkles, Sun, Wind } from 'lucide-react';
import {
  getDailyDiscoverySite,
  getDiscoveryObjective,
  type DiscoveryId,
} from '../../game/discovery';
import type { DialogProps } from './types';
import FieldNotebook from './FieldNotebook';

// The narrative stays in this lazy dialog. Only pages already discovered are shown.
const pages: Record<DiscoveryId, { title: string; text: string }> = {
  letter: {
    title: '旧路牌上的信',
    text: '雨水把信纸的边缘染成了浅褐色。有人请后来者找回一串失落的风铃：它的声音曾把迷路的人带回营地。信末留着一片干叶，像是旅人匆匆留下的书签。',
  },
  camp: {
    title: '鹿溪营地手札',
    text: '火堆早已冷却，手札里却还记着一个温暖的清晨。旅人把风铃留在了花海，一头小鹿从帐篷旁经过。沿溪边找一找，湿润的泥土还替它保存着脚步。',
  },
  'track-1': {
    title: '溪畔蹄印',
    text: '浅浅的蹄印停在水边，又转向了草丛。小鹿在这里喝过水，草尖还挂着细小的水珠。前面的枝叶低垂，像被一个轻巧的身影碰过。',
  },
  'track-2': {
    title: '折枝旁的蹄印',
    text: '一小截折枝上缠着褪色的线。脚印绕过它，朝石坡继续延伸。脚步与旧绳，似乎把旅人的路线重新串了起来。',
  },
  'track-3': {
    title: '石坡上的蹄印',
    text: '泥土在石头之间渐渐变干，脚印也淡了。坡边落着最后一缕布线，附近藏着旅人遗落的旧木匣。你放慢脚步，听见草叶下轻轻的一声响。',
  },
  cache: {
    title: '旅人的旧木匣',
    text: '匣底不是风铃，而是一段旧歌谣：“泉水先醒，清风接声，最后让星光作答。”三枚铃的回声会替花房打开珍藏已久的门。',
  },
  vault: {
    title: '花房里，声音又回来了',
    text: '花房深处的匣子缓缓开启，回响风铃终于回到旅途之中。你轻轻摇响它，草间的萤火像听懂了约定，开始陪着你的脚步。那位旅人的故事，也留在了你的手记里。',
  },
};
const bellNames = ['风', '泉', '星'];

export default function ExpeditionJournal({
  discovery,
  field,
  today,
  adventure,
  closeModal,
  setPanel,
}: Pick<DialogProps, 'discovery' | 'field' | 'today' | 'adventure' | 'closeModal' | 'setPanel'>) {
  const objective = getDiscoveryObjective(discovery);
  const knowsRumor = discovery.found.includes('letter');
  const knowsSong = discovery.found.includes('cache');
  const stampedToday = discovery.dailyFinds.includes(today);
  const daily = knowsRumor ? getDailyDiscoverySite(today) : null;
  return (
    <div className="expedition-journal">
      <div className="eyebrow">NOTES FROM THE MEADOW</div>
      <h2>原野探险手记</h2>
      <p className="journal-intro">挑战风速，认识原野的邻居，再寻找旅人留下的秘密。</p>
      <FieldNotebook field={field} />

      <section className="discovery-current" aria-labelledby="discovery-current-title">
        <div className="discovery-section-heading">
          <Compass size={18} />
          <span>{discovery.completed ? '这一程，已留在纸上' : '眼下的线索'}</span>
          <small>
            {objective.stage} / {objective.total}
          </small>
        </div>
        <progress value={objective.stage} max={objective.total} aria-label="失落的风铃探索进度" />
        <h3 id="discovery-current-title">{objective.title}</h3>
        <p>{objective.hint}</p>
        {adventure.currentRegion !== 'meadow' && (
          <p className="discovery-away">这些线索留在原野。下次回访时，可以从这里继续。</p>
        )}
        <button className="discovery-text-action" onClick={closeModal}>
          {discovery.completed ? '继续漫步' : '带着线索出发'} <ArrowRight size={15} />
        </button>
      </section>

      <section className="discovery-pages" aria-labelledby="discovery-pages-title">
        <div className="discovery-section-heading">
          <Wind size={18} />
          <h3 id="discovery-pages-title">沿途留下的记忆</h3>
        </div>
        {discovery.found.length === 0 ? (
          <p className="discovery-empty">
            这一页还空着。去看看出生地西北边的旧路牌吧，第一封信正在那里等你。
          </p>
        ) : (
          <ol>
            {discovery.found.map((id, index) => (
              <li key={id}>
                <span className="discovery-page-number">{String(index + 1).padStart(2, '0')}</span>
                <div>
                  <h4>{pages[id].title}</h4>
                  <p>{pages[id].text}</p>
                </div>
              </li>
            ))}
          </ol>
        )}
        {knowsSong && (
          <div className="discovery-song">
            <span className="small-kicker">从木匣中抄下的歌谣</span>
            <p>泉水先醒，清风接声，最后让星光作答。</p>
            <div className="discovery-bells" aria-label="按泉、风、星的顺序敲铃">
              {[1, 0, 2].map((id, index) => (
                <span key={id} className={discovery.chimes.includes(id) ? 'is-rung' : ''}>
                  {index > 0 && <i aria-hidden="true">→</i>}
                  <b>
                    {bellNames[id]}铃{' '}
                    {discovery.chimes.includes(id) && <Check size={12} aria-label="已响" />}
                  </b>
                </span>
              ))}
            </div>
            <small>
              {discovery.chimes.length === 3
                ? '三声已连成回响。'
                : '走近铃铛按 E 或点击查看。敲错了，也可以重新听一遍。'}
            </small>
          </div>
        )}
      </section>

      <div className="discovery-keepsakes">
        <section aria-labelledby="discovery-artifact-title">
          <div className="discovery-section-heading">
            <Gift size={18} />
            <h3 id="discovery-artifact-title">旅途藏品</h3>
          </div>
          {discovery.completed ? (
            <div className="discovery-artifact">
              <Sparkles size={29} />
              <strong>回响风铃</strong>
              <p>萤火记得这段旋律，也记得你的脚步。</p>
              <small>永久收藏 · 可随时重读手记</small>
            </div>
          ) : (
            <p className="discovery-empty">给尚未遇见的惊喜，留一个小小的位置。</p>
          )}
        </section>
        <section aria-labelledby="discovery-rumor-title">
          <div className="discovery-section-heading">
            <Sun size={18} />
            <h3 id="discovery-rumor-title">今日传闻</h3>
            <small>{today.slice(5).replace('-', '.')}</small>
          </div>
          {stampedToday ? (
            <p className="discovery-stamped">
              <Check size={17} />
              今天的旅途邮票已收好。
            </p>
          ) : (
            <p>{daily?.clue ?? '读过旧路牌上的信后，原野会向你透露今日的小秘密。'}</p>
          )}
          <div className="discovery-stamp-count">
            <span>旅途邮票</span>
            <b>
              {discovery.dailyFinds.length}
              <small> 枚</small>
            </b>
          </div>
          <small className="discovery-daily-note">
            每天藏在不同的角落，一天可收好一枚。明天会有新的传闻。
          </small>
        </section>
      </div>

      <div className="discovery-footer">
        <button className="discovery-text-action" onClick={() => setPanel('map')}>
          翻看旅行地图 <ArrowRight size={14} />
        </button>
        <button className="primary" onClick={closeModal}>
          合上手记 <ArrowRight size={15} />
        </button>
      </div>
    </div>
  );
}
