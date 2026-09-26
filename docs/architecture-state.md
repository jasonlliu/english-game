# 游戏状态与存档

`src/game/` 保存纯规则，`src/game/session.ts` 负责应用命令、存档与订阅。
`src/app/useGameSession.ts` 连接 React 和浏览器事件；`useAdventureController.ts` 负责界面反馈、弹窗与场景导航。
领域与 session 不依赖 React、Three 或场景对象。

## 状态边界

`getSnapshot()` 返回稳定快照：`mode`、`progress`、`expedition`、`adventure`、`templeProgress`、`discovery`、`field`、`survey`、`today`、`storageWarning`。
未改变的数据保留对象引用；一次命令在全部变化完成后通知订阅者一次。调用方应把快照视为只读数据，不直接修改数组或嵌套字段。

| 领域                 | 内容                                   | localStorage key（`{mode}` 为 `real` / `demo`） |
| -------------------- | -------------------------------------- | ----------------------------------------------- |
| `progress.ts`        | 打卡收据、日期、XP、进化               | `rune-island.progress.{mode}.v1`                |
| `exploration.ts`     | 原野光晶、宝箱、星砂                   | `rune-island.exploration.{mode}.v1`             |
| `adventure.ts`       | 到访日、地区、伙伴、地区符印           | `rune-island.adventure.{mode}.v1`               |
| `temple.ts`          | 六地神庙遗物                           | `rune-island.temple.{mode}.v1`                  |
| `discovery.ts`       | 原野线索、风铃谜题、永久收藏、每日邮票 | `rune-island.discovery.{mode}.v1`               |
| `fieldActivities.ts` | 五种动物观察、竞速最好成绩             | `rune-island.field.{mode}.v1`                   |
| `worldSurvey.ts`     | 各地区已发现地标、已揭示地图格         | `rune-island.survey.{mode}.v1`                  |

当前记录均为 `version: 1`，真实与演示各有七份独立领域存档。旧 `load*` / `save*` 函数保持兼容；交互界面统一通过 session，不再组合多组 loader、writer 或临时存档 ref。
角色位置、飞行遥测、镜头、弹窗、路线和提示不属于持久游戏快照。

## 命令与同步

`checkin`、`collect`、`openTreasure`、`newExpedition`、`resetDemo`、`simulateTomorrow`、`enterRegion`、`capturePet`、`choosePet`、`claimTemple`、`investigateDiscovery`、`recordWildlife`、`recordMeadowRace`、`recordSurvey` 委托已有纯规则。
`collect(id, expectedRegion?)` 根据当前地区选择原野光晶或地区符印。场景应传入事件所属地区；若外部存档已切区，旧场景事件会被拒绝。奖励提示应检查命令返回的成功标志与地区，而不是依赖点击前的界面状态。
`claimTemple(region)` 只允许当前已解锁地区；光印机关是否完成由神庙界面负责验证。

`investigateDiscovery(id, position, expectedRegion)` 验证事件地区、有限坐标、3.5 单位交互距离与线索前置条件。永久藏品和每日邮票属于独立领域，不发放打卡 XP，也不随 `newExpedition` 清除。错误铃只重置尚未完成的旋律；完成的机关不能被重置。日期收据最多保留 366 条，并拒绝早于保留窗口的重复补领。

`recordWildlife(species, expectedRegion)` 和 `recordMeadowRace(seconds, expectedRegion)` 只接受原野事件，过滤未知物种与非法成绩。运行中的竞速、观察驻留在场景本地推进，不写每帧存档；完成事件通过 Controller 核验模式、地区、暂停与飞行状态后提交。观察徽章与最好成绩不影响打卡 XP，也不随 `newExpedition` 清除。

`recordSurvey(position, expectedRegion, expectedMode)` 记录实际位置附近的探索足迹，提交时核对刷新后的模式、当前地区与解锁状态。有限且在地区边界内的坐标才能记录；步行和飞行均可探索，神庙内部坐标不提交室外地图。`surveyPosition` 只揭示当前格及周围一圈（12×12 地区网格），不在相隔的采样点之间插值，避免传送误记路线。距离 10 米以内的 `REGION_PLACES` 地标记录为已发现。`getRegionSurvey` / `getWorldSurvey` 的百分比仅按地标计数，当前全世界分母为 27，包含尚未解锁地区；迷雾格数量不参与百分比。

命令先读取最新干净存档，再执行规则；同步连续操作不必等待下一次 React 渲染或 `storage` 事件。`recordSurvey` 对已探索位置有提前返回：没有新地标或地图格、且没有存储警告时，不读取、序列化或写入存档，也不通知订阅者。确有新发现的尝试仍先刷新，避免覆盖其它标签页的记录；存储警告期间绕过此优化，保证失败写入可以重试。
`refresh` / `load` 不改变等价数据，不反复保存同日到访；日期采用本地日历日。
初始化会加载存档并记录今日首次到访。重复创建 session 或 StrictMode 重复 effect 不会多记一天或重复授奖；不要在 selector、`getSnapshot` 或普通渲染分支中反复创建 session。

Hook 使用 `useSyncExternalStore`，并管理 focus、重新可见、每分钟刷新和 storage 监听及其清理。
`refreshFromStorage` 忽略无关 key 和非当前模式的 key；`key === null` 对应清空存储并重新读取当前模式。
地区与已收录伙伴仍经过 sanitizer，外部非法记录不能把玩家直接放入锁定地区。

## 写入失败与迁移

Session 按模式、领域保存未写入成功的内存值。脏值不会被较旧磁盘数据覆盖，往返真实/演示模式也不会丢失。
后续命令或刷新只重试待写入项；所有待写入项恢复且读取正常后，`storageWarning` 清除。成功写入的等价状态不会因 focus 或计时器再次写入。
关闭页面仍会丢失尚未成功写入的内存值；当前方案没有后端同步，也不提供多个标签页同时写入的事务合并。

Adventure 迁移必须在**验证地区解锁与过滤伙伴之前**合并 `progress.completedDates`。
不能先用缺失到访日的旧记录清理伙伴，再补日期：那会永久丢掉原本应保留的地区、伙伴和符印。
迁移形成的变化单独标为待保存，即使今日已经包含在旧打卡日期中，也会持久化一次。

旧版没有 `survey` 时创建空地图记录，保留其它六个领域，不从到访解锁、寻宝或任务完成记录推断已经走过的地点。新版足迹从实际位置采样开始。`newExpedition` 保留长期地标与足迹；`resetDemo` 只清空演示地图，真实记录不变。地图 sanitizer 按注册地标顺序与地图格数字顺序规范化数据，过滤未知 ID、重复项、越界格和模式不符的数据，保持后续刷新引用稳定。

## 扩展与验证

1. 在对应领域新增类型、默认值、sanitizer 和纯转换，保持输入不变，并定义重复操作的结果。
2. 在 session 增加命令，使用现有事务和 `replace`，不要在 UI 新增直接 `localStorage` 写入。
3. 若新增独立领域，同时补齐 snapshot、每模式 bundle、key 注册、读取解码和适用的演示重置；存档结构不兼容时明确升级版本并测试迁移。
4. Controller 根据返回值展示结果；场景只发送交互意图，不决定或直接写入奖励。

测试通过 `GameStorage` 和 `today` 注入完成，不需要浏览器或真实存档：

```ts
const session = createGameSession({
  mode: 'demo',
  storage: memoryStorage,
  today: () => '2026-09-26',
});
session.checkin('review-mission');
session.getSnapshot();
```

运行 `node --import tsx --test tests/session.test.ts` 检查 session，运行 `npm test` 检查全部领域规则。
关键回归包括：重复领奖、快照引用稳定、同日刷新零写入、外部更新、旧日期迁移不丢伙伴、锁区过滤、模式隔离、quota 失败往返、恢复保存、换日与重新进入幂等。
