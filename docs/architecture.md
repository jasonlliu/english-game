# 架构与持续迭代

项目围绕「每日打卡 → 到访解锁 → 探索与宠物收集」组织。游戏规则、持久状态、界面和 3D 资源分别维护，场景不直接写存档。现有真实/演示存档键保持兼容。

## 目录与依赖方向

```text
src/
  App.tsx                     组合应用控制器与界面
  app/
    useAdventureController.ts 导航、弹窗、交互反馈
    useGameSession.ts         React 订阅与浏览器生命周期
    worldTelemetry.ts         位置/高度独立订阅
    presentation.ts           界面标签和图标映射
  game/                       纯规则、数据类型、session 与存档
  audio/                      声音偏好、激活/暂停控制、按需合成引擎
  features/
    hud/                      常驻界面、任务栏、小地图
    dialogs/                  地图/图鉴/打卡/奖励等独立入口
  loading/                    模块加载去重、失败重试、场景装配
  components/
    WorldScene.tsx            室外输入、移动、镜头和动画编排
    TempleScene.tsx           神庙交互与谜题呈现
    CompanionPortrait.tsx     头像可见性与加载状态
    CaptureGame.tsx           安抚小游戏
  rendering/
    models/                   主角、宠物模型工厂
    world/                    地形、植被、水面、光照等环境模块
    scenery/regions/          各地区独立景观工厂
    temple/                   神庙内部环境与生命周期
    portraits/                头像渲染队列和缓存
  styles/                     按 shell/adventure/flight/temple/loading 分组
```

依赖方向为 `界面 → 应用命令 → 游戏规则`，以及 `场景编排 → 渲染工厂 + 游戏导航规则`。`game/` 不依赖 React、Three.js 或界面；类型引用使用 `import type`，避免类型关系引入运行时代码。新增数据继续放入对应领域，不建立包含所有功能的总入口。

`session` 是持久状态的入口，领域转换仍是可独立测试的纯函数。HUD/弹窗只发送命令、显示成功或拒绝结果。位置和高度通过独立订阅更新小地图/飞行栏，移动不触发整棵界面和存档层重新渲染。具体存档契约见 [游戏状态与存档](architecture-state.md)。

## 添加地区

1. 在 `game/adventure.ts` 的 `RegionId`、`REGION_IDS`、`REGIONS` 添加地区定义和解锁信息；配套补齐属性图标、任务文案与伙伴定义。编译器会指出未覆盖的 `Record<RegionId, ...>`。
2. 在 `game/landmarks.ts` 添加景点、碰撞体和可达目标；在 `game/world.ts`、`rendering/world/themes.ts` 配套定义地形/植被/配色。物理范围必须与实际建筑一致，飞越净空也使用这份数据。
3. 创建 `rendering/scenery/regions/<id>.ts`，导出 `createRegionScenery()`。工厂每次返回新的 `group`、`update`、`dispose`，不能复用上一场景已释放的 GPU 对象。
4. 在 `rendering/scenery/registry.ts` 注册字面量 `() => import('./regions/<id>')`。地区文件通过共享 kit 复用几何构造，不静态导入其它地区工厂。
5. 如有神庙，补齐 `game/temple.ts` 主题/谜题数据、外部入口和室内环境映射；若室内内容很大，继续拆出独立工厂按地区加载。
6. 补齐解锁、存档恢复、导航可达和碰撞测试，并更新 `scripts/check-bundles.mjs` 的地区列表和经过测量的预算。

扩建按地区推进：当前原野边界为 ±108，其余地区仍为 ±72。地图、地面导航与飞行统一读取 `getWorldBounds(region)`，不要在新功能中写死全局边界。地标的显示位置、可达观察点与实体碰撞体分别登记；新增路线必须测试双向可达，包括角色已贴近墙壁后重新寻路的情况。

常驻界面中的地区/伙伴总数从注册数据读取。当前解锁规则仍是一日一地；新增地区若改变玩法，先修改规则与测试，不把例外条件散落在 UI 和渲染器里。

## 添加功能或弹窗

先定义规则、存档默认值与迁移，再通过 session 暴露命令。Controller 处理短期交互状态，功能视图放入 `features/`。新弹窗通过 `dialogs/DialogHost.tsx` 的动态注册表接入，`ModalShell` 统一负责关闭、焦点约束和暂停背景。不要在 `App.tsx` 或 HUD 中静态导入弹窗的重型依赖。

每个长生命周期资源由创建它的模块负责释放。React 卸载、场景切换、初始化异常与 WebGL context 丢失都应走同一条清理路径。模块加载失败可以重试；旧加载结果不会挂载到已离开的界面。室外场景就绪前禁用飞行操作，导航请求则在场景初始化后交付。

## 开发与验证

使用 Node.js 22，`npm ci` 安装锁定依赖。提交前运行：

```sh
npm run check
```

它依次检查格式、严格类型与未使用代码、游戏/存档/加载/资源生命周期测试、生产构建和体积预算。GitHub Actions 在 push/PR 时运行相同命令，并保存 `bundle-report.json`。测试中的存储与日期可注入，不依赖开发者真实存档。

架构回归测试检查领域依赖方向，以及从入口、WorldScene、每个地区递归追踪的静态运行时依赖。构建检查再验证最终 manifest 的静态闭包与独立产物，两层检查防止共享桶文件悄悄把地区合回首包。

界面或场景编排变化还需用生产预览验证一次：首次进入、快速切区、图鉴开关、飞行与降落、神庙出入、窄屏布局及控制台错误。自动测试不替代真实 WebGL 视觉检查。

## 声音接入

`app/useGameAudio.ts` 管理音频控制器的生命周期，HUD 单独订阅声音状态。`audio/controller.ts` 处理交互激活、页面可见性、静音和独立偏好存储；只有首次有效交互才动态加载 `audio/engine.ts`。播放状态与游戏存档无依赖。

游戏命令成功后发送 `SoundCue`，3D 场景/小游戏通过 `onSound` 回调表达意图，不直接创建 AudioContext 或写声音设置。新反馈事件在 `audio/types.ts` 和引擎中注册；避免在动画帧、普通渲染或状态更新函数中播放奖励音效。

资源加载策略与部署约束见 [资源与性能](resource-loading.md)。

## 移动、步态与地区生物

`game/locomotion.ts` 负责与渲染无关的速度积分、减速、追随和连续步态相位；室外与神庙复用同一套函数。场景提供碰撞 resolver，只有碰撞之后实际走过的距离才推进步态。键盘 Shift 和触屏奔跑开关驱动同一个奔跑意图；飞行仍由独立飞行状态机处理，Shift 在空中保持下降语义。

模型接收 `animate(time, weight, jump, { phase, run })`。不要恢复为 `time * 当前速度`：改变速度会跳到另一个相位，导致腿脚抖动。髋、膝和脚踝使用连续支撑/摆腿轨迹，人物与不同体型的宠物可以拥有不同步幅。停止、阻挡、不同帧率和重新起步均通过纯模拟测试。

随行目标来自角色刚走过的轨迹。宠物只在持续受阻后重新寻路，正常跟随不每帧运行 A\*，并使用速度随距离变化的追赶和到达减速。低频位置遥测继续与 React 界面更新隔离。

地区专属动物随该地区景观模块加载。`RegionScenery.update` 的可选第三参携带位置、帧间隔和是否奔跑，供动物作出反应；暂停时传入 `delta: 0`。动物不得直接访问应用存档。固定群体上限、共享几何与材质，并由地区工厂统一释放，扩展一个地区不会让其它地区同时加载其动物资源。

## 原野寻秘

`discovery.ts` 定义地点坐标、阶段、日期传闻与纯规则；`session.investigateDiscovery` 是唯一持久化入口。`discoveryProximity.ts` 区分可重读的附近物件与伙伴感知的未解线索，暂停、飞行、跳跃时禁止调查。场景只传当前角色位置与交互意图，Controller 核对弹窗、室内、模式与地区后调用 session。

原野 `secrets.ts` 根据 `SceneryFrame.discovery/today` 恢复模型外观，`discoveryInteraction` 仅传递敲铃动画事件；模型不授奖或读写存档。场景点击必须检查物件及所有父容器可见性，再核对当前开放地点，隐藏的阶段物件不能被射线选中。每日宝匣只保留一个模型并随日期移动；同行萤火仅在原野完成收藏后显示。

新增发现应同时考虑坐标可达、线索方向、前置条件、重访、重复操作、存档恢复和按需分包。地图保留普通景点导航，秘密通过线索和近距离观察发现。

## 原野活动与自然观察

`game/fieldActivities.ts` 定义竞速和观察的纯状态机，以及第六个持久领域 `field`。`components/fieldActivityRuntime.ts` 负责同一场景内的临时活动编排、候选动物、一次性完成通知和低频 UI 快照；WorldScene 注入位置、速度、暂停/飞行状态和动物只读观察视图，不直接写存档。`FieldActivityHud` 同时提供键盘和触屏入口，`FieldNotebook` 在懒加载的探险手记中展示纪录。

`RegionScenery.wildlife?()` 是可选的只读动物接口；地区可以独立提供物种、位置和惊逃状态。观察中 `SceneryFrame.observingId` 驱动目标标记；`SceneryFrame.race` 驱动原野工厂的竞速圆环。圈数、倒计时和观察记录由规则决定，渲染只提供反馈。

场景卸载会结束临时活动，持久纪录仅通过 session 更新。新增活动时补起点/路线可达、暂停/离场、中断与重试、重复奖励以及真实/演示存档隔离回归。不能让地区内部模型直接调用 UI 或保存奖励。
