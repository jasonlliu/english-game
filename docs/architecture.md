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

资源加载策略与部署约束见 [资源与性能](resource-loading.md)。
