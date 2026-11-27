# DSH Fish Reader

在 DeepSeek Harness 输入框的待输入文字区（placeholder）显示本地 TXT / EPUB 小说正文。打开书后，在未进入输入模式、正文未隐藏时，正文覆盖 placeholder；点击输入框或开始打字立即恢复原来的 placeholder，并进入输入模式，不新增行、不改变输入区高度，底部状态栏不会上下移动。

插件完全运行在 DSH 的浏览器/桌面渲染端：书籍正文、书库元数据和进度保存在本机 IndexedDB 与 localStorage 中。打开、翻页、搜索都不会向当前对话发送消息，也不会调用 DeepSeek 模型。

![DSH Fish Reader 阅读示例](docs/images/reader-example.png)

正文显示在输入框占位区，工具栏按钮位于“完全权限”旁边，右侧是进度和搜索。

> 显示名统一为 **DSH Fish Reader**。包名、slot id、IndexedDB/localStorage 键统一为 `dsh-fish-reader` / `fish-reader`。

## 获取

GitHub 仓库：

```text
https://github.com/coyomii/dsh-fish-reader
```

npm：

```text
https://www.npmjs.com/package/dsh-fish-reader
```

```powershell
git clone https://github.com/coyomii/dsh-fish-reader.git
```

## 安装方法

### 方式一：npm 安装

在 DSH Agent 中执行：

```text
plugin_manager install_bundle
target: dsh-fish-reader@1.2.3
```

或在支持包名安装的 Plugins 入口填入 `dsh-fish-reader@1.2.3`。

也可以直接用 DSH CLI：

```powershell
dsh plugin --profile desktop add dsh-fish-reader@1.2.3
```

`--profile` 按你的实际 profile 名称调整（常见为 `desktop` 或 `web`）。

### 方式二：Plugin Manager 安装本地目录

1. 打开 DSH 的 **插件 / Plugins** 页面。
2. 选择 **添加插件 / Add plugin**。
3. 选择克隆下来的 `dsh-fish-reader` 目录（包含 `package.json` 和 `cordis.patch.yml`）。
4. 安装完成后刷新页面；如果桌面窗口没有出现左侧栏书本图标，按一次 `Ctrl+R` 重新加载渲染端。

### 方式三：让 DSH Agent 安装本地目录

把克隆后的插件目录绝对路径交给支持 Plugin Manager 的 DSH Agent，执行：

```text
plugin_manager install_bundle
target: <你的路径>\dsh-fish-reader
```

安装会修改当前 profile 的 bundle 选择；不会把插件写进工作区以外的源码目录。卸载可用 `remove_bundle`，或 Plugin Manager 中的移除操作。本仓库已在本机 DSH `0.2.2-rc.5` 上验证。

## 使用

1. 点击左侧栏底部的 **书本图标**（在“Remote”旁边），打开 **DSH Fish Reader 书库**。
2. 点 **批量导入 TXT / EPUB**，可一次选择多本，也可以把多个文件拖进书库。TXT 会自动识别并用分块流式方式读取：
   - UTF-8（含 BOM）
   - UTF-16 LE / BE（含 BOM）
   - UTF-32 LE / BE（含 BOM）
   - GB18030
   - Big5

   EPUB 会读取 ZIP 容器中的 `META-INF/container.xml` 和 OPF spine，按章节顺序提取 XHTML 正文；不显示图片、CSS 样式和 EPUB 阅读器分页，只把正文送入单行覆盖层。
   导入结束后会弹出 **导入结果** 窗口：逐本显示成功或失败，成功项显示书名和识别到的编码，失败项显示原因。窗口里每个 TXT 都能单独选编码；成功项点“重新解码”会原地重读，书名、阅读进度和书库条目都不变，失败项点“重试”则重新导入。
   导入只会加入书库，**不会自动切换当前阅读**；需要手动点 **打开** 或 **继续**。
3. 在书库中点击 **打开** 或 **继续**。当不处于输入模式、输入框为空且未聚焦时，正文会显示在输入框的待输入文字区：
   - 正文行右侧：阅读进度、搜索图标；
   - 输入框工具栏 **完全权限旁边**：上一段、下一段、显示/隐藏；
   - 输入框下方：DSH 原有的轮数、用量和缓存状态栏，位置不动。
   没有打开书时，工具栏不显示这三个按钮；书库入口仍是左侧栏底部的书本图标。打开书后三个按钮才出现。
   书库支持 **批量选择**：勾选多本后点“删除选中”，会弹出确认窗口统一删除；只删除导入副本和进度，原始文件不动。单本删除也使用同一个确认窗口。
   书库支持按书名/文件名搜索，并按 **最近阅读 / 导入时间 / 书名** 排序。
4. 点击输入框任意位置，正文立即隐藏并恢复原 placeholder，进入**输入模式**，可以直接打字；之后点击输入框外空白只退出输入，**不会自动恢复小说**。恢复阅读需要显式动作：点工具栏眼睛、按 `Alt+/`、从书库打开/继续，或在阅读隐藏状态下点上一段/下一段。处于输入模式时，上一段/下一段不生效、不翻页。
5. 搜索/跳转：
   - 按 `Alt+F`，或点击正文行内的搜索图标；
   - 输入普通文字后点两侧箭头按钮（悬停显示“查找上一个/下一个”）；`Enter` 是下一个，`Shift+Enter` 是上一个；
   - 点 **正则** 按钮可切换正则模式：直接输入 JavaScript 正则模式（不带 `/.../`，使用 `u` 标志，区分大小写）；正则模式下 `12.5%` 会按正则处理而不是百分比跳转；
   - 命中后搜索框保持打开，可连续查找；右侧显示当前序号/总数（如 `3/17`，超过 20000 个匹配显示 `+`）；
   - 输入 `12%`、`12.5%`：按百分比跳转，`100%` 显示末段；
   - 没有下一个/上一个匹配时保留当前页；错误提示显示在搜索框末尾的固定槽里，框体尺寸不变；`Esc` 或“取消”关闭搜索。
6. 快捷键（默认值如下，可在书库 **设置 → 快捷键** 中逐个修改）：

   | 快捷键 | 操作 |
   | --- | --- |
   | `Alt+,` | 上一段 |
   | `Alt+.` | 下一段 |
   | `Alt+/` | 隐藏阅读 / 显示阅读 |
   | `Alt+F` | 搜索 / 百分比跳转 |

   隐藏后正文和进度消失，输入框回到原生“发消息或创建任务…” placeholder；工具栏按钮仍保留，再按一次恢复同一段。自动隐藏也复用这个动作。输入框已经聚焦且为空时，`Alt+/` 会先让输入框失焦再显示正文；如果输入框里已有文字或附件，则保持不动，避免盖住正在输入的内容。

   自定义方法：点某项右侧的“修改”，按下包含 **Alt / Ctrl / Meta** 的组合键；Esc 取消。可“恢复默认”。工具栏三个按钮各固定为 24px；正文行右侧进度槽 52px、搜索按钮 20px，因此进度从 `0%` 变成 `100%`、或搜索提示出现时，按钮位置不会跳动。

7. 书库 **设置** 页可以调整：
   - 每段最多字数（默认 50；输入框变窄时会自动减少）；
   - 自动隐藏秒数（默认 30；0 表示不自动隐藏；隐藏后回到原生 placeholder）；
   - 下一段是否去除首尾空白；
   - 上一段 / 下一段 / 隐藏阅读 / 搜索的快捷键。
8. 每本书独立保存当前段落的起点。关闭书库或重新打开 DSH 后，从书库 **继续** 即可回到该段。删除书库条目只删除导入副本和进度，**不会改动原始 TXT / EPUB 文件**。

## 数据与隐私

- IndexedDB 数据库：`dsh-fish-reader`，对象仓库 `books`。
- localStorage 键：`dsh-fish-reader/settings`、`dsh-fish-reader/library`、`dsh-fish-reader/progress`、`dsh-fish-reader/last`。
- 数据属于当前浏览器 profile。DSH 桌面端和同一 Host 的其他浏览器/远程页面不共享 IndexedDB/localStorage，因此书库不会跨客户端自动同步。
- 无网络请求、无 Host 工具、无模型调用、无会话消息写入。

## 已知边界

- **在线书源未实现**：按要求只做本地 TXT / EPUB。
- **EPUB 是纯文本提取**：不支持 DRM、ZIP64、加密 EPUB、图片/漫画、CSS 排版、脚注弹窗和 EPUB 自带目录跳转；仅按 OPF spine 顺序抽取 XHTML 正文。导入时整本 EPUB 会读入内存解压，超大 EPUB 受浏览器内存限制。
- **正文只在非输入模式、输入框空且未聚焦时显示**：覆盖的是输入框的待输入文字区，不是真实草稿；一旦聚焦进入输入模式就隐藏，失焦后不会自动恢复，需要眼睛/`Alt+/`/打开书，或在隐藏状态下翻页。这样没有新增行，底部状态栏不会上下移动。
- **隐藏即回到原生 placeholder**：`Alt+/` 或自动隐藏会让正文和进度消失，工具栏三个按钮保留；眼睛/`Alt+/`/翻页/搜索/打开书可恢复显示。没有 `Hello world` 之类的替代文本设置。
- **点击正文不再打开搜索**：点击输入区优先进入打字；搜索改用 `Alt+F` 或正文行内的小搜索图标。
- **输入框占位覆盖依赖 composer 卡片结构**：0.2.2-rc.5 的 `conversation.input.overlay` 位于 `[data-composer-card]` 内；插件把正文绝对定位在 `.input` 的 36px 文本区上，并隐藏 `[data-composer-placeholder]`。若宿主改动该结构，覆盖层位置需要复核。
- **导入失败不会报成功**：只有正文写入 IndexedDB 且书库元数据写入 localStorage 都成功才计数；全部失败时显示错误汇总。TXT 还会用可读性检查拒绝明显二进制或严重误码内容。
- **工具栏控制区跟随宿主 activity 隐藏**：控制按钮注册在 `conversation.input.left`，正常输入时一直显示；Agent 运行中宿主会把整块 `.tools` 隐藏并换成 activity，这时按钮也会一起隐藏。若要求生成中也显示，需要另做 overlay，代价是会遮挡且需要自己定位。
- **搜索支持前后查找和正则**：搜索浮层有左右箭头（悬停显示“查找上一个/下一个”），`Enter` 下一个、`Shift+Enter` 上一个；正则模式使用 JavaScript `RegExp` 的 `u` 标志，复杂/灾难性回溯表达式可能让搜索变慢。命中后浮层保持打开，可连续查找。
- **快捷键是渲染端全局 keydown**，不在 DSH 命令/快捷键注册表中。自定义组合必须包含 Alt / Ctrl / Meta，且只在阅读会话开启、焦点不在输入框/可编辑控件时生效；如果与 DSH 已有快捷键冲突，插件会优先处理自己的组合，建议避开宿主常用键。
- **编码识别是启发式**：带 BOM 的 UTF-8/16/32 是确定性的；无 BOM 的 GB18030 与 Big5 通过常见字评分区分，极短或生僻文本可能误判；导入结果窗口里可以给单个文件改编码并原地重新解码。
- **大文件**采用分块读取/流式解码，但解码后的整本书以一个字符串保存在 IndexedDB 中；数百 MB 的文件会受浏览器内存限制。
- 搜索支持普通文字和正则，区分大小写，支持上一个/下一个，不循环；百分比标签显示当前段起点，最后一段显示 100%。详细边界见 `docs/DETAIL.md`。

## 源码与测试

- `client.js`：完整的 Client 插件（阅读核心、编码识别、IndexedDB、React UI）。
- `index.js`：Host 半，空实现；本插件不需要 Host 服务。
- `test/core.test.mjs`：Node 单元测试，覆盖分页、宽度变化、百分比、搜索、编码检测和流式解码。
- `test/fixtures/`：UTF-8、GB18030、Big5、UTF-16 LE/BE、UTF-32 LE/BE 测试样本，以及一个最小 EPUB 3 测试书。
- `test/make-fixtures.py`：生成全部测试样本（含 EPUB）。

运行测试：

```powershell
node --test dsh-fish-reader/test/core.test.mjs
```

普通用户使用说明见 [docs/USER-GUIDE.md](docs/USER-GUIDE.md)（英文见 [docs/USER-GUIDE.en.md](docs/USER-GUIDE.en.md)）。

详细实现与实测记录见 [docs/DETAIL.md](docs/DETAIL.md)。
