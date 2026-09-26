import {
  ArrowRight,
  CalendarCheck,
  Compass,
  Heart,
  Map,
  Navigation,
  Shield,
  Wind,
} from 'lucide-react';
import { getDialogModel, type DialogProps } from './types';

export default function GuideDialog(props: DialogProps) {
  const { closeModal } = getDialogModel(props);
  return (
    <div className="guide">
      <div className="eyebrow">YOUR JOURNEY STARTS HERE</div>
      <h2>你是冒险者，伙伴在身旁。</h2>
      <div className="guide-item">
        <Navigation />
        <div>
          <b>自由移动，带上伙伴</b>
          <p>
            WASD
            或方向键控制主人公，空格跳跃，拖拽镜头。也可以点击地面或使用手机摇杆。点击左下角头像选择随行宠物。
          </p>
        </div>
      </div>
      <div className="guide-item">
        <Wind />
        <div>
          <b>骑上星翼，飞过山湖</b>
          <p>
            让星翼形态烁牙（累计打卡 6 次）或已捕获的绮露随行，点击“骑乘起飞”或按 F。WASD
            控制方向，空格上升，Shift / Ctrl 下降，再按 F
            自动寻找空地降落。手机使用摇杆和升降按钮。飞行中需落地才能拾取符印或结识宠物。
          </p>
        </div>
      </div>
      <div className="guide-item">
        <Map />
        <div>
          <b>每天打开，发现新的世界</b>
          <p>
            六个到访日依次开启原野、水、火、土、钢、妖精场景。不必连续，不会因为漏一天失去进度。旅行地图中可重访所有已解锁场景。
          </p>
        </div>
      </div>
      <div className="guide-item">
        <Heart />
        <div>
          <b>探索、结识、一起出发</b>
          <p>
            新场景中先收集三个属性符印，再去祭坛接近野生宠物。光点进入绿色区域时点击安抚，成功三次即可捕获。失误可重试，也可放慢光点。
          </p>
        </div>
      </div>
      <div className="guide-item">
        <Compass />
        <div>
          <b>寻访奇观，进入神庙</b>
          <p>
            旅行地图的景点列表可以带路到村庄、瀑布、冰川和遗迹。在神庙门前按 E
            或点击进入，按碑文顺序点亮三座光印，再走进殿堂深处领取地区遗物。殿内点击光印名字可自动带路，走近后按
            E 交互。每区遗物会永久收入伙伴页的收藏。
          </p>
        </div>
      </div>
      <div className="guide-item">
        <CalendarCheck />
        <div>
          <b>学习在别处，打卡在这里</b>
          <p>
            完成学习后确认打卡，每天获得 40
            XP，让烁牙逐渐进化。到访解锁和学习打卡各自记录。演示世界可模拟明天，真实进度独立保存。
          </p>
        </div>
      </div>
      <div className="guide-item">
        <Shield />
        <div>
          <b>保存你的旅程</b>
          <p>
            进度保存在当前浏览器，刷新不会丢失。清除浏览器数据会清空本地存档。任务条可以随时收起或展开。
          </p>
        </div>
      </div>
      <button className="primary" onClick={closeModal}>
        出发吧
        <ArrowRight size={17} />
      </button>
    </div>
  );
}
