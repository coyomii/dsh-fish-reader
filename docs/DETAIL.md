# DSH Fish Reader 实现与实测记录

本文记录当前 DSH 版本下的挂载方式、实现边界、桌面端实测量，以及自动化验证结果。支持本地 TXT 与 EPUB。测试环境：

- DeepSeek Harness `0.2.2-rc.5`（Desktop，Windows）
- Profile：`desktop`
- 插件包：`dsh-fish-reader@1.3.0`（显示名 **DSH Fish Reader**；包名、slot id、存储键统一为 fish-reader）
- 安装结果：`application: applied`

## 1. 阅读区挂载方式（输入框占位覆盖）

当前版本没有“输入框下方、状态栏上方”的独立正文 slot。早期实现借用 `conversation.composer.dock` 加一行，会新增 22px 高度，使底部停靠的输入区/状态栏整体上移；因此改为 `conversation.input.overlay`。

实现方式：

- 在 `conversation.input.overlay` 注册 `fish-reader`，`order: 20`。
- `conversation.input.overlay` 的锚点在 `[data-composer-card]` 顶部（`position:absolute; height:0`），因此覆盖层可以相对 composer 卡片绝对定位。
- 正文行 `.sr-input-line` 固定覆盖 `.input` 的 36px 文本区：
  - `left:14px; right:8px; top:6px; height:36px;`
  - 字体继承 `--dsh-content-font-size`，行高继承 composer 的 24px 节奏。
- 当行存在时，用 `[data-composer-card]:has(.sr-input-line) [data-composer-placeholder] { visibility:hidden; }` 隐藏原 placeholder。
- 输入框为空、未聚焦、无附件且不处于 `inputMode` 时才显示；一旦聚焦进入输入模式，组件返回一个隐藏锚点，正文行卸载，placeholder 恢复。
- 组件通过找到最近的 `[data-composer-card]` 和其中的 `[contenteditable="true"]`，监听 editor 的 focus/blur：focus 置 `editing=true` 并调用 `noteInputFocus(true)` 锁存 `inputMode=true`；blur 只置 `editing=false`，不清 `inputMode`，所以点输入框外空白不会自动恢复正文。
- 恢复阅读必须显式：工具栏眼睛、`Alt+/`、从书库开始阅读/继续阅读、在隐藏（非输入模式）状态下点上一段/下一段。显式显示会清 `inputMode` 并让空输入框失焦；有草稿时不覆盖输入。
- 输入模式下上一段/下一段按钮禁用且 store 的 `previous`/`nextVisible` 也拒绝执行，不会偷偷翻页。
- 控制区独立注册到 `conversation.input.left`（`order: 0`），位置在 `+`、`完全权限`、Plan 之后；这里只放**上一段、下一段、显示/隐藏**三个按钮。正文覆盖层负责文字、进度和搜索图标。
- 没有打开书时，`input.left` 不渲染三个按钮；打开书后才显示。书库入口仍是左侧栏底部书本图标。
- 侧边栏书本按钮按宿主 footer action 几何对齐：wide 状态 42px 按钮 + `margin:4px 2px`、16px 图标；rail 状态 36px 按钮 + 同 margin、18px 图标，与 Remote 的 42/36px 行和 4px 外边距一致。
- 阅读状态不再用右上角圆点：没有正在阅读时书本为空心，正在阅读时书页用当前品牌色填充（35% 透明），状态和图标合一。
- 输入框聚焦/有草稿时工具栏三个按钮仍显示，但上一段/下一段禁用；隐藏但非输入模式时点击上一段/下一段才会先 `showReader()` 并让空输入框失焦，再翻页。
- 不新增行，不改变输入区高度，底部 `activity`/`usage` 状态栏不会上下移动。
- **宿主限制**：`conversation.input.left` 位于 `.tools` 内，Agent 运行中宿主会把 `.tools` 隐藏并换成 activity，控制区也会一起隐藏；这是当前 slot 的边界。

**宿主缺口说明**：0.2.2-rc.5 没有专门用于“占位区正文”的 slot；本插件使用 `conversation.input.overlay` 和绝对定位覆盖 composer 卡片。若宿主修改 `.input` 的 padding/高度或 `[data-composer-card]` 结构，这段覆盖定位需要复核。

## 2. 核心逻辑

### 分页与窗口宽度

- `readPage(text, start, limit, trim)`：从 cursor 读取一段，不跨换行，最多 `limit` 字；跳过换行；`trim` 为真时去掉首尾空白。
- `measurePrefix()`：用 Canvas 按当前正文的 `font` 测量可用宽度，二分出真正能放下的字符数。
- `fitPage()`：只显示能放下的部分；下一页 cursor = 当前段起点 + **实际显示的**字符数。窗口变窄时不会把被裁掉的字符算进下一页，因此不漏字；窗口变宽时只会把更多字符放进当前段。
- `previousPageStart()`：历史栈优先，保证上一段精确回到上一页；历史为空时按换行/最大字数回退。
- `lastPageStart()`：100% 跳转时跳过尾部空白/换行，定位最后一个可读段。
- `readPage` 的 `atEnd` 会把“后面只剩空白/换行”视为结尾，避免出现空白末页。

### 搜索与百分比

- 搜索浮层压缩为 `width: min(520px, 100% - 22px)`、单行 26px 控件；查找上一个/下一个改为箭头图标，输入框保留更多宽度；错误信息放在行尾固定 84px 的状态槽里，空/非空都占同一宽度，搜索框不会因为报错变高或变宽。
- “正则”按钮切换 `RegExp(query, 'gu')` 模式；模式是裸字符串（不带 `/.../`），使用 `u` 标志、区分大小写。正则模式下 `12.5%` 按正则处理，不再触发百分比跳转。
- 正则无匹配/非法表达式会保留当前页并提示；零长度匹配（如 `^`）允许，但高亮为空，下一次从 cursor+1 继续，避免死循环。
- 每次搜索会按当前书/查询/模式收集匹配列表并缓存（上限 20000）；搜索框行尾显示 `当前序号/总数`，超过上限显示 `+`。上一段/下一段直接在该列表上移动，因此序号和实际位置一致。
- 普通模式按上一次命中长度跳过当前匹配，避免 `\d+` 在当前数字内部再次命中；向后查找从 `cursor-1` 扫描最后一个 `index <= from` 的匹配。
- 搜索从当前 cursor 开始：首次“查找下一个”包含当前 cursor；命中后再次查找从命中末尾开始；“查找上一个”从 `cursor-1` 向前找，不循环。
- 搜索浮层定位在 composer 卡片上方，输入、查找上一个/下一个、取消、错误提示都在浮层内，不改变输入区高度；命中后浮层保持打开，可连续查找。
- 输入 `Enter` 等价于“查找下一个”，`Shift+Enter` 等价于“查找上一个”。
- 命中后 cursor 设为命中位置，命中词在正文首部并以 `<mark>` 高亮；进度写入该书。
- 取消、空输入、无结果、非法百分比均保留当前页，不写进度。
- `parsePercent()` 支持 `12%`、`12.5%`、`0%`、`100%`；`100%` 使用 `lastPageStart` 显示末段。
- 百分比标签显示当前段起点；最后一段显示 100%。

### 隐藏阅读

- `Alt+/` 切换“显示阅读 / 回到输入框”：隐藏时整个覆盖层卸载，输入框显示原生 placeholder，正文、进度和按钮一起消失；不再显示 `Hello world` 之类替代文本。
- 30 秒（可设置）无阅读操作后自动隐藏；翻页、跳转、搜索、打开书会恢复显示。
- 隐藏状态下点击输入框只显示原生 placeholder；清空并失焦也不会自动恢复，直到按键/翻页/搜索/重新打开书。
- 输入框已聚焦且草稿为空、无附件时，按隐藏/显示快捷键会先让输入框失焦再显示正文；有草稿或附件时不处理，避免正文覆盖正在输入的内容。
- 隐藏只改变渲染，不改变 cursor；恢复后仍是同一段。
- 搜索框打开、书库打开时暂停自动隐藏计时。

### 编码与导入

- TXT BOM 优先：UTF-8、UTF-16 LE/BE、UTF-32 LE/BE。
- 无 BOM：UTF-8 fatal 校验；NUL 分布判断 UTF-16/UTF-32；GB18030 与 Big5 用 `TextDecoder(fatal)` + 常见中文字评分选择。
- UTF-32 使用自写流式解码器（Node/Chromium 的 TextDecoder 不提供 UTF-32）。
- TXT 文件按 1 MiB 分块 `File.slice().arrayBuffer()`，`TextDecoder` 流式解码，导入过程中更新进度。
- 解码后统一 `\r\n`/`\r` → `\n`，去掉 BOM 与 NUL。
- 大文件测试：3,240,020 字节 UTF-8，1,080,008 字符，导入耗时约 253 ms（测试机）。

### EPUB

- 通过文件扩展名 `.epub` 或 ZIP magic（`PK\x03\x04`/`PK\x05\x06`）识别。
- 自写最小 ZIP 解析器：读取中央目录/本地文件头，支持 stored（0）和 deflate（8），deflate 用 `DecompressionStream('deflate-raw')`；不支持 ZIP64、加密条目和其他压缩方式。
- 读取 `META-INF/container.xml` 得到 OPF 路径，解析 OPF manifest 和 spine 顺序。
- 按 spine 顺序读取 XHTML/HTML，`htmlToText()` 去脚本/样式/标签、保留段落换行、解码 HTML 实体；只提取正文，不解析图片、CSS、目录或 DRM。
- 多个章节用换行连接，进入同一套分页、搜索、百分比和续读逻辑。
- 导入时整本 EPUB 读入内存后解压；超大 EPUB 受浏览器内存限制。
- 只有 IndexedDB 正文写入和 localStorage 书库元数据都成功才计入“已导入”；元数据写入失败会删掉刚写入的副本并报失败。
- 导入进度沿用书库内原有的进度条；全部文件读完后才弹出结果弹窗，弹窗只负责结果和重新解码，随时可以关闭。
- 弹窗内每本 TXT 都能单独选编码：失败项点“重试”重新导入；已成功导入的条目点“重新解码”会用同一份文件重新解码并**原地替换**正文，保留 `id`、书名和阅读进度（进度按新正文长度截断，历史记录清空）。因此编码选择只在真正需要时出现，不再占用书库工具栏。
- TXT 还会用 `isReadableText()` 拒绝二进制/严重误码内容，失败信息会带上本次尝试的编码（例如“无法按 GB18030 解码”）。

### 固定按钮位置

- `.sr-input-line` 绝对定位覆盖 composer 的 36px 文本区，左右与输入框内容对齐；不会改变输入框高度。
- 正文颜色使用 `--dsw-alias-label-secondary`：比输入草稿的 `label-primary` 淡、比 placeholder 的 `label-caption` 深，在明暗主题下都处于两者之间。
- 控制区 `.sr-toolbar` 在 `conversation.input.left`，只含上一段、下一段、显示/隐藏三个 24px 按钮；正文行右侧保留 52px 进度槽和 20px 搜索按钮。
- 工具栏样式独立为 `TOOLBAR_CSS`，由 `ReaderToolbar` 始终注入；即使没开书、`InputReader` 卸载，按钮也不会落回宿主默认按钮的灰框，三种状态使用同一套 reset/尺寸/颜色。
- 三个按钮不随状态换图标或变色：没书、首页/末页禁用时仍保持同样颜色和 24px 尺寸；隐藏阅读时眼睛图标也不换成斜杠，只通过正文/进度消失表达状态。
- 进度从 `0%` 到 `100%`、`载入中`、隐藏阅读（进度显示空白占位）都不会改变工具栏按钮位置；隐藏时工具栏按钮保留。
- 临时提示改为绝对定位的 `.sr-input-toast`，搜索错误提示放在浮层内部；两者都不占行内布局，也不推动按钮。
- 搜索框是 composer 卡片上方的绝对定位浮层，输入区和底部状态栏都不移动。

### 书库操作

- 书库行按钮为 **开始阅读 / 继续阅读 / 关闭阅读**（`library.openBook` / `library.resume` / `library.closeBook`），与“关闭阅读”组成同一套动宾说法。
- 点开始阅读或继续阅读后，只有 `openBook()` 成功（IndexedDB 读到正文）才自动关闭书库；失败（副本丢失、存储异常）时书库保持打开，错误显示在面板内，避免错误被一起关掉。
- 输入框里已有草稿或附件时，正文按设计不会覆盖输入；此时 `openBook()` 返回 `blocked`，书库保持打开并提示“清空后点工具栏眼睛即可阅读”，避免点了按钮什么都没发生。
- 书库在“嵌入设置页”形态下也使用同一行组件；那里 `closeLibrary()` 只是把 `libraryOpen` 置为 false，不会改变宿主设置页。

### 自定义快捷键

- 设置持久化在 `settings.shortcuts`：`prev` / `next` / `boss` / `search`。
- 默认值：`Alt+Comma`、`Alt+Period`、`Alt+Slash`、`Alt+KeyF`（界面显示为 `Alt+,`、`Alt+.`、`Alt+/`、`Alt+F`）。
- 设置页点“修改”后进入捕获状态；下一次 keydown 用 `event.code` 和修饰键生成规范组合（修饰键固定按 Alt→Ctrl→Meta→Shift 排序）。
- 必须包含 Alt / Ctrl / Meta 中至少一个（只有 Shift 不算）；`Esc` 取消；重复组合会拒绝并提示；可“恢复默认”。
- 捕获期间全局阅读快捷键暂停；保存成功后立即生效。自定义组合与 DSH 已有快捷键的冲突由用户自行避开。

### 存储

- IndexedDB `dsh-fish-reader` / `books`：每本书 `{ id, alias, sourceName, encoding, encodingKind, format, uncertain, charCount, bytes, importedAt, text }`。
- localStorage：设置、书库元数据、每本书 `{cursor, history, percent, updatedAt}`、最近书 id。
- 删除只删 IndexedDB 副本、元数据和进度；原始文件从未被读取回写或移动。
- 没有 Host 服务、工具、网络请求或会话写入。
- 落盘位置（DSH Desktop，Electron userData 下的渲染进程存储；origin 为 `dsh-app://app`）：
  - Windows：`%APPDATA%\@deepseek-ai\dsh-desktop\IndexedDB\`（`dsh-app_app_0.indexeddb.leveldb` 存 `dsh-fish-reader` 数据库，整段正文溢出到同目录 `dsh-app_app_0.indexeddb.blob`）与 `%APPDATA%\@deepseek-ai\dsh-desktop\Local Storage\leveldb\`（`dsh-fish-reader/library`、`/progress`、`/settings`、`/last`）。
  - macOS：`~/Library/Application Support/@deepseek-ai/dsh-desktop/IndexedDB/`、`.../Local Storage/leveldb/`；Linux：`~/.config/@deepseek-ai/dsh-desktop/` 下同名子目录。
  - 两者都是 leveldb 二进制，运行期间被锁定，不能直接阅读或手工编辑；备份需先退出 DSH 再整目录复制。
  - 卸载插件不会删除这些数据；清理站点数据或删除用户数据目录才会丢失。浏览器版 Web GUI 属于不同 origin，与桌面窗口各存一份、互不同步。

## 3. 桌面端实测（DSH Desktop，旧版独立行阶段）

> 本节记录的是“阅读栏作为 composer.dock 独立一行”时期的桌面实测。之后已改为输入框占位覆盖；新布局按用户要求没有再操作桌面复测，代码与单元测试状态见第 4、5 节。

| 项目 | 结果 |
| --- | --- |
| 插件加载 | `application: applied`；左侧栏底部出现书本图标（Remote 右侧） |
| 打开书库 | 点击书本图标打开“DSH Fish Reader 书库”，含“书籍/设置”页 |
| 设置页 | 每段字数、自动隐藏秒数、去除首尾空白、快捷键可见可编辑（旧版还含老板键文本） |
| 导入并打开 TXT | 用户通过原生文件选择框导入并打开；阅读栏出现（旧版独立行） |
| 阅读栏位置 | 旧版正文行位于输入框下方、状态栏上方；状态栏仍显示“2 轮 225 步·… / 64.9M tok·缓存命中 99.6% / 38%” |
| 百分比 | 桌面端显示过 0%、100%；100% 显示末段 |
| 翻页 | 桌面端按 `Alt+,` 后进度由 100% 变为 16.7%，证明快捷键在桌面端生效 |
| 自动隐藏（旧版） | 空闲后阅读栏自动变为 `Hello world`，百分比被遮住，状态栏不变；新版改为回到原生 placeholder |
| 打开搜索框 | 旧版点击正文后出现“搜索内容，或输入 12.5% 跳转”输入框；新版改为 Alt+F/搜索图标 |

> 桌面端部分操作通过截图核对；受 Windows 原生文件选择框和自动化按键焦点的限制，搜索提交、窗口缩窄和完整进程重启只在自动化浏览器中做了完整断言，未在桌面窗口逐项复测。

## 4. 自动化验证

### 4.1 Node 核心测试

命令：

```powershell
node --test dsh-fish-reader/test/core.test.mjs
```

结果：21/21 通过。

覆盖：

- BOM/CRLF/NUL 规范化；
- 换行分段、最大字数、trim；
- 宽度 4→3→5 连续翻页无漏字；
- trim 前导空格映射；
- 上一段回退；
- 100% 末段；
- 百分比解析/越界；
- 跨段搜索、向前/向后匹配、正则匹配与非法正则、匹配计数；
- 7 种编码 fixture 的识别与全量解码；
- 可读文本校验（拒绝二进制/严重误码）；
- 任意分块边界流式解码；
- EPUB ZIP 中央目录/本地条目、OPF spine、XHTML 正文提取、HTML 实体；
- EPUB 相对路径解析；
- 自定义快捷键的规范化、显示、修饰键校验和事件组合；
- 别名去重和扩展名处理。

### 4.2 DSH Web 客户端端到端（headless Edge，连接同一 DSH Host）

> 本节大部分断言是“独立行”时期的结果。改成输入框占位覆盖后，按用户要求没有继续操作桌面/浏览器；阅读核心（分页、搜索、编码、存储）未变，但覆盖层布局/焦点交互没有再跑视觉回归。

使用 DSH 的 Web 客户端加载同一个 Client bundle，通过真实 DOM、IndexedDB、文件输入和键盘事件验证：

| 项目 | 结果 |
| --- | --- |
| 旧版独立一行布局 | 通过；当时 reader 437–459，activity/usage 462–484（该布局已弃用） |
| 输入框占位覆盖 | **代码已实现，未实测**；不再注册 composer.dock，改为 conversation.input.overlay |
| 控制区移到 input.left | **代码已实现，未实测**；正常输入时在“完全权限”后显示上一段/下一段/隐藏；无书时三个按钮不渲染；activity 时随 `.tools` 隐藏 |
| 未打开书时收起 | 通过；无 `[data-fish-reader]`，dock 不增加行 |
| 连续翻页 | 通过；`Alt+,`/`Alt+.` 与按钮均正确 |
| 窗口宽度变化 | 通过；1000→720→460→980→380→820，页面长度 `[6,44,11,34,17,4]`，拼接后 116/116 字符与原文完全一致，0 漏字、0 重复 |
| 100% 末段 | 通过；显示末段，进度 100%，下一段禁用 |
| 隐藏/显示（旧版） | 通过；当时 `Hello world` ↔ 原段，进度隐藏/恢复，cursor 不变；新版已改为整行卸载回原生 placeholder |
| 隐藏到原生 placeholder（新版） | **代码已实现，未实测**；自动隐藏也复用该状态 |
| 自动隐藏（旧版） | 通过；设置 1 秒后自动隐藏，`Alt+/` 恢复同一段；新版隐藏目标是原生 placeholder |
| 向前/向后搜索 | 旧版验证了向前跨段命中；新版新增“查找上一个/下一个”和正则模式，按用户要求未做桌面/浏览器复测；正则匹配由 Node 单元测试覆盖 |
| 无结果/非法百分比 | 通过（旧版）；保留当前页，搜索框保持打开并提示 |
| 0% / 12.5% / 100% | 通过 |
| 输入模式锁存 | **代码已实现，未实测**；点输入框进入输入模式，点空白失焦不自动恢复；眼睛/`Alt+/`/打开书/隐藏状态下翻页才恢复；输入模式中上一段/下一段不执行 |
| 输入框隔离 | 通过（旧版部分）；composer 聚焦时 `Alt+.` 不改阅读栏；新版 `Alt+/` 会显式恢复阅读并让空输入框失焦 |
| 编码导入 | 通过；UTF-8/GB18030/Big5/UTF-16 LE/BE/UTF-32 LE/BE 全部识别并显示正确文本 |
| EPUB 导入 | **仅单元测试通过**（生成的 EPUB 3 样本，2 章）；本轮按用户要求停止桌面/浏览器操作，未在真实 DSH 窗口导入 EPUB 复测 |
| 固定按钮位置 | 代码已固定工具栏三个按钮各 24px、正文行进度槽 52px + 搜索 20px，提示/搜索改为绝对定位；本轮未再跑桌面视觉回归 |
| 大文件流式导入 | 通过；3.24 MB / 1,080,008 字，253 ms |
| 改名/删除 | 通过；书库行更新/消失，IndexedDB 记录删除；原始 fixture 文件仍在磁盘 |
| 页面重载续读 | 通过；保存 cursor 后 reload，再从书库“继续”，正文与原段一致 |

## 5. 未实现或未验证

- **在线书籍**：按需求不开发；没有在线章节名/在线进度。
- **EPUB 限制**：不支持 DRM、ZIP64、加密 EPUB、图片/漫画、CSS 排版、脚注弹窗和 EPUB 目录跳转；只按 OPF spine 抽取 XHTML 纯文本。整本 EPUB 在解压时进入内存，超大文件受内存限制。EPUB 只在 Node 单元测试中验证，未在真实 DSH 窗口复测。
- **输入框覆盖未实测**：新版通过 `conversation.input.overlay` 把正文绝对定位在 `.input` 的 36px 文本区上，并隐藏 `[data-composer-placeholder]`；按用户要求没有继续操作桌面，因此覆盖层位置、聚焦隐藏、`Alt+/` 从空输入框进入阅读、Alt+F 和固定按钮的视觉回归尚未实测。若 `.input` 的 padding/高度或卡片结构变化，需要复核 `top:6px; height:36px`。
- **点击正文不再搜索**：新版点击正文优先聚焦输入框；搜索改为 `Alt+F` 或行内搜索图标。
- **桌面窗口缩窄的逐项复测**：自动化浏览器使用 `Emulation.setDeviceMetricsOverride` 做了多宽度连续翻页；桌面窗口未单独逐项复测。
- **桌面完整进程重启**：自动化做了页面重载续读；桌面进程未关闭重开验证。存储实现相同（IndexedDB/localStorage），但这一条仍属于自动化覆盖。
- **桌面搜索提交**：旧版桌面端确认过点击正文打开输入框；新版 Alt+F/图标的搜索提交与跳转只在旧搜索逻辑上验证过，未做新版浮层实测。
- **编码误判**：GB18030/Big5 依赖启发式；极短/生僻文本可能误判。手动改编码的入口在导入结果弹窗里（按文件重新解码），弹窗关闭后如需改编码，需要重新导入该文件。
- **跨客户端同步**：DSH Desktop 与同一 Host 的其他浏览器/远程页面各自使用自己的 IndexedDB/localStorage，不同步。
- **超大文件**：分块导入，但整本正文最终以单个字符串保存，数百 MB 会受浏览器内存限制。

## 6. 文件说明

```text
dsh-fish-reader/
  package.json          Client bundle 声明（dsh.client + bundle patch）
  cordis.patch.yml      插入 fish-reader 行
  index.js              Host 半，空实现
  client.js             阅读核心 + IndexedDB + React UI
  locale/en.json        Plugin Manager 标题/描述
  locale/zh.json        Plugin Manager 标题/描述
  icon.svg              原创书本图标
  docs/DETAIL.md        本文
  README.md             中文安装/使用说明
  test/core.test.mjs    Node 单元测试
  test/fixtures/        7 种编码样本 + EPUB 3 样本
  test/make-fixtures.py 样本生成脚本（含 EPUB）
```
