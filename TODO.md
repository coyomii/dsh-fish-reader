# DSH Fish Reader — Backlog

## UI

- [x] **无书时隐藏三个按钮**（当前决策，本地已完成）
  - 当前行为：`ReaderToolbar` 在没有 active book 时返回 `null`，不渲染按钮。
  - 打开书后三个按钮出现；有书但阅读隐藏/输入模式时，仍按现有规则显示。
  - 外观保持统一：有书时禁用只影响点击，不降低透明度、不换图标。
  - 本轮只改本地，不更新 npm 或 GitHub 远端。

## Other

- [ ] 桌面复测导入结果弹窗：批量进度、逐本改编码“重新解码”、失败项“重试”、批量结束前不可关闭。
- [ ] 动态测量输入框 editor 的实际位置，替代 `.sr-input-line` 的固定 top/height。
- [ ] 增加 `Alt+B`（可自定义）打开书库，解决侧边栏折叠时书本入口不可见。
- [ ] 为 store/UI 增加 fake IndexedDB 测试（输入模式、导入失败、搜索跳转）。
- [ ] 发布前清理本地 `.npmrc` 并撤销 npm Access Token。
