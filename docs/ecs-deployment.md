# ECS 静态部署

## 目标与范围

- 项目：曙光旷野 / english-game，源码来自执行发布时的当前工作区；清单记录 Git revision、工作区状态与源码 SHA256。
- 用户确认复用实例 `i-2zeb1trybvkcp8s281v5`，地域 `cn-beijing`，已有 Workbench profile `bigdream`。
- 入口：`https://47.94.56.16/english-game/`；演示为同一地址附加 `?mode=demo`。
- 服务器：Alibaba Cloud Linux 3 / x86_64。现有 nginx 提供 TLS，沿用原 HTTPS 站点的 Basic Auth。游戏不新开端口、不改变安全组，不修改 BigDream 应用、配置、数据库或进程。
- HTTPS 证书由原有续签任务维护；游戏只添加精确路径，不修改证书及续签规则。

## 文件与运行方式

```text
/opt/english-game/
  app -> releases/<release-id>
  releases/<release-id>/site/       静态产物
  releases/<release-id>/manifest.json
  deployments/<release-id>/        发布工具、包、状态与 nginx 配置备份
  shared/assets/                   跨版本保留的内容哈希资源
  deployment.lock                 同项目互斥激活锁
```

源项目为 Vite / React / Three.js。发布使用本机 Node 22+ 在独立快照中构建，Vite base 为 `/english-game/`。只上传 HTML、favicon、哈希资源和公开版本标识；不上传源码、`.env`、凭证、数据库、node_modules 或浏览器存档。源码文件哈希清单在本地发布临时目录保留，服务器保存清单总指纹。

服务器只需要已有 Python 3.6+、tar/gzip 读取能力、nginx、curl 与 systemd。没有游戏常驻服务或数据库迁移。配置片段位于 `/etc/nginx/english-game.locations.conf`，原 `/etc/nginx/conf.d/bigdream.conf` 的 TLS server 增加一行 include，继续继承其访问密码。

HTML 与 `release.json` 使用 `Cache-Control: no-cache`，`assets/` 使用一年 immutable 缓存。缺失资源返回 404，不用 HTML 冒充 JS。只有明确列出的游戏入口会被提供，发布清单和构建报告不对外提供。

## 发布与核验

1. `npm run check` 与 `npm run test:deploy`。
2. `npm run deploy:ecs -- --dry-run`：检查当前工作区快照、子路径构建、资源预算与静态包，不访问 ECS。
3. `npm run deploy:ecs -- --stage-only --release <id>`：上传到独立发布目录，校验整包和逐文件哈希、归档路径、类型、大小与完整清单。相同 ID 不覆盖。
4. `npm run deploy:ecs -- --status <id>`：读取持久状态及实际 app 指向。Workbench 命令成功本身不代表发布成功。
5. `npm run deploy:ecs -- --activate <id>`：复验候选与共享资源哈希、现有认证和站点配置，保存 nginx 备份，原子切换链接；nginx 配置测试后 reload。自动验证本机 TLS、游戏及原站的未认证 401，以及 BigDream 内部服务仍可访问。
6. 额外验证公网 HTTPS 证书、带认证的 HTML 与每个静态文件、缓存头、缺失资源 404、版本标识，并在浏览器检查真实游戏与手机尺寸。脚本的 `active` 是本机激活结果，不冒充完整浏览器验收。

默认不带模式参数时执行构建、stage 与 activate。构建在本机完成，远端操作是短时静态文件校验和切换，无服务器依赖安装或长时间构建任务。

## 数据与回退

所有旅程数据仍保存在访问者的 localStorage，真实/演示隔离。原 localhost 存档不会自动转移到公网 HTTPS 来源；服务器发布不会清空已有同来源存档。没有账号或云同步。

发布保留旧 release 和共享哈希资源，不自动清理。后续代码回退使用 `npm run deploy:ecs -- --activate <旧ID>`，不会修改客户端存档。未来若改变存档 schema，仍须先检查旧代码兼容性，不能仅因静态文件可回退就认定数据兼容。

激活期间 nginx 检查、reload 或健康检查失败，会尝试恢复旧链接、旧配置并重新 reload；首次发布则恢复发布前配置并移除新增 app 链接。若恢复失败，状态为 `recovery-required`，应根据该发布的 `nginxBackup` 和 `previous` 先恢复，不直接重跑。机器断电或进程被强制终止时，检查 `activating` 状态、实际链接及配置备份后再操作。

首次发布没有旧游戏版本；可恢复 nginx 备份以撤下游戏入口。BigDream 的数据备份和服务发布仍由它自己的发布流程负责。

## 本次发布记录

- 状态：已部署并完成公网与浏览器验收。激活时间 `2026-09-26 22:52:42 CST`，最终核验 `22:58 CST`。
- 有效版本：`20260926-coast-r2`，源码 revision `2ee4ac37aeac3d0a595647d3fd4e7f6e1544a5bb`，来自无未提交修改的工作区。
- 源文件清单 SHA256：`fdde5a364e35e15f22dd77a51b9d8ce7d7c5ce1712164adefd941bc7bcc884da`。
- 静态归档 SHA256：`80c3777371c7dc764bc688803e9cef526c63c268de9799ec8bba0b9664657768`；39 个公开静态文件逐一通过公网下载与哈希比对。
- 实际指向：`/opt/english-game/app -> /opt/english-game/releases/20260926-coast-r2`。无新的游戏进程、端口、数据库或服务器密钥。
- 登录使用原站用户名 `bigdream` 及原访问密码；密码不写入本项目。
- 项目全检查：274 项 Node 测试、格式、类型、构建与资源预算通过。额外 26 项 Python 发布测试覆盖归档校验、并发配置保护、临时链接失败和恢复流程。
- 公网：可信 HTTPS、原站及游戏未认证 401、认证后页面成功、39 文件哈希与缓存头、目录尾斜杠重定向（保留 query）、缺失资源 404、内部清单不公开均通过。原站首页会先返回 307，跟随其站内跳转后成功。
- 浏览器：通过仅监听本机、仅允许读取游戏路径的临时认证代理检查云端真实产物；原野、世界地图、模拟次日解锁湖境、地区切换、手机 390×844 布局与演示打卡奖励均成功；刷新保留湖境与解锁状态。未出现 console error/warn。代理与测试标签已关闭，视口覆盖已恢复。
- 共存检查：BigDream 保持 `active`，MainPID `26951`、NRestarts `0`，与发布前一致；nginx 正常。未执行 BigDream 数据库操作，无需应用数据备份或迁移。
- nginx 当前游戏片段 SHA256：`61299f43ac591a1a7e4b9674b8ded13e33925934dcd3a77a3a28ea0310c20d14`。本次配置备份位于 `/opt/english-game/deployments/20260926-coast-r2/nginx-before-20260926T145242748329.conf`。

首个候选 `20260926-coast-r1` 在公网验收发现 nginx 对以斜杠结尾的首页 URI 错误追加 index 文件名；静态资源可用但首页 500。r2 已修正目录 alias 并完整验收，r1 仅保留诊断记录，**不要作为回退目标**。后续版本应以 r2 作为首个可用基线。

首次部署前的完整 nginx 站点配置仍保存在 r1 的 `nginx-before-*.conf`，其 SHA256 为 `21872e4c5a328e5a6391829ee252a80790e412dee041a957f169dde4747793ec`。若要撤下游戏，可在确认无后续其它站点改动后恢复该备份，执行 nginx 配置检查再 reload；不要拿 r2 的备份冒充部署前配置。失败恢复已通过隔离测试，未在生产人为制造中断或演练撤站。
