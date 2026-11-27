# DSH Fish Reader — Backlog

## UI

- [ ] **没有正在阅读的书时，隐藏 composer 工具栏的三个按钮**
  - 当前行为：`ReaderToolbar` 在没有 active book 时仍渲染三个禁用按钮。
  - 目标：没有书时不渲染进度/上一段/下一段/眼睛这一组按钮；打开书后再显示。
  - 保留：有书但阅读被隐藏、或处于输入模式时，这三个按钮仍显示。
  - 实现入口：`client.js` 的 `ReaderToolbar`，无 active 时 `return null`。
  - 同步修改：README、`docs/USER-GUIDE.md`、`docs/USER-GUIDE.en.md` 中“无书时三个按钮禁用”的说明。
  - 验证：无书→打开书→隐藏阅读→输入模式→关闭书，检查按钮出现/消失和工具栏换行。

## Other

- [ ] 动态测量输入框 editor 的实际位置，替代 `.sr-input-line` 的固定 top/height。
- [ ] 增加 `Alt+B`（可自定义）打开书库，解决侧边栏折叠时书本入口不可见。
- [ ] 为 store/UI 增加 fake IndexedDB 测试（输入模式、导入失败、搜索跳转）。
- [ ] 发布前清理本地 `.npmrc` 并撤销 npm Access Token。
