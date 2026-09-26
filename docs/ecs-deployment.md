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

尚在准备。实际 release ID、版本指纹、时间和验收结果在完成发布后补充。
