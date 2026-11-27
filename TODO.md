# DSH Fish Reader — Backlog

## UI

- [x] **无书时隐藏三个按钮**（当前决策，本地已完成）
  - 当前行为：`ReaderToolbar` 在没有 active book 时返回 `null`，不渲染按钮。
  - 打开书后三个按钮出现；有书但阅读隐藏/输入模式时，仍按现有规则显示。
  - 外观保持统一：有书时禁用只影响点击，不降低透明度、不换图标。
  - 本轮只改本地，不更新 npm 或 GitHub 远端。

## 书库备份（待做）

- [ ] **导出 / 导入书库**（v1）
  - 格式：ZIP。`library.json` 清单 + `books/<id>.txt`；正文 UTF-8、`deflate-raw` 压缩（环境不支持或压不小则 stored）；清单带 `format: dsh-fish-reader/backup`、`version: 1`，旧版本插件拒绝新格式。
  - 范围：书库元数据 + 每本正文 + 阅读进度；**不含**阅读设置和快捷键。
  - 导出：入口在设置页「书库备份」区；逐本从 IndexedDB 读正文、压缩后拼成 Blob 触发下载，文件名带日期；显示 `正在导出 3/12` 进度；按钮旁按 `charCount` 估算大小（约 1.4 B/字），估算超过 200 MB 先确认；完成后报告实际大小。
  - 导出选中：复用现有批量选择，支持只备份勾选的书（便于分卷备份）。
  - 导入：校验 zip → 清单 → 版本 → 条目存在性 → 确认弹窗（N 本、M 条进度、现有 K 本）→ 逐本写回 → 结果报告（已恢复 / 已存在跳过 / 失败原因）。
  - 冲突规则：同 `id` 跳过（重复导入幂等）；同 `id` 但 `sourceName` + `charCount` 不符时按新书写入；书名冲突用 `uniqueAlias` 加 ` (2)`，不静默覆盖；进度只补给本次新增的书，cursor 按新正文长度截断。
  - 代码：`core` 增加 `crc32` / `buildZip` / `parseBackupManifest` / `planRestore`（纯函数，可单测）；store 增加 `exportLibrary` / `restoreLibrary`；UI 复用 `ConfirmDialog` 与导入报告弹窗（`mode: 'restore'`，隐藏编码选择）。
  - 测试：CRC32 已知值；`buildZip` 写入后用现有 `parseZipEntries` / `readZipEntry` 回读（stored 与 deflate 两条路径）；清单校验（缺失/版本不符/条目缺失）；`planRestore` 的跳过 / 冲突新 id / 别名后缀。
  - 文档：README、用户指南（数据与备份）、DETAIL（备份格式规范 + 内存与幂等约定）、本文件。
  - 暂不做：分卷导出；设置随备份；仅书单/进度（不含正文）的轻量导出；流式大文件导出。

## Other

- [ ] 桌面复测导入结果弹窗：导入结束后弹出、逐本改编码“重新解码”、失败项“重试”。
- [ ] 动态测量输入框 editor 的实际位置，替代 `.sr-input-line` 的固定 top/height。
- [ ] 增加 `Alt+B`（可自定义）打开书库，解决侧边栏折叠时书本入口不可见。
- [ ] 为 store/UI 增加 fake IndexedDB 测试（输入模式、导入失败、搜索跳转）。
- [ ] 发布前清理本地 `.npmrc` 并撤销 npm Access Token。
