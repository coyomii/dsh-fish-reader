/*
 * DSH Fish Reader — a persistent client bundle.
 *
 * The reader overlays the composer's placeholder line through
 * `conversation.input.overlay`.  It appears only while the draft is empty and
 * unfocused, so it never adds a row or shifts the status bar.  Clicking the
 * input restores the native placeholder for typing; Alt+F opens search.
 *
 * Book text, library metadata, settings and per-book progress live in this
 * browser profile only (IndexedDB + localStorage).  Nothing in this file sends
 * a message to the current conversation, calls a model, or touches the network.
 */
(function () {
  'use strict';

  var MODULE_ID = 'dsh-fish-reader';
  var NS = 'fish-reader';
  var DB_NAME = 'dsh-fish-reader';
  var LS_SETTINGS = 'dsh-fish-reader/settings';
  var LS_LIBRARY = 'dsh-fish-reader/library';
  var LS_PROGRESS = 'dsh-fish-reader/progress';
  var LS_LAST = 'dsh-fish-reader/last';
  // Compatibility only: migrate the old local database/keys on first run.
  var LEGACY_DB_NAME = 'dsh-shadow-reader';
  var LEGACY_LS_PREFIX = 'dsh-shadow-reader/';
  var CHUNK_BYTES = 1024 * 1024;
  var SAMPLE_BYTES = 256 * 1024;

  var DEFAULT_SETTINGS = {
    pageSize: 50,
    hiddenSeconds: 30,
    trimNextLine: false,
    shortcuts: {
      prev: 'Alt+Comma',
      next: 'Alt+Period',
      boss: 'Alt+Slash',
      search: 'Alt+KeyF',
    },
  };

  // ---------------------------------------------------------------------------
  // Pure reading / encoding core.  Kept free of React and DOM so it can be
  // exercised by Node tests through the `__core` test hook below.
  // ---------------------------------------------------------------------------

  var core = (function () {
    var COMMON = (
      '的一是不了在人有我他这为之大来以个中上们国到说时就要会可也你对生能而' +
      '子那得于着下自之年过发后作里用道行所然家种事成方多经么去法学如都同现' +
      '当没动面起看定天分还进好小部其些主样理心她本前开但因只从想实日军者意' +
      '无力它与长把机十民第公此已工使情明性知全三又关点正业外将两高间由问很' +
      '最重并物手应战向头文体政美相见识被利什二等产或新己制身果加西斯月话合' +
      '回特代内信表化老给世位次度门任常先海通教儿原东声提立及比员解水名真论' +
      '处走义各入几口认条平系气题活尔更别打女变四神总何电数安少报才结反受目' +
      '太量再感建务做接必场件计管期市直德资命山金指克许统区保至队形社便空决' +
      '治展马科司五基眼书非则听白却界达光放强即像难且权思王象完设式色路记南' +
      '品住告类求据程北边死张该交规万取拉格望觉术领共确传师观清今切院让识候' +
      '带导争运笑飞风步改收根干造言联持组每济车亲极林服快办议往元英士证近失' +
      '转夫令准布始怎呢存未远叫台单影具罗字爱击流备兵连调深商算质团集百需价' +
      '花党华城石级整府离况亚请技际约示复病息究线似官火断精满支视消越器容照' +
      '须九增研写称企八功吗包片史委乎查轻易早曾除农找装广显吧阿李标谈吃图念' +
      '六引历首医局突专费号尽另周较注语仅考落青随选列武红响虽推势参希古众构' +
      '房半节土投某案黑维革划敌致陈律足态护七兴派孩验责营星够章音跟志底站严' +
      '巴例防族供效续施留讲型料终答紧黄绝奇察母京段依批群项故按河米围江织害' +
      '斗双境客纪采举杀攻父苏密低朝友诉止细愿千值仍男钱破网热助倒育属坐帝限' +
      '船脸职速刻乐否刚威毛状率甚独球般普怕弹校苦创假久错承印晚兰试股拿脑预' +
      '谁益阳若哪微尼继送急血惊伤素药适波夜省初喜卫源食险待述陆习置居劳财环' +
      '排福纳欢雷警获模充负云停木游龙树疑层冷洲冲射略范竟句室异激汉村哈策演' +
      '简卡罪判担州静退既衣您宗积余痛检差富灵协角占配征修皮挥胜降阶审沉坚善' +
      '妈刘读啊超免压银买皇养伊怀执副乱抗犯追帮宣佛岁航优怪香著田铁控税左右' +
      '份穿艺背阵草脚概恶块顿敢守酒岛托央户烈洋哥索胡款靠评版宝座释景顾弟登' +
      '货互付伯慢欧换闻危忙核暗姐介坏讨丽良序升监临亮露永呼味野架域沙掉括舰' +
      '鱼杂误湾吉减编楚肯测败屋跑梦散温困剑渐封救贵枪缺楼县尚毫移娘朋画班智' +
      '亦耳恩短掌恐遗固席松秘谢鲁遇康虑幸均销钟诗藏赶剧票损忽巨炮旧端探湖录' +
      '叶春乡附吸予礼港雨呀板庭妇归睛饭额含顺输摇招婚脱补谓督毒油疗旅泽材灭' +
      '逐莫笔亡鲜词圣择寻厂睡博勒烟授诺伦岸奥唐卖俄炸载洛健堂旁宫喝借君禁阴' +
      '园谋宋避抓荣姑孙逃牙束跳顶玉镇雪午练迫爷篇肉嘴馆遍凡础洞卷坦牛宁纸诸' +
      '训私庄祖丝翻暴森塔默握戏隐熟骨访弱蒙歌店鬼软典欲萨伙遭盘爸扩盖弄雄稳' +
      '忘亿刺拥徒姆杨齐赛趣曲刀床迎冰虚玩析窗醒妻透购替塞努休虎扬途侵刑绿兄' +
      '迅套贸毕唯谷轮库迹尤竞街促延震弃甲伟麻川申缓潜闪售灯针哲络抵朱埃抱鼓' +
      '植纯夏忍页杰筑折郑贝尊吴秀混臣雅振染盛怒舞圆搞狂措姓残秋培迷诚宽宇猛' +
      '摆梅毁伸摩盟末乃悲拍丁赵硬麦蒋操耶阻订彩抽赞魔纷沿喊违妹浪汇币丰蓝殊' +
      '献桌啦瓦莱援译夺汽烧距裁偏符勇触课敬哭懂墙袭召罚侠厅拜巧侧韩冒债曼融' +
      '惯享戴童犹乘挂奖绍厚纵障讯涉彻刊丈爆乌役描洗玛患妙镜唱烦签仙彼弗症仿' +
      '倾牌陷鸟轰咱菜闭奋庆撤泪茶疾缘播朗杜奶季丹狗尾仪偷奔珠虫驻孔宜艾桥淡' +
      '翼恨繁寒伴叹旦愈潮粮缩罢聚径恰挑袋灰捕徐珍幕映裂泰隔启尖忠累炎暂估泛' +
      '荒偿横拒瑞忆孤鼻闹润幅' +
      // Traditional forms that are common in Big5 text.
      '這個們國說時會可也對與為於著後裡過發種經麼學現當沒動還進樣實開從無長機' +
      '關點業將兩間問題體見識產員條氣題電數報結場計區隊書聽卻達強權設認識帶導' +
      '爭運飛風辦議證轉準單愛擊備調質團價黨華離況請技術際複線斷滿視須寫稱嗎圖' +
      '歷醫專費盡週較語僅隨選紅響雖勢參眾構節劃敵陳態護興責營夠嚴範續講終緊黃' +
      '絕媽劉讀壓銀買養懷執亂幫歲優鄉親極樂剛獨彈創錯蘭腦預誰陽繼驚傷藥適衛險' +
      '陸習勞財環納歡雷獲負雲遊龍樹層衝漢簡擔靜退積餘檢靈協佔勝階審堅媽壞討麗' +
      '監臨島魚雜誤灣減編測敗夢溫劍漸貴槍樓縣畫遺謝魯慮銷鐘詩藏趕劇損舊錄葉鄉' +
      '禮婦歸飯額順輸搖脫補謂療澤滅筆詞聖擇尋廠煙諾倫賣載宮陰園謀榮孫頂鎮練爺' +
      '館寧紙諸訓莊絲翻戲隱熟訪軟薩夥盤擴蓋穩億擁楊齊賽趣虛鬧潤'
    );
    var COMMON_SET = new Set(Array.from(COMMON));
    var PUNCT = /[\s，。！？；：、“”‘’（）《》〈〉【】…—～·,.!?;:'"()[\]{}<>]/;

    function clampInt(value, min, max, fallback) {
      var n = typeof value === 'number' ? value : Number(value);
      if (!Number.isFinite(n)) return fallback;
      n = Math.trunc(n);
      if (n < min) return min;
      if (n > max) return max;
      return n;
    }

    var MODIFIER_ORDER = ['Alt', 'Ctrl', 'Meta', 'Shift'];
    var MODIFIER_CODES = new Set([
      'Alt', 'AltLeft', 'AltRight', 'AltGraph',
      'Control', 'ControlLeft', 'ControlRight',
      'Meta', 'MetaLeft', 'MetaRight',
      'Shift', 'ShiftLeft', 'ShiftRight',
      'CapsLock', 'NumLock', 'ScrollLock', 'OS',
    ]);
    var KEY_LABELS = {
      Comma: ',', Period: '.', Slash: '/', Semicolon: ';', Quote: "'",
      BracketLeft: '[', BracketRight: ']', Backslash: '\\', Minus: '-', Equal: '=',
      Backquote: '`', Space: 'Space', Enter: 'Enter', Tab: 'Tab',
      ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓',
      Home: 'Home', End: 'End', PageUp: 'PageUp', PageDown: 'PageDown',
      Insert: 'Insert', Delete: 'Delete', Backspace: 'Backspace',
    };

    function normalizeShortcut(value, fallback) {
      if (typeof value !== 'string') return fallback;
      var parts = value.split('+').filter(Boolean);
      if (parts.length < 2) return fallback;
      var modifiers = [];
      var key = null;
      for (var i = 0; i < parts.length; i++) {
        var part = parts[i];
        if (MODIFIER_ORDER.indexOf(part) >= 0) {
          if (modifiers.indexOf(part) < 0) modifiers.push(part);
        } else if (key === null && /^[A-Za-z0-9_-]+$/.test(part)) {
          key = part;
        } else {
          return fallback;
        }
      }
      if (!modifiers.length || !key) return fallback;
      if (!modifiers.some(function (modifier) { return modifier !== 'Shift'; })) return fallback;
      var ordered = MODIFIER_ORDER.filter(function (modifier) { return modifiers.indexOf(modifier) >= 0; });
      return ordered.concat([key]).join('+');
    }

    function shortcutFromEvent(event) {
      if (!event || !event.code) return null;
      if (MODIFIER_CODES.has(event.code)) return null;
      var modifiers = [];
      if (event.altKey) modifiers.push('Alt');
      if (event.ctrlKey) modifiers.push('Ctrl');
      if (event.metaKey) modifiers.push('Meta');
      if (event.shiftKey) modifiers.push('Shift');
      if (!modifiers.length) return '';
      return modifiers.concat([event.code]).join('+');
    }

    function shortcutLabel(value) {
      var normalized = normalizeShortcut(value, null);
      if (!normalized) return String(value || '');
      return normalized.split('+').map(function (part) {
        if (MODIFIER_ORDER.indexOf(part) >= 0) return part;
        if (KEY_LABELS[part]) return KEY_LABELS[part];
        if (/^Key[A-Z]$/.test(part)) return part.slice(3);
        if (/^Digit[0-9]$/.test(part)) return part.slice(5);
        if (/^Numpad[0-9]$/.test(part)) return 'Num ' + part.slice(6);
        if (/^F[0-9]{1,2}$/.test(part)) return part;
        return part;
      }).join('+');
    }

    function sanitizeShortcuts(raw) {
      var source = raw && typeof raw === 'object' ? raw : {};
      return {
        prev: normalizeShortcut(source.prev, DEFAULT_SETTINGS.shortcuts.prev),
        next: normalizeShortcut(source.next, DEFAULT_SETTINGS.shortcuts.next),
        boss: normalizeShortcut(source.boss, DEFAULT_SETTINGS.shortcuts.boss),
        search: normalizeShortcut(source.search, DEFAULT_SETTINGS.shortcuts.search),
      };
    }

    function sanitizeSettings(raw) {
      raw = raw && typeof raw === 'object' ? raw : {};
      return {
        pageSize: clampInt(raw.pageSize, 5, 500, DEFAULT_SETTINGS.pageSize),
        hiddenSeconds: clampInt(raw.hiddenSeconds, 0, 3600, DEFAULT_SETTINGS.hiddenSeconds),
        trimNextLine: raw.trimNextLine === true,
        shortcuts: sanitizeShortcuts(raw.shortcuts),
      };
    }

    function normalizeText(input) {
      var text = String(input == null ? '' : input);
      if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
      text = text.replace(/\r\n?/g, '\n').replace(/\u0000/g, '').replace(/\f/g, '\n');
      return text;
    }

    /** Reject binary or badly mis-decoded files instead of importing garbage. */
    function isReadableText(text) {
      var sample = String(text == null ? '' : text).slice(0, 20000);
      if (!sample.trim()) return false;
      var bad = 0;
      for (var i = 0; i < sample.length; i++) {
        var code = sample.charCodeAt(i);
        if (code === 0xfffd) bad++;
        else if (code < 0x20 && code !== 0x09 && code !== 0x0a && code !== 0x0d) bad++;
        else if (code >= 0x7f && code <= 0x9f) bad++;
      }
      return bad / sample.length <= 0.02;
    }

    function restIsBlank(text, index) {
      for (var i = index; i < text.length; i++) {
        var ch = text[i];
        if (ch !== '\n' && ch !== '\r' && ch !== ' ' && ch !== '\t') return false;
      }
      return true;
    }

    /**
     * Read one visible segment starting at (or after) `start`.
     *
     * A segment never crosses a newline, and is at most `limit` characters.
     * Newlines and (when `trim` is on) whitespace-only segments are consumed
     * without being shown, exactly like walking a single-line status reader.
     */
    function readPage(text, start, limit, trim) {
      var total = text.length;
      var i = Math.max(0, Math.min(Math.trunc(start) || 0, total));
      var lim = Math.max(1, Math.trunc(limit) || 1);
      for (;;) {
        while (i < total && text[i] === '\n') i++;
        if (i >= total) {
          return { start: total, rawEnd: total, rawText: '', text: '', lead: 0, atEnd: true };
        }
        var end = i;
        while (end < total && text[end] !== '\n' && end - i < lim) end++;
        var raw = text.slice(i, end);
        var display = trim ? raw.trim() : raw;
        var lead = trim ? raw.length - raw.trimStart().length : 0;
        if (display.length > 0) {
          return { start: i, rawEnd: end, rawText: raw, text: display, lead: lead, atEnd: restIsBlank(text, end) };
        }
        i = end;
        if (end >= total) {
          return { start: total, rawEnd: total, rawText: '', text: '', lead: 0, atEnd: true };
        }
      }
    }

    /**
     * Turn a maximum-size page into the part that actually fits on screen.
     * `advance` is the cursor for the next page: exactly the end of what was
     * displayed, never the end of clipped text.  This is what prevents missing
     * characters when the window gets narrower between two page turns.
     */
    function fitPage(page, total, fitChars, trim) {
      var display = page.text;
      var advance = page.rawEnd;
      var clipped = false;
      var fit = Math.max(0, Math.trunc(fitChars) || 0);
      if (display.length > 0 && fit < display.length) {
        fit = Math.max(1, fit);
        display = display.slice(0, fit);
        advance = page.start + (trim ? page.lead : 0) + fit;
        while (trim && advance < page.rawEnd && (page.rawText[advance - page.start] === ' ' || page.rawText[advance - page.start] === '\t')) {
          advance++;
        }
        clipped = true;
      }
      if (display.length === 0 && page.text.length > 0) {
        display = page.text.slice(0, 1);
        advance = page.start + (trim ? page.lead : 0) + 1;
        clipped = true;
      }
      if (advance > total) advance = total;
      var atEnd = page.atEnd && !clipped;
      return {
        start: page.start,
        rawEnd: page.rawEnd,
        rawText: page.rawText,
        text: display,
        lead: page.lead,
        advance: advance,
        clipped: clipped,
        atStart: page.start <= 0,
        atEnd: atEnd,
      };
    }

    function previousPageStart(text, cursor, limit) {
      if (cursor <= 0) return 0;
      var i = Math.min(cursor, text.length) - 1;
      while (i >= 0 && text[i] === '\n') i--;
      if (i < 0) return 0;
      var lineStart = text.lastIndexOf('\n', i) + 1;
      var lineLen = i + 1 - lineStart;
      if (lineLen <= limit) return lineStart;
      return lineStart + Math.floor((lineLen - 1) / limit) * limit;
    }

    function lastPageStart(text, limit) {
      var end = text.length;
      while (end > 0 && /\s/.test(text[end - 1])) end--;
      if (end <= 0) return 0;
      var lineStart = text.lastIndexOf('\n', end - 1) + 1;
      var len = end - lineStart;
      if (len <= limit) return lineStart;
      return lineStart + Math.floor((len - 1) / limit) * limit;
    }

    function jumpPercent(text, percent, limit, trim) {
      var total = text.length;
      if (total === 0) return 0;
      if (percent <= 0) return readPage(text, 0, limit, trim).start;
      if (percent >= 100) return lastPageStart(text, limit);
      var target = Math.min(total - 1, Math.max(0, Math.round(total * percent / 100)));
      var lineStart = text.lastIndexOf('\n', target - 1) + 1;
      var offset = target - lineStart;
      if (offset < 0) {
        lineStart = 0;
        offset = target;
      }
      var start = lineStart + Math.floor(offset / limit) * limit;
      if (start > target) start = lineStart;
      return readPage(text, start, limit, trim).start;
    }

    function percent(cursor, total, atEnd) {
      if (atEnd) return 100;
      if (!total) return 0;
      var value = Math.max(0, Math.min(100, cursor / total * 100));
      return Math.round(value * 10) / 10;
    }

    function labelPercent(cursor, total, atEnd) {
      var value = percent(cursor, total, atEnd);
      return (Number.isInteger(value) ? String(value) : value.toFixed(1)) + '%';
    }

    function parsePercent(input) {
      var match = /^(\d+(?:\.\d+)?)%$/.exec(String(input == null ? '' : input).trim());
      if (!match) return null;
      var value = Number(match[1]);
      if (!Number.isFinite(value) || value < 0 || value > 100) return { invalid: true };
      return { value: value };
    }

    function searchForward(text, query, from) {
      if (!query) return -1;
      return text.indexOf(query, Math.max(0, from));
    }

    function searchBackward(text, query, from) {
      if (!query) return -1;
      return text.lastIndexOf(query, Math.max(0, from));
    }

    /**
     * Collect literal or regex matches up to `limit` for navigation and a
     * "current/total" counter.  Scanning is cached by the store per query.
     */
    function collectSearchMatches(text, query, regexMode, limit) {
      var matches = [];
      var cap = Math.max(1, Math.trunc(limit) || 20000);
      if (!query) return { matches: matches, truncated: false };
      if (!regexMode) {
        var position = 0;
        while (matches.length < cap) {
          var found = text.indexOf(query, position);
          if (found < 0) break;
          matches.push({ index: found, length: query.length });
          position = found + Math.max(1, query.length);
        }
        return { matches: matches, truncated: matches.length >= cap };
      }
      var pattern;
      try {
        pattern = new RegExp(query, 'gu');
      } catch (error) {
        return {
          matches: matches,
          truncated: false,
          error: error && error.message ? error.message : String(error),
        };
      }
      var match;
      pattern.lastIndex = 0;
      while (matches.length < cap && (match = pattern.exec(text)) !== null) {
        matches.push({ index: match.index, length: match[0].length });
        if (match[0].length === 0) pattern.lastIndex++;
        if (pattern.lastIndex > text.length) break;
      }
      return { matches: matches, truncated: matches.length >= cap };
    }
    function findSearchMatch(text, query, from, direction, regexMode) {
      var backwards = direction === 'prev';
      if (!regexMode) {
        var index = backwards ? searchBackward(text, query, from) : searchForward(text, query, from);
        return { index: index, length: index < 0 ? 0 : query.length };
      }
      var pattern;
      try {
        pattern = new RegExp(query, 'gu');
      } catch (error) {
        return { index: -1, length: 0, error: error && error.message ? error.message : String(error) };
      }
      if (backwards) {
        var last = null;
        var match;
        pattern.lastIndex = 0;
        while ((match = pattern.exec(text)) !== null) {
          if (match.index > from) break;
          last = match;
          if (match[0].length === 0) pattern.lastIndex++;
          if (pattern.lastIndex > text.length) break;
        }
        return last
          ? { index: last.index, length: last[0].length }
          : { index: -1, length: 0 };
      }
      pattern.lastIndex = Math.max(0, from);
      var next = pattern.exec(text);
      return next
        ? { index: next.index, length: next[0].length }
        : { index: -1, length: 0 };
    }

    function countCjk(text) {
      var count = 0;
      for (var i = 0; i < text.length; i++) {
        var cp = text.charCodeAt(i);
        if (cp >= 0x4e00 && cp <= 0x9fff) count++;
      }
      return count;
    }

    function scoreText(text) {
      var common = 0;
      var cjk = 0;
      var punct = 0;
      var bad = 0;
      var limit = Math.min(text.length, 20000);
      for (var i = 0; i < limit; i++) {
        var ch = text[i];
        var cp = text.charCodeAt(i);
        if (COMMON_SET.has(ch)) common++;
        if (cp >= 0x4e00 && cp <= 0x9fff) cjk++;
        if (ch === '\uFFFD') bad += 3;
        else if (cp < 0x20 && ch !== '\t' && ch !== '\n' && ch !== '\r') bad++;
        else if (cp >= 0xe000 && cp <= 0xf8ff) bad += 2;
        else if (PUNCT.test(ch)) punct++;
      }
      return common * 4 + cjk * 0.2 + punct * 0.3 - bad * 5;
    }

    function tryDecode(bytes, label) {
      var length = bytes.length;
      // A sample may cut a multi-byte character at its tail.  Try a few
      // shorter tails before declaring the whole sample invalid.
      for (var trim = 0; trim < 4 && trim < length; trim++) {
        try {
          var decoder = new TextDecoder(label, { fatal: true });
          return { ok: true, text: decoder.decode(bytes.subarray(0, length - trim)) };
        } catch (error) {
          // keep trimming
        }
      }
      return { ok: false, text: '' };
    }

    function asciiRatio(bytes) {
      if (!bytes.length) return 0;
      var ascii = 0;
      for (var i = 0; i < bytes.length; i++) if (bytes[i] < 0x80) ascii++;
      return ascii / bytes.length;
    }

    function detectEncoding(input) {
      var bytes = input instanceof Uint8Array ? input : new Uint8Array(input || []);
      if (bytes.length === 0) return { kind: 'utf-8', label: 'UTF-8', bom: 0 };
      if (bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xfe && bytes[2] === 0x00 && bytes[3] === 0x00) {
        return { kind: 'utf-32le', label: 'UTF-32 LE', bom: 4 };
      }
      if (bytes.length >= 4 && bytes[0] === 0x00 && bytes[1] === 0x00 && bytes[2] === 0xfe && bytes[3] === 0xff) {
        return { kind: 'utf-32be', label: 'UTF-32 BE', bom: 4 };
      }
      if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
        return { kind: 'utf-8', label: 'UTF-8', bom: 3 };
      }
      if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
        return { kind: 'utf-16le', label: 'UTF-16 LE', bom: 2 };
      }
      if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
        return { kind: 'utf-16be', label: 'UTF-16 BE', bom: 2 };
      }

      var sample = bytes.subarray(0, Math.min(bytes.length, 65536));
      var groups = Math.floor(sample.length / 4);
      var zero = [0, 0, 0, 0];
      for (var z = 0; z < sample.length; z++) if (sample[z] === 0) zero[z % 4]++;
      if (groups >= 8) {
        if (zero[1] / groups > 0.7 && zero[2] / groups > 0.7 && zero[3] / groups > 0.7) {
          return { kind: 'utf-32le', label: 'UTF-32 LE', bom: 0 };
        }
        if (zero[0] / groups > 0.7 && zero[1] / groups > 0.7 && zero[2] / groups > 0.7) {
          return { kind: 'utf-32be', label: 'UTF-32 BE', bom: 0 };
        }
      }

      var pairs = Math.floor(sample.length / 2);
      var evenZeros = 0;
      var oddZeros = 0;
      for (var p = 0; p + 1 < sample.length; p += 2) {
        if (sample[p] === 0) evenZeros++;
        if (sample[p + 1] === 0) oddZeros++;
      }
      if (pairs >= 8) {
        if (oddZeros / pairs > 0.2 && evenZeros / pairs < 0.05) {
          return { kind: 'utf-16le', label: 'UTF-16 LE', bom: 0 };
        }
        if (evenZeros / pairs > 0.2 && oddZeros / pairs < 0.05) {
          return { kind: 'utf-16be', label: 'UTF-16 BE', bom: 0 };
        }
      }

      var utf8 = tryDecode(sample, 'utf-8');
      if (utf8.ok) return { kind: 'utf-8', label: 'UTF-8', bom: 0 };

      // Files that contain NUL bytes but did not match the simple pattern are
      // often UTF-16 without a BOM.  Compare both endiannesses before falling
      // back to the Chinese legacy encodings.
      if (zero[0] + zero[1] + zero[2] + zero[3] > sample.length * 0.02) {
        var le = tryDecode(sample, 'utf-16le');
        var be = tryDecode(sample, 'utf-16be');
        if (le.ok || be.ok) {
          if (le.ok && !be.ok) return { kind: 'utf-16le', label: 'UTF-16 LE', bom: 0 };
          if (be.ok && !le.ok) return { kind: 'utf-16be', label: 'UTF-16 BE', bom: 0 };
          if (le.ok && be.ok) {
            return scoreText(le.text) >= scoreText(be.text)
              ? { kind: 'utf-16le', label: 'UTF-16 LE', bom: 0, uncertain: true }
              : { kind: 'utf-16be', label: 'UTF-16 BE', bom: 0, uncertain: true };
          }
        }
      }

      var gb = tryDecode(sample, 'gb18030');
      var big5 = tryDecode(sample, 'big5');
      if (gb.ok && !big5.ok) return { kind: 'gb18030', label: 'GB18030', bom: 0 };
      if (big5.ok && !gb.ok) return { kind: 'big5', label: 'Big5', bom: 0 };
      if (gb.ok && big5.ok) {
        var gbScore = scoreText(gb.text);
        var bigScore = scoreText(big5.text);
        return gbScore >= bigScore
          ? { kind: 'gb18030', label: 'GB18030', bom: 0 }
          : { kind: 'big5', label: 'Big5', bom: 0 };
      }

      // Unknown legacy bytes: import as UTF-8 with replacement characters so
      // the reader remains usable, but tell the user the guess was uncertain.
      var fallbackAscii = asciiRatio(sample) > 0.9;
      return {
        kind: 'utf-8',
        label: fallbackAscii ? 'UTF-8' : 'UTF-8 (?)',
        bom: 0,
        uncertain: true,
      };
    }

    function createUtf32Decoder(littleEndian) {
      var pending = new Uint8Array(0);
      var first = true;
      function decodeChunk(bytes, final) {
        var combined = new Uint8Array(pending.length + bytes.length);
        combined.set(pending, 0);
        combined.set(bytes, pending.length);
        var usable = final ? combined.length - (combined.length % 4) : combined.length - (combined.length % 4);
        var out = [];
        var result = '';
        for (var i = 0; i < usable; i += 4) {
          var cp = littleEndian
            ? (combined[i] | (combined[i + 1] << 8) | (combined[i + 2] << 16) | (combined[i + 3] << 24)) >>> 0
            : ((combined[i] << 24) | (combined[i + 1] << 16) | (combined[i + 2] << 8) | combined[i + 3]) >>> 0;
          if (first) {
            first = false;
            if (cp === 0xfeff) continue;
          }
          if (cp === 0 || cp > 0x10ffff || (cp >= 0xd800 && cp <= 0xdfff)) {
            out.push(0xfffd);
          } else {
            out.push(cp);
          }
          if (out.length >= 8192) {
            result += String.fromCodePoint.apply(String, out);
            out.length = 0;
          }
        }
        if (out.length) result += String.fromCodePoint.apply(String, out);
        pending = combined.subarray(usable);
        if (final && pending.length) result += '\uFFFD';
        if (final) pending = new Uint8Array(0);
        return result;
      }
      return {
        decode: function (bytes, final) {
          return decodeChunk(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes), final === true);
        },
      };
    }

    function createStreamDecoder(encoding) {
      var first = true;
      var bom = encoding.bom || 0;
      if (encoding.kind === 'utf-32le' || encoding.kind === 'utf-32be') {
        var inner = createUtf32Decoder(encoding.kind === 'utf-32le');
        return {
          decode: function (bytes, final) {
            var chunk = bytes;
            if (first) {
              first = false;
              chunk = chunk.subarray(Math.min(bom, chunk.length));
            }
            return inner.decode(chunk, final);
          },
        };
      }
      var native = new TextDecoder(encoding.kind, { fatal: false, ignoreBOM: true });
      return {
        decode: function (bytes, final) {
          var chunk = bytes;
          if (first) {
            first = false;
            if (bom) chunk = chunk.subarray(Math.min(bom, chunk.length));
          }
          return native.decode(chunk, { stream: final !== true });
        },
      };
    }

    function decodeAll(bytes, encoding) {
      var data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || []);
      if (encoding.kind === 'utf-32le' || encoding.kind === 'utf-32be') {
        return createUtf32Decoder(encoding.kind === 'utf-32le')
          .decode(data.subarray(Math.min(encoding.bom || 0, data.length)), true);
      }
      var decoder = new TextDecoder(encoding.kind, { fatal: false, ignoreBOM: true });
      return decoder.decode(data.subarray(Math.min(encoding.bom || 0, data.length)));
    }

    // -----------------------------------------------------------------------
    // EPUB support.  An EPUB is a ZIP container; the text lives in XHTML
    // documents referenced by the OPF spine.  This is a deliberately small
    // reader: no DRM, no ZIP64, no images, no CSS layout.
    // -----------------------------------------------------------------------

    function unescapeXml(value) {
      return String(value == null ? '' : value).replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, function (all, body) {
        if (body.charAt(0) === '#') {
          var hex = body.charAt(1).toLowerCase() === 'x';
          var code = parseInt(body.slice(hex ? 2 : 1), hex ? 16 : 10);
          if (Number.isFinite(code) && code > 0 && code <= 0x10ffff) return String.fromCodePoint(code);
          return all;
        }
        var map = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00a0' };
        return Object.prototype.hasOwnProperty.call(map, body.toLowerCase()) ? map[body.toLowerCase()] : all;
      });
    }

    function parseXmlAttrs(tag) {
      var attrs = {};
      var re = /([A-Za-z_:][\w:.-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
      var match;
      while ((match = re.exec(tag)) !== null) {
        attrs[match[1]] = unescapeXml(match[2] !== undefined ? match[2] : match[3]);
      }
      return attrs;
    }

    function parseContainerXml(text) {
      var match = /<rootfile\b[^>]*\bfull-path\s*=\s*(?:"([^"]*)"|'([^']*)')/i.exec(text);
      if (!match) return null;
      var path = unescapeXml(match[1] !== undefined ? match[1] : match[2]).replace(/^\.?\//, '');
      try { path = decodeURIComponent(path); } catch (error) { /* keep raw */ }
      return path;
    }

    function resolveHref(basePath, href) {
      var value = unescapeXml(href).split('#')[0].split('?')[0];
      try { value = decodeURIComponent(value); } catch (error) { /* keep raw */ }
      var parts = String(basePath || '').split('/');
      parts.pop();
      value.split('/').forEach(function (part) {
        if (!part || part === '.') return;
        if (part === '..') {
          if (parts.length) parts.pop();
        } else {
          parts.push(part);
        }
      });
      return parts.join('/');
    }

    function parseOpf(text) {
      var manifest = {};
      var itemTags = text.match(/<item\b[^>]*>/gi) || [];
      itemTags.forEach(function (tag) {
        var attrs = parseXmlAttrs(tag);
        if (!attrs.id || !attrs.href) return;
        manifest[attrs.id] = {
          id: attrs.id,
          href: attrs.href,
          mediaType: attrs['media-type'] || '',
          properties: attrs.properties || '',
        };
      });
      var spine = [];
      var refTags = text.match(/<itemref\b[^>]*>/gi) || [];
      refTags.forEach(function (tag) {
        var attrs = parseXmlAttrs(tag);
        if (attrs.idref && attrs.linear !== 'no') spine.push(attrs.idref);
      });
      return { manifest: manifest, spine: spine };
    }

    function htmlToText(html) {
      var text = String(html == null ? '' : html)
        .replace(/<!--[\s\S]*?-->/g, '')
        .replace(/<(script|style|head|title)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
        .replace(/<br\b[^>]*\/?>/gi, '\n')
        .replace(/<\/(p|div|h[1-6]|li|tr|blockquote|section|article|pre|figcaption|td|th|dt|dd)\s*>/gi, '\n')
        .replace(/<(p|div|h[1-6]|li|tr|blockquote|section|article|pre|figcaption|td|th|dt|dd)\b[^>]*>/gi, '\n')
        .replace(/<[^>]*>/g, '');
      text = unescapeXml(text)
        .replace(/\u00a0/g, ' ')
        .replace(/\r\n?/g, '\n')
        .replace(/[ \t\f\v]+/g, ' ')
        .replace(/ *\n */g, '\n')
        .replace(/\n{2,}/g, '\n')
        .trim();
      return text;
    }

    function parseZipEntries(input) {
      var bytes = input instanceof Uint8Array ? input : new Uint8Array(input || []);
      var view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      var eocd = -1;
      var min = Math.max(0, bytes.length - 22 - 65535);
      for (var i = bytes.length - 22; i >= min; i--) {
        if (view.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
      }
      if (eocd < 0) throw new Error('不是有效的 ZIP/EPUB 文件');
      var count = view.getUint16(eocd + 10, true);
      var cdOffset = view.getUint32(eocd + 16, true);
      if (count === 0xffff || cdOffset === 0xffffffff) throw new Error('暂不支持 ZIP64 EPUB');
      var entries = [];
      var cursor = cdOffset;
      for (var index = 0; index < count; index++) {
        if (cursor + 46 > bytes.length) throw new Error('EPUB 目录损坏');
        if (view.getUint32(cursor, true) !== 0x02014b50) throw new Error('EPUB 目录损坏');
        var flags = view.getUint16(cursor + 8, true);
        var method = view.getUint16(cursor + 10, true);
        var compressedSize = view.getUint32(cursor + 20, true);
        var uncompressedSize = view.getUint32(cursor + 24, true);
        var nameLength = view.getUint16(cursor + 28, true);
        var extraLength = view.getUint16(cursor + 30, true);
        var commentLength = view.getUint16(cursor + 32, true);
        var localOffset = view.getUint32(cursor + 42, true);
        if (compressedSize === 0xffffffff || uncompressedSize === 0xffffffff || localOffset === 0xffffffff) {
          throw new Error('暂不支持 ZIP64 EPUB');
        }
        var nameBytes = bytes.subarray(cursor + 46, cursor + 46 + nameLength);
        var name = new TextDecoder(flags & 0x800 ? 'utf-8' : 'utf-8').decode(nameBytes).replace(/\\/g, '/');
        entries.push({
          name: name,
          method: method,
          compressedSize: compressedSize,
          uncompressedSize: uncompressedSize,
          localOffset: localOffset,
          flags: flags,
        });
        cursor += 46 + nameLength + extraLength + commentLength;
      }
      return entries;
    }

    async function readZipEntry(input, entry) {
      var bytes = input instanceof Uint8Array ? input : new Uint8Array(input || []);
      if (entry.flags & 0x1) throw new Error('不支持加密的 EPUB');
      var view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      var local = entry.localOffset;
      if (local + 30 > bytes.length || view.getUint32(local, true) !== 0x04034b50) {
        throw new Error('EPUB 条目损坏');
      }
      var nameLength = view.getUint16(local + 26, true);
      var extraLength = view.getUint16(local + 28, true);
      var start = local + 30 + nameLength + extraLength;
      var end = start + entry.compressedSize;
      if (end > bytes.length) throw new Error('EPUB 条目损坏');
      var compressed = bytes.subarray(start, end);
      if (entry.method === 0) return compressed;
      if (entry.method !== 8) throw new Error('不支持的 EPUB 压缩方式');
      if (typeof DecompressionStream !== 'function') throw new Error('当前环境不支持解压 EPUB');
      var stream = new Blob([compressed]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
      return new Uint8Array(await new Response(stream).arrayBuffer());
    }

    async function epubToText(input) {
      var bytes = input instanceof Uint8Array ? input : new Uint8Array(input || []);
      var entries = parseZipEntries(bytes);
      var byName = {};
      entries.forEach(function (entry) { byName[entry.name] = entry; });
      function findEntry(name) {
        if (!name) return null;
        if (byName[name]) return byName[name];
        var clean = name.replace(/^\.\//, '');
        if (byName[clean]) return byName[clean];
        var lower = clean.toLowerCase();
        return entries.find(function (entry) { return entry.name.toLowerCase() === lower; }) || null;
      }
      var textDecoder = new TextDecoder('utf-8', { fatal: false });
      var containerEntry = findEntry('META-INF/container.xml');
      if (!containerEntry) throw new Error('EPUB 缺少 META-INF/container.xml');
      var containerText = textDecoder.decode(await readZipEntry(bytes, containerEntry));
      var opfPath = parseContainerXml(containerText);
      if (!opfPath) throw new Error('EPUB 缺少 OPF 路径');
      var opfEntry = findEntry(opfPath);
      if (!opfEntry) throw new Error('EPUB 缺少 OPF 文件');
      var opfText = textDecoder.decode(await readZipEntry(bytes, opfEntry));
      var pkg = parseOpf(opfText);
      var order = pkg.spine.slice();
      if (!order.length) order = Object.keys(pkg.manifest);
      var chapters = [];
      for (var i = 0; i < order.length; i++) {
        var item = pkg.manifest[order[i]];
        if (!item) continue;
        var mediaType = String(item.mediaType || '').toLowerCase();
        var href = String(item.href || '').toLowerCase();
        var isHtml = mediaType.indexOf('xhtml') >= 0 || mediaType.indexOf('html') >= 0
          || /\.x?html?$/.test(href);
        if (!isHtml) continue;
        var entry = findEntry(resolveHref(opfPath, item.href));
        if (!entry) continue;
        var html = textDecoder.decode(await readZipEntry(bytes, entry));
        var text = htmlToText(html);
        if (text) chapters.push(text);
      }
      if (!chapters.length) throw new Error('未找到可读的 EPUB 章节');
      return {
        text: chapters.join('\n\n'),
        encoding: 'EPUB',
        chapterCount: chapters.length,
      };
    }

    function stripExtension(name) {
      var value = String(name == null ? '' : name).trim();
      var slash = Math.max(value.lastIndexOf('/'), value.lastIndexOf('\\'));
      if (slash >= 0) value = value.slice(slash + 1);
      value = value.replace(/\.[^.]+$/, '');
      return value || '未命名';
    }

    function uniqueAlias(base, books) {
      var name = String(base == null ? '' : base).trim() || '未命名';
      var existing = new Set((books || []).map(function (book) { return book.alias; }));
      if (!existing.has(name)) return name;
      var index = 2;
      while (existing.has(name + ' (' + index + ')')) index++;
      return name + ' (' + index + ')';
    }

    function clampCursor(cursor, total) {
      var c = Math.trunc(cursor) || 0;
      if (c < 0) c = 0;
      if (total > 0 && c > total) c = total;
      return c;
    }

    return {
      DEFAULT_SETTINGS: DEFAULT_SETTINGS,
      COMMON_SET: COMMON_SET,
      clampInt: clampInt,
      sanitizeSettings: sanitizeSettings,
      normalizeShortcut: normalizeShortcut,
      shortcutFromEvent: shortcutFromEvent,
      shortcutLabel: shortcutLabel,
      sanitizeShortcuts: sanitizeShortcuts,
      normalizeText: normalizeText,
      isReadableText: isReadableText,
      readPage: readPage,
      fitPage: fitPage,
      previousPageStart: previousPageStart,
      lastPageStart: lastPageStart,
      jumpPercent: jumpPercent,
      percent: percent,
      labelPercent: labelPercent,
      parsePercent: parsePercent,
      searchForward: searchForward,
      searchBackward: searchBackward,
      findSearchMatch: findSearchMatch,
      collectSearchMatches: collectSearchMatches,
      countCjk: countCjk,
      scoreText: scoreText,
      detectEncoding: detectEncoding,
      createStreamDecoder: createStreamDecoder,
      createUtf32Decoder: createUtf32Decoder,
      decodeAll: decodeAll,
      parseZipEntries: parseZipEntries,
      readZipEntry: readZipEntry,
      epubToText: epubToText,
      htmlToText: htmlToText,
      parseOpf: parseOpf,
      parseContainerXml: parseContainerXml,
      resolveHref: resolveHref,
      stripExtension: stripExtension,
      uniqueAlias: uniqueAlias,
      clampCursor: clampCursor,
    };
  })();

  // ---------------------------------------------------------------------------
  // Locale dictionaries (flat keys, registered into the Client locale service).
  // ---------------------------------------------------------------------------

  var EN = {
    'section.label': 'DSH Fish Reader',
    'section.title': 'DSH Fish Reader',
    'section.description': 'A quiet local TXT/EPUB reader tucked into the composer placeholder.',
    'library.title': 'DSH Fish Reader library',
    'library.open': 'Open DSH Fish Reader library',
    'library.short': 'Reader',
    'library.close': 'Close',
    'library.tab.books': 'Books',
    'library.tab.settings': 'Settings',
    'library.import': 'Batch import TXT / EPUB',
    'library.importHint': 'Select multiple files, or drop TXT/EPUB files here.',
    'library.importing': 'Importing {name} ({index}/{total})',
    'library.empty': 'The library is empty. Import a TXT or EPUB file to start reading.',
    'library.emptyHint': 'The original file is never modified or moved.',
    'library.openBook': 'Open',
    'library.resume': 'Resume',
    'library.closeBook': 'Close reader',
    'library.rename': 'Rename',
    'library.delete': 'Delete',
    'library.deleteConfirm': 'Delete this library copy?',
    'library.deleteNote': 'Only the imported copy and its progress are removed. Your original file is untouched.',
    'library.confirm': 'Delete',
    'library.batch': 'Select',
    'library.batchCancel': 'Cancel selection',
    'library.batchSelectAll': 'Select all',
    'library.batchSelected': '{count} selected',
    'library.batchDelete': 'Delete selected',
    'library.batchConfirmNote': 'Delete {count} selected book(s)? Only imported copies and progress are removed.',
    'library.batchConfirm': 'Delete',
    'library.batchDeleteSomeFailed': 'Could not remove {count} book(s) from local storage.',
    'notice.deletedMany': 'Deleted {count} book(s).',
    'library.cancel': 'Cancel',
    'library.save': 'Save',
    'library.original': 'Original',
    'library.chars': '{count} chars',
    'library.chapters': '{count} chapters',
    'library.active': 'Reading',
    'library.lastRead': 'Last at {percent}%',
    'library.neverRead': 'Not started',
    'library.importDone': 'Imported {count} book(s).',
    'library.importDoneSome': 'Imported {count} book(s); {failed} failed.',
    'library.importAllFailed': 'Import failed for {count} file(s): {message}',
    'library.importFailed': 'Import failed: {message}',
    'library.storageError': 'Local storage is unavailable, so the library cannot be saved.',
    'library.missingCopy': 'This library copy is missing. Delete the row and import again.',
    'library.copyNote': 'Books, progress and settings stay in this browser profile. No messages are sent to the conversation or the model.',
    'library.loading': 'Loading…',
    'library.progressLabel': 'Reading progress',
    'settings.pageSize': 'Maximum characters per segment',
    'settings.pageSizeHint': 'Narrow windows automatically show fewer characters; the next segment continues exactly where the visible text ended.',
    'settings.hiddenSeconds': 'Auto-hide after (seconds)',
    'settings.hiddenSecondsHint': '0 disables auto-hide. Hiding returns the composer to its native placeholder; progress and buttons disappear with the reader.',
    'settings.trim': 'Trim next segment',
    'settings.trimHint': 'Removes leading and trailing whitespace from displayed segments. It never skips text in the middle.',
    'settings.shortcuts': 'Shortcuts',
    'settings.shortcutsText': 'Defaults: Alt+, / Alt+. / Alt+/ / Alt+F. Change them below.',
    'settings.shortcutPrev': 'Previous segment',
    'settings.shortcutNext': 'Next segment',
    'settings.shortcutBoss': 'Hide / show reader',
    'settings.shortcutSearch': 'Search',
    'settings.shortcutEdit': 'Change',
    'settings.shortcutCancel': 'Cancel',
    'settings.shortcutReset': 'Reset defaults',
    'settings.shortcutRecording': 'Press new shortcut…',
    'settings.shortcutHint': 'Click Change, then press a combination containing Alt, Ctrl or Meta. Esc cancels. Avoid combinations already used by DSH.',
    'settings.shortcutErrorModifier': 'Shortcut must contain Alt, Ctrl or Meta.',
    'settings.shortcutErrorDuplicate': 'That shortcut is already used by another reader action.',
    'settings.shortcutSaved': 'Shortcut saved: {shortcut}',
    'settings.shortcutResetDone': 'Reader shortcuts reset to defaults.',
    'settings.localOnly': 'Everything is stored locally in this browser profile.',
    'settings.resetHint': 'Changes save immediately.',
    'reader.searchPlaceholder': 'Search or 12.5% to jump',
    'reader.regexPlaceholder': 'Enter a regular expression',
    'reader.searchButton': 'Search (Alt+F)',
    'reader.regex': 'Regex',
    'reader.regexHint': 'Use a JavaScript regular expression (u flag, case-sensitive)',
    'reader.invalidRegex': 'Invalid regular expression',
    'reader.findPrev': 'Find previous',
    'reader.findNext': 'Find next',
    'reader.go': 'Go',
    'reader.cancel': 'Cancel',
    'reader.prev': 'Previous segment (Alt+,)',
    'reader.next': 'Next segment (Alt+.)',
    'reader.boss': 'Hide / show reader',
    'reader.loading': 'Loading…',
    'reader.empty': 'This book has no readable text.',
    'reader.end': 'End of book',
    'reader.start': 'Start of book',
    'reader.notFound': 'Not found',
    'reader.noPrevious': 'No previous match',
    'reader.noNext': 'No next match',
    'reader.found': 'Found',
    'reader.searchEmpty': 'Type something to search.',
    'reader.invalidPercent': 'Percentage must be between 0 and 100.',
    'reader.percentJump': 'Jumped to {percent}%',
    'reader.clickHint': 'Click to search or jump by percentage',
    'reader.searchTitle': 'Find text or jump by percentage',
    'reader.book': '“{alias}”',
    'reader.percent': '{percent}%',
    'notice.closeBook': 'Reader closed.',
    'notice.deleted': 'Deleted “{alias}” from the library.',
    'notice.renamed': 'Renamed to “{alias}”.',
    'notice.encodingGuess': 'Encoding was uncertain; imported as UTF-8.',
  };

  var ZH = {
    'section.label': 'DSH Fish Reader',
    'section.title': 'DSH Fish Reader',
    'section.description': '藏在输入框待输入区的本地 TXT/EPUB 阅读器。',
    'library.title': 'DSH Fish Reader 书库',
    'library.open': '打开 DSH Fish Reader 书库',
    'library.short': '阅读',
    'library.close': '关闭',
    'library.tab.books': '书籍',
    'library.tab.settings': '设置',
    'library.import': '批量导入 TXT / EPUB',
    'library.importHint': '可一次选择多个文件，也可以把 TXT/EPUB 拖到这里。',
    'library.importing': '正在导入 {name}（{index}/{total}）',
    'library.empty': '书库还是空的。导入一本 TXT 或 EPUB 开始阅读。',
    'library.emptyHint': '原始文件不会被修改或移动。',
    'library.openBook': '打开',
    'library.resume': '继续',
    'library.closeBook': '关闭阅读',
    'library.rename': '改名',
    'library.delete': '删除',
    'library.deleteConfirm': '删除这个书库副本？',
    'library.deleteNote': '只会删除导入的副本和进度，原始文件保持不动。',
    'library.confirm': '删除',
    'library.batch': '批量选择',
    'library.batchCancel': '取消选择',
    'library.batchSelectAll': '全选',
    'library.batchSelected': '已选 {count} 本',
    'library.batchDelete': '删除选中',
    'library.batchConfirmNote': '确定删除选中的 {count} 本书？只删除导入副本和进度。',
    'library.batchConfirm': '删除',
    'library.batchDeleteSomeFailed': '{count} 本书删除失败。',
    'notice.deletedMany': '已删除 {count} 本书。',
    'library.cancel': '取消',
    'library.save': '保存',
    'library.original': '原始文件',
    'library.chars': '{count} 字',
    'library.chapters': '{count} 章',
    'library.active': '正在阅读',
    'library.lastRead': '上次读到 {percent}%',
    'library.neverRead': '尚未开始',
    'library.importDone': '已导入 {count} 本书。',
    'library.importDoneSome': '已导入 {count} 本书，{failed} 本失败。',
    'library.importAllFailed': '{count} 个文件导入失败：{message}',
    'library.importFailed': '导入失败：{message}',
    'library.storageError': '本机存储不可用，书库无法保存。',
    'library.missingCopy': '书库副本已丢失。删除这一行后重新导入即可。',
    'library.copyNote': '书籍、进度和设置只保存在本机浏览器中。不会向当前对话或模型发送消息。',
    'library.loading': '载入中…',
    'library.progressLabel': '阅读进度',
    'settings.pageSize': '每段最多字数',
    'settings.pageSizeHint': '窗口变窄时会自动减少每段字数；下一段从上一段实际显示的末尾接续，不会漏字。',
    'settings.hiddenSeconds': '自动隐藏（秒）',
    'settings.hiddenSecondsHint': '0 表示不自动隐藏。隐藏后输入框回到原生 placeholder，正文、进度和按钮一起消失。',
    'settings.trim': '下一段去除首尾空白',
    'settings.trimHint': '只影响显示，不会跳过正文中间的文字。',
    'settings.shortcuts': '快捷键',
    'settings.shortcutsText': '默认：Alt+, / Alt+. / Alt+/ / Alt+F，可在下方修改。',
    'settings.shortcutPrev': '上一段',
    'settings.shortcutNext': '下一段',
    'settings.shortcutBoss': '隐藏 / 显示阅读',
    'settings.shortcutSearch': '搜索',
    'settings.shortcutEdit': '修改',
    'settings.shortcutCancel': '取消',
    'settings.shortcutReset': '恢复默认',
    'settings.shortcutRecording': '按下新快捷键…',
    'settings.shortcutHint': '点击“修改”后按下组合键，至少包含 Alt、Ctrl 或 Meta；Esc 取消。避免与 DSH 已有快捷键冲突。',
    'settings.shortcutErrorModifier': '快捷键至少包含 Alt、Ctrl 或 Meta。',
    'settings.shortcutErrorDuplicate': '该快捷键已被其他阅读操作使用。',
    'settings.shortcutSaved': '快捷键已保存：{shortcut}',
    'settings.shortcutResetDone': '阅读快捷键已恢复默认。',
    'settings.localOnly': '所有内容只保存在本机浏览器配置中。',
    'settings.resetHint': '修改会立即保存。',
    'reader.searchPlaceholder': '搜索内容或 12.5% 跳转',
    'reader.regexPlaceholder': '输入正则表达式',
    'reader.searchButton': '搜索 (Alt+F)',
    'reader.regex': '正则',
    'reader.regexHint': '使用 JavaScript 正则表达式（u 标志，区分大小写）',
    'reader.invalidRegex': '正则表达式无效',
    'reader.findPrev': '查找上一个',
    'reader.findNext': '查找下一个',
    'reader.go': '跳转',
    'reader.cancel': '取消',
    'reader.prev': '上一段 (Alt+,)',
    'reader.next': '下一段 (Alt+.)',
    'reader.boss': '隐藏 / 显示阅读',
    'reader.loading': '载入中…',
    'reader.empty': '这本书没有可读正文。',
    'reader.end': '已到末尾',
    'reader.start': '已到开头',
    'reader.notFound': '未找到',
    'reader.noPrevious': '没有上一个匹配',
    'reader.noNext': '没有下一个匹配',
    'reader.found': '已定位',
    'reader.searchEmpty': '请输入搜索内容。',
    'reader.invalidPercent': '百分比需在 0–100 之间。',
    'reader.percentJump': '已跳到 {percent}%',
    'reader.clickHint': '点击搜索或输入百分比跳转',
    'reader.searchTitle': '查找内容，或输入百分比跳转',
    'reader.book': '《{alias}》',
    'reader.percent': '{percent}%',
    'notice.closeBook': '已关闭阅读栏。',
    'notice.deleted': '已从书库删除《{alias}》。',
    'notice.renamed': '已改名为《{alias}》。',
    'notice.encodingGuess': '编码识别不确定，已按 UTF-8 导入。',
  };

  function formatText(template, vars) {
    return String(template == null ? '' : template).replace(/\{(\w+)\}/g, function (all, key) {
      return vars && Object.prototype.hasOwnProperty.call(vars, key) ? String(vars[key]) : all;
    });
  }

  // ---------------------------------------------------------------------------
  // Local persistence helpers.
  // ---------------------------------------------------------------------------

  function readJson(key, fallback) {
    try {
      var raw = window.localStorage.getItem(key);
      if (raw == null) return fallback;
      return JSON.parse(raw);
    } catch (error) {
      return fallback;
    }
  }

  function writeJson(key, value) {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      return false;
    }
  }

  function readString(key) {
    try {
      return window.localStorage.getItem(key);
    } catch (error) {
      return null;
    }
  }

  function migrateLegacyLocalStorage() {
    var keys = [
      ['settings', LS_SETTINGS],
      ['library', LS_LIBRARY],
      ['progress', LS_PROGRESS],
      ['last', LS_LAST],
    ];
    for (var i = 0; i < keys.length; i++) {
      var name = keys[i][0];
      var next = keys[i][1];
      if (readString(next) != null) continue;
      var previous = readString(LEGACY_LS_PREFIX + name);
      if (previous == null) continue;
      try { window.localStorage.setItem(next, previous); } catch (error) { /* best effort */ }
    }
  }

  function newId() {
    try {
      if (window.crypto && typeof window.crypto.randomUUID === 'function') return window.crypto.randomUUID();
    } catch (error) {
      // fall through
    }
    return 'book-' + Date.now() + '-' + Math.random().toString(36).slice(2, 10);
  }

  function sanitizeMeta(value) {
    if (!value || typeof value !== 'object') return null;
    if (typeof value.id !== 'string' || !value.id) return null;
    var charCount = typeof value.charCount === 'number' && Number.isFinite(value.charCount)
      ? Math.max(0, Math.trunc(value.charCount)) : 0;
    return {
      id: value.id,
      alias: typeof value.alias === 'string' && value.alias.trim() ? value.alias.trim() : '未命名',
      sourceName: typeof value.sourceName === 'string' ? value.sourceName : '',
      encoding: typeof value.encoding === 'string' ? value.encoding : '',
      format: value.format === 'epub' ? 'epub' : 'txt',
      chapterCount: typeof value.chapterCount === 'number' && Number.isFinite(value.chapterCount)
        ? Math.max(0, Math.trunc(value.chapterCount)) : 0,
      uncertain: value.uncertain === true,
      charCount: charCount,
      bytes: typeof value.bytes === 'number' && Number.isFinite(value.bytes) ? Math.max(0, Math.trunc(value.bytes)) : 0,
      importedAt: typeof value.importedAt === 'string' ? value.importedAt : '',
    };
  }

  function readLibrary() {
    var raw = readJson(LS_LIBRARY, []);
    if (!Array.isArray(raw)) return [];
    return raw.map(sanitizeMeta).filter(Boolean);
  }

  function readProgressMap() {
    var raw = readJson(LS_PROGRESS, {});
    var out = {};
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
    Object.keys(raw).forEach(function (id) {
      var item = raw[id];
      if (!item || typeof item !== 'object') return;
      var cursor = Number(item.cursor);
      if (!Number.isFinite(cursor)) return;
      out[id] = {
        cursor: Math.max(0, Math.trunc(cursor)),
        history: Array.isArray(item.history)
          ? item.history.filter(function (n) { return Number.isInteger(n) && n >= 0; }).slice(-200)
          : [],
        percent: Number.isFinite(Number(item.percent)) ? Number(item.percent) : 0,
        updatedAt: Number.isFinite(Number(item.updatedAt)) ? Number(item.updatedAt) : 0,
      };
    });
    return out;
  }

  // ---------------------------------------------------------------------------
  // IndexedDB: book bodies live here, metadata and progress live in localStorage.
  // ---------------------------------------------------------------------------

  var databasePromise = null;

  function openNewDatabase() {
    return new Promise(function (resolve, reject) {
      var idb = window.indexedDB;
      if (!idb) {
        reject(new Error('IndexedDB is unavailable'));
        return;
      }
      var request = idb.open(DB_NAME, 1);
      request.onupgradeneeded = function () {
        var db = request.result;
        if (!db.objectStoreNames.contains('books')) {
          db.createObjectStore('books', { keyPath: 'id' });
        }
      };
      request.onsuccess = function () { resolve(request.result); };
      request.onerror = function () { reject(request.error || new Error('IndexedDB open failed')); };
      request.onblocked = function () { reject(new Error('IndexedDB is blocked by another window')); };
    });
  }

  function openLegacyDatabase() {
    return new Promise(function (resolve) {
      var idb = window.indexedDB;
      if (!idb) {
        resolve(null);
        return;
      }
      var request;
      try {
        request = idb.open(LEGACY_DB_NAME);
      } catch (error) {
        resolve(null);
        return;
      }
      var creating = false;
      request.onupgradeneeded = function () {
        creating = true;
        try { request.transaction.abort(); } catch (error) { /* ignore */ }
      };
      request.onsuccess = function () {
        var db = request.result;
        if (creating || !db.objectStoreNames.contains('books')) {
          try { db.close(); } catch (error) { /* ignore */ }
          resolve(null);
          return;
        }
        resolve(db);
      };
      request.onerror = function () { resolve(null); };
      request.onblocked = function () { resolve(null); };
    });
  }

  async function migrateLegacyDatabase(db) {
    try {
      var count = await new Promise(function (resolve, reject) {
        var request = db.transaction('books', 'readonly').objectStore('books').count();
        request.onsuccess = function () { resolve(request.result || 0); };
        request.onerror = function () { reject(request.error || new Error('IndexedDB count failed')); };
      });
      if (count > 0) return;
      var legacy = await openLegacyDatabase();
      if (!legacy) return;
      var records = await new Promise(function (resolve, reject) {
        var request = legacy.transaction('books', 'readonly').objectStore('books').getAll();
        request.onsuccess = function () { resolve(request.result || []); };
        request.onerror = function () { reject(request.error || new Error('Legacy IndexedDB read failed')); };
      });
      if (records.length) {
        await new Promise(function (resolve, reject) {
          var tx = db.transaction('books', 'readwrite');
          var store = tx.objectStore('books');
          records.forEach(function (record) { store.put(record); });
          tx.oncomplete = function () { resolve(); };
          tx.onerror = function () { reject(tx.error || new Error('IndexedDB migration failed')); };
          tx.onabort = function () { reject(tx.error || new Error('IndexedDB migration aborted')); };
        });
      }
      try { legacy.close(); } catch (error) { /* ignore */ }
    } catch (error) {
      // Migration is best effort; keep the new library usable even if old data
      // cannot be read (for example when another window holds the old DB).
    }
  }

  function ensureDatabase() {
    if (databasePromise) return databasePromise;
    databasePromise = (async function () {
      var db = await openNewDatabase();
      await migrateLegacyDatabase(db);
      return db;
    })();
    return databasePromise;
  }

  function idbRequest(request) {
    return new Promise(function (resolve, reject) {
      request.onsuccess = function () { resolve(request.result); };
      request.onerror = function () { reject(request.error || new Error('IndexedDB request failed')); };
    });
  }

  async function idbGet(id) {
    var db = await ensureDatabase();
    return idbRequest(db.transaction('books', 'readonly').objectStore('books').get(id));
  }

  async function idbPut(record) {
    var db = await ensureDatabase();
    var tx = db.transaction('books', 'readwrite');
    tx.objectStore('books').put(record);
    await new Promise(function (resolve, reject) {
      tx.oncomplete = function () { resolve(); };
      tx.onerror = function () { reject(tx.error || new Error('IndexedDB write failed')); };
      tx.onabort = function () { reject(tx.error || new Error('IndexedDB write aborted')); };
    });
  }

  async function idbDelete(id) {
    var db = await ensureDatabase();
    var tx = db.transaction('books', 'readwrite');
    tx.objectStore('books').delete(id);
    await new Promise(function (resolve, reject) {
      tx.oncomplete = function () { resolve(); };
      tx.onerror = function () { reject(tx.error || new Error('IndexedDB delete failed')); };
      tx.onabort = function () { reject(tx.error || new Error('IndexedDB delete aborted')); };
    });
  }

  // ---------------------------------------------------------------------------
  // File import: chunked reads + stream decoding.
  // ---------------------------------------------------------------------------

  function createStreamDecoder(encoding) {
    return core.createStreamDecoder(encoding);
  }

  async function readTxtFile(file, onProgress) {
    if (!file || typeof file.size !== 'number') throw new Error('无效的文件');
    if (file.size === 0) throw new Error('文件为空');
    var sampleSize = Math.min(file.size, SAMPLE_BYTES);
    var sample = new Uint8Array(await file.slice(0, sampleSize).arrayBuffer());
    var encoding = core.detectEncoding(sample);
    var decoder = createStreamDecoder(encoding);
    var parts = [];
    var offset = 0;
    var firstYield = true;
    while (offset < file.size) {
      var end = Math.min(offset + CHUNK_BYTES, file.size);
      var chunk = new Uint8Array(await file.slice(offset, end).arrayBuffer());
      var final = end >= file.size;
      var decoded = decoder.decode(chunk, final);
      if (decoded) parts.push(decoded);
      offset = end;
      if (onProgress) onProgress(Math.min(1, offset / file.size));
      if (firstYield) {
        firstYield = false;
        await new Promise(function (resolve) { window.setTimeout(resolve, 0); });
      }
    }
    var text = core.normalizeText(parts.join(''));
    if (!text.trim()) throw new Error('没有可读正文');
    if (!core.isReadableText(text)) throw new Error('无法识别文件编码，或这不是可读的文本文件');
    return {
      text: text,
      encoding: encoding.label,
      uncertain: encoding.uncertain === true,
      format: 'txt',
    };
  }

  async function readEpubFile(file, onProgress) {
    if (!file || typeof file.size !== 'number') throw new Error('无效的文件');
    if (file.size === 0) throw new Error('文件为空');
    if (onProgress) onProgress(0.05);
    var buffer = await file.arrayBuffer();
    if (onProgress) onProgress(0.35);
    var result = await core.epubToText(new Uint8Array(buffer));
    if (onProgress) onProgress(0.9);
    var text = core.normalizeText(result.text);
    if (!text.trim()) throw new Error('EPUB 没有可读正文');
    if (onProgress) onProgress(1);
    return {
      text: text,
      encoding: 'EPUB',
      uncertain: false,
      format: 'epub',
      chapterCount: result.chapterCount,
    };
  }

  async function readImportFile(file, onProgress) {
    var head = new Uint8Array(await file.slice(0, 4).arrayBuffer());
    var zipMagic = head.length >= 4 && head[0] === 0x50 && head[1] === 0x4b
      && (head[2] === 0x03 || head[2] === 0x05);
    if (/\.epub$/i.test(file.name || '') || zipMagic) return readEpubFile(file, onProgress);
    return readTxtFile(file, onProgress);
  }

  // ---------------------------------------------------------------------------
  // Reactive store.
  // ---------------------------------------------------------------------------

  function createStore(tr) {
    var listeners = new Set();
    var disposed = false;
    var hideTimer = null;
    var noticeTimer = null;
    var progressMap = {};
    var visiblePage = null;
    var composerState = { draft: '', attachments: 0 };
    var searchMatchCache = null;

    var state = {
      ready: false,
      books: [],
      active: null,
      cursor: 0,
      history: [],
      lastBookId: null,
      hidden: false,
      inputMode: false,
      settings: Object.assign({}, DEFAULT_SETTINGS),
      libraryOpen: false,
      libraryTab: 'books',
      searchOpen: false,
      highlight: null,
      notice: null,
      loading: false,
      error: null,
      importing: null,
      shortcutCapture: null,
      shortcutError: null,
    };

    function get() { return state; }

    function emit() {
      if (disposed) return;
      listeners.forEach(function (listener) {
        try { listener(); } catch (error) { /* one broken listener must not block others */ }
      });
    }

    function set(patch) {
      if (disposed) return;
      state = Object.assign({}, state, patch);
      emit();
    }

    function subscribe(listener) {
      listeners.add(listener);
      return function () { listeners.delete(listener); };
    }

    function clearHide() {
      if (hideTimer !== null) {
        window.clearTimeout(hideTimer);
        hideTimer = null;
      }
    }

    function clearNoticeTimer() {
      if (noticeTimer !== null) {
        window.clearTimeout(noticeTimer);
        noticeTimer = null;
      }
    }

    function scheduleHide() {
      clearHide();
      if (!state.active || state.settings.hiddenSeconds <= 0 || state.libraryOpen || state.searchOpen) return;
      hideTimer = window.setTimeout(function () {
        hideTimer = null;
        if (disposed) return;
        if (!state.active || state.libraryOpen || state.searchOpen) return;
        set({ hidden: true });
      }, state.settings.hiddenSeconds * 1000);
    }

    function flash(text, tone) {
      clearNoticeTimer();
      var id = Date.now() + ':' + Math.random();
      set({ notice: { id: id, text: text, tone: tone || 'info' } });
      noticeTimer = window.setTimeout(function () {
        noticeTimer = null;
        if (state.notice && state.notice.id === id) set({ notice: null });
      }, 2600);
    }

    function saveLibrary(books) {
      var ok = writeJson(LS_LIBRARY, books);
      if (!ok) set({ error: tr('library.storageError') });
      return ok;
    }

    function saveProgress(percentValue) {
      if (!state.active) return;
      var total = state.active.text.length;
      progressMap[state.active.id] = {
        cursor: state.cursor,
        history: state.history.slice(-200),
        percent: typeof percentValue === 'number' ? percentValue : core.percent(state.cursor, total, state.cursor >= total),
        updatedAt: Date.now(),
      };
      writeJson(LS_PROGRESS, progressMap);
    }

    function init() {
      migrateLegacyLocalStorage();
      var settings = core.sanitizeSettings(readJson(LS_SETTINGS, DEFAULT_SETTINGS));
      var books = readLibrary();
      progressMap = readProgressMap();
      var last = readString(LS_LAST);
      if (last && !books.some(function (book) { return book.id === last; })) last = null;
      set({
        ready: true,
        settings: settings,
        books: books,
        lastBookId: last,
        libraryTab: 'books',
      });
    }

    async function openBook(id) {
      var meta = state.books.find(function (book) { return book.id === id; });
      if (!meta) return { ok: false, message: tr('library.missingCopy') };
      set({ loading: true, error: null, notice: null });
      try {
        var record = await idbGet(id);
        if (!record || typeof record.text !== 'string') throw new Error(tr('library.missingCopy'));
        var text = record.text;
        var progress = progressMap[id] || { cursor: 0, history: [] };
        var cursor = core.clampCursor(progress.cursor, text.length);
        var first = core.readPage(text, cursor, state.settings.pageSize, state.settings.trimNextLine);
        if (first.text.length === 0 && text.trim()) {
          // Older progress could point at or beyond the final newline.  Show
          // the last readable segment instead of an empty end-of-book page.
          cursor = core.lastPageStart(text, state.settings.pageSize);
          first = core.readPage(text, cursor, state.settings.pageSize, state.settings.trimNextLine);
        }
        cursor = first.start;
        var history = Array.isArray(progress.history)
          ? progress.history.filter(function (n) { return Number.isInteger(n) && n >= 0 && n <= text.length; }).slice(-200)
          : [];
        set({
          active: Object.assign({}, record, { alias: meta.alias }),
          cursor: cursor,
          history: history,
          lastBookId: id,
          hidden: false,
          inputMode: false,
          searchOpen: false,
          highlight: null,
          loading: false,
          error: null,
          notice: null,
        });
        writeJson(LS_LAST, id);
        saveProgress(core.percent(cursor, text.length, first.atEnd));
        scheduleHide();
        return { ok: true };
      } catch (error) {
        set({ loading: false, error: error && error.message ? error.message : String(error) });
        return { ok: false, message: state.error };
      }
    }

    function closeBook() {
      clearHide();
      clearNoticeTimer();
      set({
        active: null,
        cursor: 0,
        history: [],
        hidden: false,
        inputMode: false,
        searchOpen: false,
        highlight: null,
        notice: null,
        error: null,
      });
    }

    async function deleteBook(id) {
      var meta = state.books.find(function (book) { return book.id === id; });
      if (!meta) return { ok: false };
      try {
        await idbDelete(id);
      } catch (error) {
        set({ error: error && error.message ? error.message : String(error) });
        return { ok: false, message: state.error };
      }
      if (state.active && state.active.id === id) closeBook();
      delete progressMap[id];
      writeJson(LS_PROGRESS, progressMap);
      var books = state.books.filter(function (book) { return book.id !== id; });
      saveLibrary(books);
      set({ books: books, notice: null });
      if (state.lastBookId === id) {
        writeJson(LS_LAST, null);
        set({ lastBookId: null });
      }
      flash(tr('notice.deleted', { alias: meta.alias }), 'info');
      return { ok: true };
    }

    async function deleteBooks(ids) {
      var wanted = (Array.isArray(ids) ? ids : []).filter(function (id, index, list) {
        return typeof id === 'string' && list.indexOf(id) === index;
      });
      if (!wanted.length) return { ok: false };
      var deleted = [];
      var failures = [];
      for (var i = 0; i < wanted.length; i++) {
        try {
          await idbDelete(wanted[i]);
          deleted.push(wanted[i]);
        } catch (error) {
          failures.push(error && error.message ? error.message : String(error));
        }
      }
      if (!deleted.length) {
        set({ error: failures[0] || tr('library.storageError') });
        return { ok: false, failed: failures.length };
      }
      if (state.active && deleted.indexOf(state.active.id) >= 0) closeBook();
      deleted.forEach(function (id) { delete progressMap[id]; });
      writeJson(LS_PROGRESS, progressMap);
      var books = state.books.filter(function (book) { return deleted.indexOf(book.id) < 0; });
      var saved = saveLibrary(books);
      var patch = { books: books };
      if (state.lastBookId && deleted.indexOf(state.lastBookId) >= 0) {
        writeJson(LS_LAST, null);
        patch.lastBookId = null;
      }
      set(patch);
      if (failures.length) {
        set({ error: tr('library.batchDeleteSomeFailed', { count: failures.length }) });
        return { ok: false, deleted: deleted.length, failed: failures.length };
      }
      if (!saved) return { ok: false, deleted: deleted.length, failed: 0 };
      flash(tr('notice.deletedMany', { count: deleted.length }), 'info');
      return { ok: true, deleted: deleted.length };
    }

    function renameBook(id, alias) {
      var name = String(alias == null ? '' : alias).trim().slice(0, 80);
      if (!name) return { ok: false };
      var meta = state.books.find(function (book) { return book.id === id; });
      if (!meta) return { ok: false };
      var others = state.books.filter(function (book) { return book.id !== id; });
      var unique = core.uniqueAlias(name, others);
      var books = state.books.map(function (book) {
        return book.id === id ? Object.assign({}, book, { alias: unique }) : book;
      });
      saveLibrary(books);
      var patch = { books: books };
      if (state.active && state.active.id === id) {
        patch.active = Object.assign({}, state.active, { alias: unique });
      }
      set(patch);
      flash(tr('notice.renamed', { alias: unique }), 'success');
      return { ok: true, alias: unique };
    }

    function turn(advance, percentValue) {
      if (!state.active) return;
      if (!Number.isFinite(advance) || advance <= state.cursor) {
        flash(tr('reader.end'), 'info');
        return;
      }
      if (typeof percentValue !== 'number' || !Number.isFinite(percentValue)) {
        var nextPage = core.readPage(state.active.text, advance, state.settings.pageSize, state.settings.trimNextLine);
        percentValue = core.percent(advance, state.active.text.length, nextPage.atEnd);
      }
      var history = state.history.slice();
      if (history[history.length - 1] !== state.cursor) history.push(state.cursor);
      if (history.length > 200) history = history.slice(-200);
      set({
        cursor: advance,
        history: history,
        hidden: false,
          highlight: null,
        notice: null,
      });
      saveProgress(percentValue);
      scheduleHide();
    }

    /** Remember the exact visible end so keyboard paging never skips clipped text. */
    function setVisiblePage(pageInfo, bookId) {
      if (!pageInfo || !state.active || state.active.id !== bookId) return;
      visiblePage = {
        bookId: bookId,
        advance: pageInfo.advance,
        atEnd: pageInfo.atEnd === true,
      };
    }

    function nextVisible() {
      if (!state.active || state.inputMode) return;
      var advance = null;
      if (visiblePage && visiblePage.bookId === state.active.id) {
        if (visiblePage.atEnd) {
          flash(tr('reader.end'), 'info');
          return;
        }
        advance = visiblePage.advance;
      }
      if (advance == null || !Number.isFinite(advance)) {
        var base = core.readPage(state.active.text, state.cursor, state.settings.pageSize, state.settings.trimNextLine);
        if (base.atEnd) {
          flash(tr('reader.end'), 'info');
          return;
        }
        advance = base.rawEnd;
      }
      if (advance <= state.cursor) {
        flash(tr('reader.end'), 'info');
        return;
      }
      turn(advance);
    }

    /** Record the composer draft without publishing a render. */
    function noteComposer(draft, attachments) {
      composerState = {
        draft: String(draft == null ? '' : draft),
        attachments: Math.max(0, Math.trunc(attachments) || 0),
      };
    }

    /** Entering the editor latches input mode; blur does not resume reading. */
    function noteInputFocus(focused) {
      if (!focused) return;
      if (state.inputMode && !state.searchOpen) return;
      set({ inputMode: true, searchOpen: false });
    }

    /** Show the reader from a focused composer; refuses to cover real input. */
    function showReader() {
      if (!state.active) return false;
      if (composerState.draft !== '' || composerState.attachments > 0) return false;
      set({ hidden: false, inputMode: false, notice: null });
      scheduleHide();
      return true;
    }

    function previous() {
      if (!state.active || state.inputMode) return;
      var history = state.history.slice();
      var target;
      if (history.length) {
        target = history.pop();
      } else {
        target = core.previousPageStart(state.active.text, state.cursor, state.settings.pageSize);
      }
      var start = core.readPage(state.active.text, target, state.settings.pageSize, state.settings.trimNextLine).start;
      if (start >= state.cursor && state.cursor > 0) {
        target = Math.max(0, state.cursor - 1);
        start = core.readPage(state.active.text, target, state.settings.pageSize, state.settings.trimNextLine).start;
      }
      if (start === state.cursor) {
        flash(tr('reader.start'), 'info');
        return;
      }
      set({
        cursor: start,
        history: history,
        hidden: false,
          highlight: null,
        notice: null,
      });
      var previousPage = core.readPage(state.active.text, start, state.settings.pageSize, state.settings.trimNextLine);
      saveProgress(core.percent(start, state.active.text.length, previousPage.atEnd));
      scheduleHide();
    }

    function jumpToPercent(percentValue) {
      if (!state.active) return { ok: false };
      var target = core.jumpPercent(state.active.text, percentValue, state.settings.pageSize, state.settings.trimNextLine);
      var start = core.readPage(state.active.text, target, state.settings.pageSize, state.settings.trimNextLine).start;
      var history = state.history.slice();
      if (percentValue <= 0) history = [];
      else if (start !== state.cursor) {
        if (history[history.length - 1] !== state.cursor) history.push(state.cursor);
        if (history.length > 200) history = history.slice(-200);
      }
      set({
        cursor: start,
        history: history,
        hidden: false,
          searchOpen: false,
        highlight: null,
        notice: null,
      });
      saveProgress(core.percent(start, state.active.text.length, percentValue >= 100));
      flash(tr('reader.percentJump', { percent: Math.round(percentValue * 10) / 10 }), 'success');
      scheduleHide();
      return { ok: true };
    }

    function search(query, direction, regexMode) {
      if (!state.active) return { ok: false, messageKey: 'reader.notFound' };
      var text = String(query == null ? '' : query).trim();
      if (!text) return { ok: false, messageKey: 'reader.searchEmpty' };
      var useRegex = regexMode === true;
      if (!useRegex) {
        var parsed = core.parsePercent(text);
        if (parsed) {
          if (parsed.invalid) return { ok: false, messageKey: 'reader.invalidPercent' };
          return jumpToPercent(parsed.value);
        }
      }
      var previousDirection = direction === 'prev';
      var sameHit = state.highlight
        && state.highlight.query === text
        && state.highlight.regex === useRegex;
      if (previousDirection && state.cursor <= 0) {
        return { ok: false, messageKey: 'reader.noPrevious' };
      }
      var cacheKey = state.active.id + '\u0000' + (useRegex ? 'r' : 't') + '\u0000' + text;
      if (!searchMatchCache || searchMatchCache.key !== cacheKey) {
        var collected = core.collectSearchMatches(state.active.text, text, useRegex, 20000);
        if (collected.error) {
          return { ok: false, messageKey: 'reader.invalidRegex', message: collected.error };
        }
        searchMatchCache = {
          key: cacheKey,
          matches: collected.matches,
          truncated: collected.truncated,
        };
      }
      var matches = searchMatchCache.matches;
      var from = previousDirection
        ? Math.max(0, state.cursor - 1)
        : state.cursor + (sameHit ? Math.max(1, state.highlight.length) : 0);
      var targetIndex = -1;
      if (previousDirection) {
        for (var i = matches.length - 1; i >= 0; i--) {
          if (matches[i].index <= from) {
            targetIndex = i;
            break;
          }
        }
      } else {
        for (var j = 0; j < matches.length; j++) {
          if (matches[j].index >= from) {
            targetIndex = j;
            break;
          }
        }
      }
      if (targetIndex < 0) {
        return {
          ok: false,
          messageKey: previousDirection ? 'reader.noPrevious' : 'reader.noNext',
          total: matches.length,
          truncated: searchMatchCache.truncated,
        };
      }
      var target = matches[targetIndex];
      var history = state.history.slice();
      if (target.index !== state.cursor) {
        if (history[history.length - 1] !== state.cursor) history.push(state.cursor);
        if (history.length > 200) history = history.slice(-200);
      }
      set({
        cursor: target.index,
        history: history,
        hidden: false,
        searchOpen: true,
        highlight: {
          start: target.index,
          length: target.length,
          query: text,
          regex: useRegex,
        },
        notice: null,
      });
      saveProgress(core.percent(target.index, state.active.text.length, false));
      scheduleHide();
      return {
        ok: true,
        ordinal: targetIndex + 1,
        total: matches.length,
        truncated: searchMatchCache.truncated,
      };
    }

    function toggleBoss() {
      if (!state.active) return;
      if (state.inputMode || state.hidden) {
        showReader();
        return;
      }
      clearHide();
      set({ hidden: true, notice: null });
    }

    function openSearch() {
      if (!state.active) return;
      clearHide();
      set({ searchOpen: true, hidden: false, notice: null, highlight: null });
    }

    function closeSearch() {
      set({ searchOpen: false });
      scheduleHide();
    }

    function openLibrary(tab) {
      clearHide();
      set({
        libraryOpen: true,
        libraryTab: tab || state.libraryTab || 'books',
        error: null,
        shortcutCapture: null,
        shortcutError: null,
      });
    }

    function setLibraryTab(tab) {
      set({ libraryTab: tab || 'books', shortcutCapture: null, shortcutError: null });
    }

    function closeLibrary() {
      set({ libraryOpen: false, shortcutCapture: null, shortcutError: null });
      scheduleHide();
    }

    function toggleLibrary() {
      if (state.libraryOpen) closeLibrary();
      else openLibrary('books');
    }

    function updateSettings(patch) {
      var settings = core.sanitizeSettings(Object.assign({}, state.settings, patch || {}));
      set({ settings: settings });
      writeJson(LS_SETTINGS, settings);
      scheduleHide();
    }

    function startShortcutCapture(action) {
      set({ shortcutCapture: action, shortcutError: null });
    }

    function cancelShortcutCapture() {
      set({ shortcutCapture: null, shortcutError: null });
    }

    function setShortcutError(text) {
      set({ shortcutError: text || null });
    }

    function assignShortcut(action, combo) {
      if (state.shortcutCapture !== action) return { ok: true };
      var normalized = core.normalizeShortcut(combo, null);
      if (!normalized) {
        set({ shortcutError: tr('settings.shortcutErrorModifier') });
        return { ok: false };
      }
      var shortcuts = Object.assign({}, state.settings.shortcuts);
      var duplicate = Object.keys(shortcuts).find(function (key) {
        return key !== action && shortcuts[key] === normalized;
      });
      if (duplicate) {
        set({ shortcutError: tr('settings.shortcutErrorDuplicate') });
        return { ok: false };
      }
      shortcuts[action] = normalized;
      updateSettings({ shortcuts: shortcuts });
      set({ shortcutCapture: null, shortcutError: null });
      flash(tr('settings.shortcutSaved', { shortcut: core.shortcutLabel(normalized) }), 'success');
      return { ok: true };
    }

    function resetShortcuts() {
      updateSettings({ shortcuts: Object.assign({}, DEFAULT_SETTINGS.shortcuts) });
      set({ shortcutCapture: null, shortcutError: null });
      flash(tr('settings.shortcutResetDone'), 'success');
    }

    async function importFiles(files) {
      var list = Array.from(files || []);
      if (!list.length) return { ok: true, imported: 0 };
      var imported = [];
      var failures = [];
      for (var i = 0; i < list.length; i++) {
        var file = list[i];
        set({
          importing: {
            name: file.name,
            index: i + 1,
            total: list.length,
            phase: 'reading',
            percent: 0,
          },
        });
        try {
          var decoded = await readImportFile(file, function (fraction) {
            set({
              importing: {
                name: file.name,
                index: i + 1,
                total: list.length,
                phase: 'reading',
                percent: Math.round(fraction * 100),
              },
            });
          });
          var id = newId();
          var meta = {
            id: id,
            alias: core.uniqueAlias(core.stripExtension(file.name), state.books),
            sourceName: file.name,
            encoding: decoded.encoding,
            format: decoded.format || 'txt',
            chapterCount: decoded.chapterCount || 0,
            uncertain: decoded.uncertain,
            charCount: decoded.text.length,
            bytes: file.size,
            importedAt: new Date().toISOString(),
          };
          var record = Object.assign({}, meta, { text: decoded.text });
          await idbPut(record);
          var books = state.books.concat([meta]);
          if (!saveLibrary(books)) {
            try { await idbDelete(id); } catch (cleanupError) { /* best effort */ }
            throw new Error(tr('library.storageError'));
          }
          set({ books: books, importing: Object.assign({}, state.importing, { phase: 'saving', percent: 100 }) });
          imported.push(meta);
          if (!state.active) await openBook(id);
        } catch (error) {
          failures.push({
            name: file.name,
            message: error && error.message ? error.message : String(error),
          });
        }
      }
      set({ importing: null });
      if (!imported.length && failures.length) {
        flash(tr('library.importAllFailed', {
          count: failures.length,
          message: failures[0].message,
        }), 'error');
      } else if (imported.length) {
        flash(
          failures.length > 0
            ? tr('library.importDoneSome', { count: imported.length, failed: failures.length })
            : tr('library.importDone', { count: imported.length }),
          failures.length > 0 ? 'warn' : 'success',
        );
      }
      return { ok: failures.length === 0, imported: imported.length, failed: failures.length };
    }

    function dispose() {
      disposed = true;
      clearHide();
      clearNoticeTimer();
      listeners.clear();
      if (databasePromise) databasePromise.then(function (db) { try { db.close(); } catch (error) { /* ignore */ } });
    }

    return {
      subscribe: subscribe,
      getSnapshot: get,
      init: init,
      dispose: dispose,
      openBook: openBook,
      closeBook: closeBook,
      deleteBook: deleteBook,
      deleteBooks: deleteBooks,
      renameBook: renameBook,
      turn: turn,
      nextVisible: nextVisible,
      showReader: showReader,
      noteComposer: noteComposer,
      noteInputFocus: noteInputFocus,
      setVisiblePage: setVisiblePage,
      previous: previous,
      jumpToPercent: jumpToPercent,
      search: search,
      toggleBoss: toggleBoss,
      openSearch: openSearch,
      closeSearch: closeSearch,
      openLibrary: openLibrary,
      setLibraryTab: setLibraryTab,
      closeLibrary: closeLibrary,
      toggleLibrary: toggleLibrary,
      updateSettings: updateSettings,
      startShortcutCapture: startShortcutCapture,
      cancelShortcutCapture: cancelShortcutCapture,
      setShortcutError: setShortcutError,
      assignShortcut: assignShortcut,
      resetShortcuts: resetShortcuts,
      importFiles: importFiles,
      flash: flash,
    };
  }

  // ---------------------------------------------------------------------------
  // Text measurement.  Canvas measurement is used to make the visible segment
  // exactly fit the available line, so page advancement never passes clipped
  // characters.
  // ---------------------------------------------------------------------------

  var measureCanvas = null;

  function measurePrefix(text, width, font) {
    if (!text) return 0;
    if (!(width > 0) || !font) return text.length;
    try {
      if (!measureCanvas) measureCanvas = document.createElement('canvas');
      var context = measureCanvas.getContext('2d');
      if (!context) return text.length;
      context.font = font;
      var low = 0;
      var high = text.length;
      while (low < high) {
        var mid = Math.floor((low + high + 1) / 2);
        if (context.measureText(text.slice(0, mid)).width <= width) low = mid;
        else high = mid - 1;
      }
      if (low > 0 && low < text.length) {
        var code = text.charCodeAt(low - 1);
        if (code >= 0xd800 && code <= 0xdbff) low--;
      }
      return Math.max(1, low);
    } catch (error) {
      return text.length;
    }
  }

  // ---------------------------------------------------------------------------
  // Styles.  Each root renders its own <style> element so unmounting removes
  // every rule, including the composer-dock row layout.
  // ---------------------------------------------------------------------------

  var TOOLBAR_CSS = `
    .sr-toolbar {
      display: flex;
      align-items: center;
      gap: 2px;
      height: 26px;
      min-width: 0;
    }
    .sr-toolbar-btn {
      display: inline-flex;
      flex: none;
      align-items: center;
      justify-content: center;
      width: 24px;
      height: 24px;
      padding: 0;
      border: 0;
      border-radius: 6px;
      background: transparent;
      color: var(--dsw-alias-label-secondary);
      cursor: pointer;
    }
    .sr-toolbar-btn:hover { background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-primary); }
    .sr-toolbar-btn:focus-visible { outline: 1px solid var(--dsw-alias-brand-primary); outline-offset: 1px; }
    .sr-toolbar-btn:disabled {
      opacity: 1;
      cursor: default;
      background: transparent;
      color: var(--dsw-alias-label-secondary);
    }
    .sr-toolbar-btn:disabled:hover { background: transparent; color: var(--dsw-alias-label-secondary); }
    .sr-toolbar-btn svg { display: block; }
  `;

  var INPUT_READER_CSS = `
    [data-composer-card]:has(.sr-input-line) [data-composer-placeholder],
    [data-composer-card]:has(.sr-input-search) [data-composer-placeholder] {
      visibility: hidden;
    }
    .sr-input-line {
      position: absolute;
      left: 14px;
      right: 8px;
      top: 6px;
      z-index: 2;
      box-sizing: border-box;
      display: flex;
      align-items: center;
      gap: 8px;
      height: 36px;
      min-width: 0;
      color: var(--dsw-alias-label-secondary);
      font-size: var(--dsh-content-font-size, 14px);
      line-height: calc(24px + var(--dsh-content-font-delta, 0px));
      font-variant-numeric: tabular-nums;
      pointer-events: none;
    }
    .sr-input-body {
      flex: 1 1 auto;
      min-width: 0;
      overflow: hidden;
      white-space: pre;
      text-overflow: clip;
      /* Between the composer's primary draft text and its caption placeholder. */
      color: var(--dsw-alias-label-secondary);
    }
    .sr-input-body mark {
      padding: 0 1px;
      border-radius: 2px;
      background: var(--dsw-alias-brand-primary);
      color: var(--dsw-alias-bg-base);
    }
    .sr-input-empty { color: var(--dsw-alias-label-secondary); }
    .sr-input-meta {
      flex: none;
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 2px;
      width: 74px;
      pointer-events: auto;
    }
    .sr-input-percent {
      flex: none;
      width: 52px;
      overflow: hidden;
      text-align: right;
      text-overflow: ellipsis;
      white-space: nowrap;
      color: var(--dsw-alias-label-secondary);
      font-size: 11px;
      line-height: 20px;
      letter-spacing: 0;
    }
    .sr-input-icon-btn {
      display: inline-flex;
      flex: none;
      align-items: center;
      justify-content: center;
      width: 20px;
      height: 20px;
      padding: 0;
      border: 0;
      border-radius: 6px;
      background: transparent;
      color: var(--dsw-alias-label-secondary);
      cursor: pointer;
      pointer-events: auto;
    }
    .sr-input-icon-btn:hover { background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-primary); }
    .sr-input-icon-btn:focus-visible { outline: 1px solid var(--dsw-alias-brand-primary); outline-offset: 1px; }
    .sr-input-icon-btn:disabled { opacity: .35; cursor: default; background: transparent; }
    .sr-input-icon-btn svg { display: block; }
    .sr-input-toast {
      position: absolute;
      right: 0;
      bottom: 0;
      z-index: 4;
      max-width: min(360px, 72vw);
      overflow: hidden;
      padding: 5px 9px;
      border: 1px solid var(--dsw-alias-border-l1);
      border-radius: 7px;
      background: var(--dsw-alias-bg-overlay);
      box-shadow: 0 6px 20px rgba(0, 0, 0, .22);
      color: var(--dsw-alias-label-secondary);
      font-size: 11px;
      line-height: 16px;
      text-overflow: ellipsis;
      white-space: nowrap;
      transform: translateY(calc(-100% - 8px));
      pointer-events: none;
    }
    .sr-input-toast[data-tone='success'] { color: var(--dsw-alias-state-success-primary); }
    .sr-input-toast[data-tone='warn'] { color: var(--dsw-alias-state-warn-primary); }
    .sr-input-toast[data-tone='error'] { color: var(--dsw-alias-state-error-primary); }
    .sr-input-search {
      position: absolute;
      left: 14px;
      right: auto;
      bottom: 0;
      z-index: 6;
      box-sizing: border-box;
      display: flex;
      align-items: center;
      width: min(520px, calc(100% - 22px));
      padding: 6px;
      border: 1px solid var(--dsw-alias-border-l1);
      border-radius: 9px;
      background: var(--dsw-alias-bg-overlay);
      box-shadow: 0 10px 32px rgba(0, 0, 0, .26);
      transform: translateY(calc(-100% - 10px));
      pointer-events: auto;
    }
    .sr-input-search-row {
      display: flex;
      align-items: center;
      gap: 4px;
      width: 100%;
    }
    .sr-input-search-input {
      box-sizing: border-box;
      flex: 1 1 auto;
      min-width: 0;
      height: 26px;
      padding: 0 7px;
      border: 1px solid var(--dsw-alias-border-l1);
      border-radius: 5px;
      background: var(--dsw-alias-bg-layer-1);
      color: var(--dsw-alias-label-primary);
      font: inherit;
      font-size: 13px;
      outline: none;
    }
    .sr-input-search-input:focus { border-color: var(--dsw-alias-brand-primary); }
    .sr-input-search-input::placeholder { color: var(--dsw-alias-label-secondary); }
    .sr-input-search-btn {
      flex: none;
      height: 26px;
      padding: 0 7px;
      border: 1px solid var(--dsw-alias-border-l1);
      border-radius: 5px;
      background: transparent;
      color: var(--dsw-alias-label-secondary);
      font: inherit;
      font-size: 11px;
      cursor: pointer;
    }
    .sr-input-search-btn:hover { background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-primary); }
    .sr-input-search-btn:disabled { opacity: .4; cursor: default; }
    .sr-input-search-icon-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 26px;
      padding: 0;
    }
    .sr-input-search-icon-btn svg { display: block; }
    .sr-input-search-btn[data-primary] {
      border-color: var(--dsw-alias-brand-primary);
      color: var(--dsw-alias-brand-primary);
    }
    .sr-input-search-btn[data-active] {
      border-color: var(--dsw-alias-brand-primary);
      background: var(--dsw-alias-bg-layer-2);
      color: var(--dsw-alias-brand-primary);
    }
    .sr-input-search-status {
      flex: 0 1 84px;
      min-width: 0;
      overflow: hidden;
      color: var(--dsw-alias-state-error-primary);
      font-size: 11px;
      line-height: 16px;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  `;

  var LIBRARY_CSS = `
    .sr-overlay {
      position: fixed;
      inset: 0;
      z-index: 80;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
      box-sizing: border-box;
      background: rgba(0, 0, 0, .32);
      pointer-events: auto;
    }
    .sr-modal {
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      width: min(760px, calc(100vw - 32px));
      max-height: min(82vh, 760px);
      overflow: hidden;
      border: 1px solid var(--dsw-alias-border-l1);
      border-radius: 14px;
      background: var(--dsw-alias-bg-overlay);
      color: var(--dsw-alias-label-primary);
      box-shadow: 0 18px 60px rgba(0, 0, 0, .35);
      outline: none;
    }
    .sr-modal-header {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 14px 16px 12px;
      border-bottom: 1px solid var(--dsw-alias-border-l1);
    }
    .sr-modal-title {
      margin: 0;
      font-size: 15px;
      font-weight: 600;
      line-height: 22px;
    }
    .sr-modal-sub {
      flex: 1 1 auto;
      min-width: 0;
      color: var(--dsw-alias-label-secondary);
      font-size: 11px;
      line-height: 16px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .sr-close-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      padding: 0;
      border: 0;
      border-radius: 7px;
      background: transparent;
      color: var(--dsw-alias-label-secondary);
      cursor: pointer;
    }
    .sr-close-btn:hover { background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-primary); }
    .sr-tabs {
      display: flex;
      gap: 4px;
      padding: 10px 16px 0;
    }
    .sr-tab {
      height: 28px;
      padding: 0 10px;
      border: 0;
      border-radius: 7px;
      background: transparent;
      color: var(--dsw-alias-label-secondary);
      font: inherit;
      font-size: 12px;
      cursor: pointer;
    }
    .sr-tab:hover { background: var(--dsw-alias-bg-layer-2); }
    .sr-tab[data-active] { background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-primary); font-weight: 600; }
    .sr-modal-body {
      flex: 1 1 auto;
      min-height: 0;
      overflow: auto;
      padding: 12px 16px 16px;
    }
    .sr-library-toolbar {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
      margin-bottom: 10px;
    }
    .sr-batch-bar {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
      margin: 0 0 10px;
      padding: 8px 10px;
      border: 1px solid var(--dsw-alias-border-l1);
      border-radius: 8px;
      background: var(--dsw-alias-bg-layer-2);
    }
    .sr-batch-confirm {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
      margin: 0 0 10px;
      padding: 8px 10px;
      border: 1px solid var(--dsw-alias-state-error-primary);
      border-radius: 8px;
      background: var(--dsw-alias-bg-layer-2);
    }
    .sr-book[data-selecting] {
      grid-template-columns: auto minmax(0, 1fr);
    }
    .sr-book-check {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 24px;
    }
    .sr-book-check input {
      width: 15px;
      height: 15px;
      margin: 0;
      accent-color: var(--dsw-alias-brand-primary);
      cursor: pointer;
    }
    .sr-primary-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      height: 30px;
      padding: 0 12px;
      border: 1px solid var(--dsw-alias-brand-primary);
      border-radius: 7px;
      background: var(--dsw-alias-brand-primary);
      color: var(--dsw-alias-bg-base);
      font: inherit;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
    }
    .sr-primary-btn:hover { filter: brightness(1.06); }
    .sr-primary-btn:disabled { opacity: .5; cursor: default; }
    .sr-ghost-btn {
      height: 26px;
      padding: 0 9px;
      border: 1px solid var(--dsw-alias-border-l1);
      border-radius: 6px;
      background: transparent;
      color: var(--dsw-alias-label-secondary);
      font: inherit;
      font-size: 11px;
      cursor: pointer;
    }
    .sr-ghost-btn:hover { background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-primary); }
    .sr-ghost-btn:disabled { opacity: .4; cursor: default; }
    .sr-ghost-btn[data-danger] { color: var(--dsw-alias-state-error-primary); border-color: var(--dsw-alias-state-error-primary); }
    .sr-import-status {
      display: flex;
      flex-direction: column;
      gap: 4px;
      margin: 8px 0 10px;
      padding: 8px 10px;
      border: 1px solid var(--dsw-alias-border-l1);
      border-radius: 8px;
      background: var(--dsw-alias-bg-layer-1);
      color: var(--dsw-alias-label-secondary);
      font-size: 11px;
    }
    .sr-progress {
      width: 100%;
      height: 4px;
      overflow: hidden;
      border-radius: 999px;
      background: var(--dsw-alias-bg-layer-2);
    }
    .sr-progress > span {
      display: block;
      height: 100%;
      border-radius: 999px;
      background: var(--dsw-alias-brand-primary);
      transition: width .18s ease-out;
    }
    .sr-book-list {
      display: flex;
      flex-direction: column;
      gap: 6px;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .sr-book {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 10px;
      align-items: center;
      padding: 9px 10px;
      border: 1px solid var(--dsw-alias-border-l1);
      border-radius: 9px;
      background: var(--dsw-alias-bg-layer-1);
    }
    .sr-book[data-active] { border-color: var(--dsw-alias-brand-primary); }
    .sr-book-main { min-width: 0; }
    .sr-book-title {
      display: flex;
      align-items: center;
      gap: 7px;
      min-width: 0;
      font-size: 13px;
      font-weight: 600;
      line-height: 19px;
    }
    .sr-book-title > span:first-child {
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .sr-chip {
      flex: none;
      padding: 0 6px;
      border-radius: 999px;
      background: var(--dsw-alias-bg-layer-2);
      color: var(--dsw-alias-label-secondary);
      font-size: 10px;
      font-weight: 500;
      line-height: 16px;
    }
    .sr-chip[data-tone='brand'] { background: var(--dsw-alias-brand-primary); color: var(--dsw-alias-bg-base); }
    .sr-book-meta {
      margin-top: 2px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      color: var(--dsw-alias-label-secondary);
      font-size: 11px;
      line-height: 16px;
    }
    .sr-book-progress { display: flex; align-items: center; gap: 7px; margin-top: 5px; }
    .sr-book-progress .sr-progress { flex: 1 1 auto; }
    .sr-book-progress > span {
      flex: none;
      min-width: 36px;
      text-align: right;
      color: var(--dsw-alias-label-secondary);
      font-size: 10px;
      font-variant-numeric: tabular-nums;
    }
    .sr-book-actions { display: flex; align-items: center; gap: 4px; }
    .sr-book-edit { display: flex; align-items: center; gap: 4px; margin-top: 6px; }
    .sr-text-input {
      box-sizing: border-box;
      flex: 1 1 auto;
      min-width: 0;
      height: 26px;
      padding: 0 7px;
      border: 1px solid var(--dsw-alias-border-l1);
      border-radius: 6px;
      background: var(--dsw-alias-bg-overlay);
      color: var(--dsw-alias-label-primary);
      font: inherit;
      font-size: 12px;
      outline: none;
    }
    .sr-text-input:focus { border-color: var(--dsw-alias-brand-primary); }
    .sr-empty-state {
      padding: 28px 12px;
      border: 1px dashed var(--dsw-alias-border-l2);
      border-radius: 10px;
      text-align: center;
      color: var(--dsw-alias-label-secondary);
      font-size: 12px;
      line-height: 20px;
    }
    .sr-empty-state strong { display: block; margin-bottom: 3px; color: var(--dsw-alias-label-primary); font-size: 13px; }
    .sr-note-line {
      margin: 12px 0 0;
      color: var(--dsw-alias-label-secondary);
      font-size: 11px;
      line-height: 17px;
    }
    .sr-alert {
      margin: 0 0 10px;
      padding: 7px 9px;
      border: 1px solid var(--dsw-alias-state-error-primary);
      border-radius: 7px;
      color: var(--dsw-alias-state-error-primary);
      font-size: 11px;
      line-height: 16px;
    }
    .sr-notice {
      display: flex;
      align-items: center;
      gap: 8px;
      margin: 10px 0 0;
      padding: 7px 9px;
      border-radius: 7px;
      background: var(--dsw-alias-bg-layer-1);
      color: var(--dsw-alias-label-secondary);
      font-size: 11px;
      line-height: 16px;
    }
    .sr-notice[data-tone='success'] { color: var(--dsw-alias-state-success-primary); }
    .sr-notice[data-tone='warn'] { color: var(--dsw-alias-state-warn-primary); }
    .sr-notice[data-tone='error'] { color: var(--dsw-alias-state-error-primary); }
    .sr-settings { display: flex; flex-direction: column; gap: 14px; }
    .sr-field { display: flex; flex-direction: column; gap: 4px; }
    .sr-shortcut-list {
      display: flex;
      flex-direction: column;
      gap: 2px;
      margin-top: 2px;
      border-top: 1px solid var(--dsw-alias-border-l1);
    }
    .sr-shortcut-row {
      display: flex;
      align-items: center;
      gap: 8px;
      min-height: 30px;
      border-bottom: 1px solid var(--dsw-alias-border-l1);
    }
    .sr-shortcut-row:last-child { border-bottom: 0; }
    .sr-shortcut-label {
      flex: 1 1 auto;
      min-width: 0;
      color: var(--dsw-alias-label-primary);
      font-size: 12px;
    }
    .sr-shortcut-value {
      flex: none;
      min-width: 92px;
      padding: 2px 8px;
      border: 1px solid var(--dsw-alias-border-l1);
      border-radius: 5px;
      background: var(--dsw-alias-bg-layer-1);
      color: var(--dsw-alias-label-secondary);
      text-align: center;
      font-size: 11px;
      line-height: 18px;
      font-variant-numeric: tabular-nums;
    }
    .sr-shortcut-value[data-capturing] {
      border-color: var(--dsw-alias-brand-primary);
      color: var(--dsw-alias-brand-primary);
    }
    .sr-shortcut-error {
      color: var(--dsw-alias-state-error-primary);
      font-size: 11px;
      line-height: 16px;
    }
    .sr-field-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
    .sr-field-label { font-size: 12px; font-weight: 600; line-height: 18px; }
    .sr-field-hint { color: var(--dsw-alias-label-secondary); font-size: 11px; line-height: 16px; }
    .sr-field-row { display: flex; align-items: center; gap: 8px; }
    .sr-number {
      box-sizing: border-box;
      width: 96px;
      height: 26px;
      padding: 0 7px;
      border: 1px solid var(--dsw-alias-border-l1);
      border-radius: 6px;
      background: var(--dsw-alias-bg-layer-1);
      color: var(--dsw-alias-label-primary);
      font: inherit;
      font-size: 12px;
      outline: none;
    }
    .sr-number:focus { border-color: var(--dsw-alias-brand-primary); }
    .sr-check { display: inline-flex; align-items: center; gap: 7px; font-size: 12px; cursor: pointer; }
    .sr-check input { width: 14px; height: 14px; accent-color: var(--dsw-alias-brand-primary); }
    .sr-settings-page { padding: 4px 0 20px; }
    .sr-settings-page h2 { margin: 0 0 4px; font-size: 15px; font-weight: 600; }
    .sr-settings-page > p { margin: 0 0 14px; color: var(--dsw-alias-label-secondary); font-size: 12px; line-height: 18px; }
  `;

  var BUTTON_CSS = `
    .sr-side-btn {
      position: relative;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex: none;
      width: 42px;
      height: 42px;
      margin: 4px 2px;
      padding: 0;
      border: 0;
      border-radius: 12px;
      background: transparent;
      color: var(--dsw-alias-label-secondary);
      cursor: pointer;
    }
    .sr-side-btn.sr-side-rail {
      width: 36px;
      height: 36px;
      border-radius: 12px;
    }
    .sr-side-btn:hover { background: var(--dsw-alias-interactive-bg-hover); color: var(--dsw-alias-label-primary); }
    .sr-side-btn:focus-visible { outline: 1px solid var(--dsw-alias-brand-primary); outline-offset: 1px; }
    .sr-side-btn[data-active] { color: var(--dsw-alias-brand-primary); }
    .sr-side-btn svg { display: block; width: 18px; height: 18px; }
    .sr-side-btn.sr-side-wide svg { width: 16px; height: 16px; }
  `;

  // ---------------------------------------------------------------------------
  // React components (created inside the module factory so `React`/`h` are
  // captured without importing any host Client package).
  // ---------------------------------------------------------------------------

  function createComponents(React, h) {
    var Fragment = React.Fragment;

    function useStore(store) {
      return React.useSyncExternalStore(store.subscribe, store.getSnapshot);
    }

    function useT(locale) {
      var subscribe = React.useCallback(function (listener) { return locale.subscribe(listener); }, [locale]);
      var getSnapshot = React.useCallback(function () { return locale.getSnapshot(); }, [locale]);
      React.useSyncExternalStore(subscribe, getSnapshot);
      return locale.bind(NS);
    }

    function ChevronLeft() {
      return h('svg', { viewBox: '0 0 16 16', width: 12, height: 12, 'aria-hidden': true },
        h('path', { d: 'M10 3.5 5.5 8 10 12.5', fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round' }));
    }

    function ChevronRight() {
      return h('svg', { viewBox: '0 0 16 16', width: 12, height: 12, 'aria-hidden': true },
        h('path', { d: 'M6 3.5 10.5 8 6 12.5', fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round' }));
    }

    function EyeIcon(props) {
      return h('svg', { viewBox: '0 0 16 16', width: 13, height: 13, 'aria-hidden': true },
        h('path', {
          d: 'M1.5 8s2.2-4 6.5-4 6.5 4 6.5 4-2.2 4-6.5 4S1.5 8 1.5 8z',
          fill: 'none', stroke: 'currentColor', strokeWidth: 1.3, strokeLinejoin: 'round',
        }),
        h('circle', { cx: 8, cy: 8, r: 1.8, fill: 'none', stroke: 'currentColor', strokeWidth: 1.3 }),
        props && props.off
          ? h('path', { d: 'M3 13 13 3', stroke: 'currentColor', strokeWidth: 1.4, strokeLinecap: 'round' })
          : null);
    }

    function BookIcon(props) {
      var filled = !!(props && props.filled);
      return h('svg', { viewBox: '0 0 20 20', width: 18, height: 18, 'aria-hidden': true },
        h('path', {
          d: 'M3 4.3c2.8-1.3 5.1-.9 7 .6v11c-1.9-1.5-4.2-1.9-7-.6v-11z',
          fill: filled ? 'currentColor' : 'none',
          fillOpacity: filled ? 0.35 : undefined,
          stroke: 'currentColor', strokeWidth: 1.3, strokeLinejoin: 'round',
        }),
        h('path', {
          d: 'M17 4.3c-2.8-1.3-5.1-.9-7 .6v11c1.9-1.5 4.2-1.9 7-.6v-11z',
          fill: filled ? 'currentColor' : 'none',
          fillOpacity: filled ? 0.35 : undefined,
          stroke: 'currentColor', strokeWidth: 1.3, strokeLinejoin: 'round',
        }),
        h('path', { d: 'M10 4.9v11', fill: 'none', stroke: 'currentColor', strokeWidth: 1.3 }));
    }

    function SearchIcon() {
      return h('svg', { viewBox: '0 0 16 16', width: 13, height: 13, 'aria-hidden': true },
        h('circle', { cx: 7, cy: 7, r: 4.2, fill: 'none', stroke: 'currentColor', strokeWidth: 1.3 }),
        h('path', { d: 'M10.2 10.2 14 14', fill: 'none', stroke: 'currentColor', strokeWidth: 1.3, strokeLinecap: 'round' }));
    }

    function CloseIcon() {
      return h('svg', { viewBox: '0 0 16 16', width: 14, height: 14, 'aria-hidden': true },
        h('path', { d: 'M4 4l8 8M12 4l-8 8', fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round' }));
    }

    function highlightNodes(display, highlight, pageStart) {
      if (!highlight) return display;
      var relative = highlight.start - pageStart;
      if (relative < 0 || relative >= display.length) return display;
      var length = Math.min(highlight.length, display.length - relative);
      return [
        display.slice(0, relative),
        h('mark', { key: 'sr-match' }, display.slice(relative, relative + length)),
        display.slice(relative + length),
      ];
    }

    function InputReader(props) {
      var store = props.store;
      var locale = props.locale;
      var state = useStore(store);
      var t = useT(locale);
      var draft = props.useInput(function (snapshot) { return snapshot.draft; });
      var attachmentCount = props.useInput(function (snapshot) { return snapshot.attachmentIds.length; });
      var editingState = React.useState(false);
      var editing = editingState[0];
      var setEditing = editingState[1];
      var layoutState = React.useState({ width: 0, font: '' });
      var layout = layoutState[0];
      var setLayout = layoutState[1];
      var anchorRef = React.useRef(null);
      var bodyRef = React.useRef(null);
      var inputRef = React.useRef(null);
      var queryState = React.useState('');
      var query = queryState[0];
      var setQuery = queryState[1];
      var regexState = React.useState(false);
      var regexMode = regexState[0];
      var setRegexMode = regexState[1];
      var searchMessageState = React.useState(null);
      var searchMessage = searchMessageState[0];
      var setSearchMessage = searchMessageState[1];
      var matchInfoState = React.useState(null);
      var matchInfo = matchInfoState[0];
      var setMatchInfo = matchInfoState[1];

      var active = state.active;
      var page = null;
      if (active) {
        var base = core.readPage(active.text, state.cursor, state.settings.pageSize, state.settings.trimNextLine);
        var available = Math.max(0, layout.width - 2);
        var fit = measurePrefix(base.text, available, layout.font);
        page = core.fitPage(base, active.text.length, fit, state.settings.trimNextLine);
      }
      var visible = !!state.ready && !!active && !state.inputMode && !editing && !draft && attachmentCount === 0 && !state.hidden;

      React.useEffect(function () {
        store.noteComposer(draft, attachmentCount);
      }, [draft, attachmentCount, store]);

      // The overlay shares the card with the Lexical editor.  Watch the real
      // editor's focus so clicking the placeholder area enters typing and
      // immediately restores the original composer placeholder.
      React.useEffect(function () {
        if (!state.ready || !active) return undefined;
        var card = anchorRef.current && anchorRef.current.closest('[data-composer-card]');
        if (!card) return undefined;
        var editor = card.querySelector('[contenteditable="true"]');
        if (!editor) return undefined;
        var onFocus = function () {
          setEditing(true);
          store.noteInputFocus(true);
          if (store.getSnapshot().searchOpen) store.closeSearch();
        };
        var onBlur = function () { setEditing(false); };
        editor.addEventListener('focus', onFocus);
        editor.addEventListener('blur', onBlur);
        if (document.activeElement === editor) {
          setEditing(true);
          store.noteInputFocus(true);
        }
        return function () {
          editor.removeEventListener('focus', onFocus);
          editor.removeEventListener('blur', onBlur);
        };
      }, [state.ready, active ? active.id : null, store]);

      React.useEffect(function () {
        if (!visible && store.getSnapshot().searchOpen) store.closeSearch();
      }, [visible, store]);

      React.useEffect(function () {
        if (!state.searchOpen) return undefined;
        setQuery('');
        setSearchMessage(null);
        setMatchInfo(null);
        var timer = window.setTimeout(function () {
          if (inputRef.current) inputRef.current.focus();
        }, 0);
        return function () { window.clearTimeout(timer); };
      }, [state.searchOpen]);

      React.useLayoutEffect(function () {
        if (!visible || !active) return undefined;
        var element = bodyRef.current;
        if (!element) return undefined;
        var update = function () {
          var computed = window.getComputedStyle(element);
          var width = element.clientWidth;
          var font = computed.fontStyle + ' ' + computed.fontWeight + ' ' + computed.fontSize + ' ' + computed.fontFamily;
          setLayout(function (previous) {
            if (previous.width === width && previous.font === font) return previous;
            return { width: width, font: font };
          });
        };
        update();
        var observer = null;
        if (typeof ResizeObserver === 'function') {
          observer = new ResizeObserver(update);
          observer.observe(element);
        }
        window.addEventListener('resize', update);
        return function () {
          if (observer) observer.disconnect();
          window.removeEventListener('resize', update);
        };
      }, [active, visible, state.hidden, state.settings.pageSize]);

      React.useLayoutEffect(function () {
        if (page && active) store.setVisiblePage(page, active.id);
      }, [page ? page.advance : null, page ? page.atEnd : false, active ? active.id : null, store]);

      if (!state.ready || !active) return null;

      var bodyText = page && page.text ? page.text : '';
      var percentLabel = state.loading
        ? t('reader.loading')
        : core.labelPercent(page ? page.start : state.cursor, active.text.length, page ? page.atEnd : false);

      var bodyContent;
      if (!bodyText) {
        bodyContent = h('span', { className: 'sr-input-empty' }, active.text.trim() ? t('reader.end') : t('reader.empty'));
      } else if (state.highlight) {
        bodyContent = highlightNodes(bodyText, state.highlight, page.start);
      } else {
        bodyContent = bodyText;
      }

      function runSearch(direction) {
        var result = store.search(query, direction, regexMode);
        if (result.ok) {
          setSearchMessage(null);
          setMatchInfo(typeof result.ordinal === 'number'
            ? {
              ordinal: result.ordinal,
              total: result.total,
              truncated: result.truncated === true,
            }
            : null);
        } else {
          if (result.messageKey === 'reader.invalidRegex') setMatchInfo(null);
          setSearchMessage({
            key: result.messageKey || 'reader.notFound',
            text: result.messageKey
              ? t(result.messageKey) + (result.message ? ': ' + result.message : '')
              : (result.message || t('reader.notFound')),
            tone: 'error',
          });
        }
      }

      function submitSearch(event) {
        if (event) event.preventDefault();
        runSearch('next');
      }

      function closeSearch() {
        setSearchMessage(null);
        store.closeSearch();
      }

      function openSearch() {
        setSearchMessage(null);
        store.openSearch();
      }

      function keepEditor(event) {
        event.preventDefault();
        event.stopPropagation();
      }

      var toast = null;
      if (!state.searchOpen && state.notice) {
        toast = h('div', {
          className: 'sr-input-toast',
          'data-tone': state.notice.tone || 'info',
          role: 'status',
          title: state.notice.text,
        }, state.notice.text);
      }

      var searchStatusText = searchMessage
        ? searchMessage.text
        : matchInfo
          ? matchInfo.ordinal + '/' + matchInfo.total + (matchInfo.truncated ? '+' : '')
          : '';

      var searchPop = state.searchOpen
        ? h('form', {
          className: 'sr-input-search',
          role: 'search',
          onMouseDown: function (event) { event.stopPropagation(); },
          onSubmit: submitSearch,
        },
          h('div', { className: 'sr-input-search-row' },
            h('input', {
              ref: inputRef,
              className: 'sr-input-search-input',
              type: 'text',
              value: query,
              placeholder: t(regexMode ? 'reader.regexPlaceholder' : 'reader.searchPlaceholder'),
              'aria-label': t('reader.searchTitle'),
              spellCheck: false,
              autoComplete: 'off',
              onChange: function (event) {
                setQuery(event.target.value);
                setSearchMessage(null);
                setMatchInfo(null);
              },
              onKeyDown: function (event) {
                if (event.key === 'Escape') {
                  event.preventDefault();
                  event.stopPropagation();
                  closeSearch();
                } else if (event.key === 'Enter' && event.shiftKey) {
                  event.preventDefault();
                  event.stopPropagation();
                  runSearch('prev');
                }
              },
            }),
            h('button', {
              type: 'button',
              className: 'sr-input-search-btn',
              'data-active': regexMode ? '' : undefined,
              'aria-pressed': regexMode,
              title: t('reader.regexHint'),
              onClick: function () {
                setRegexMode(!regexMode);
                setSearchMessage(null);
                setMatchInfo(null);
              },
            }, t('reader.regex')),
            h('button', {
              type: 'button',
              className: 'sr-input-search-btn sr-input-search-icon-btn',
              title: t('reader.findPrev'),
              'aria-label': t('reader.findPrev'),
              disabled: !query.trim(),
              onClick: function () { runSearch('prev'); },
            }, h(ChevronLeft)),
            h('button', {
              type: 'submit',
              className: 'sr-input-search-btn sr-input-search-icon-btn',
              title: t('reader.findNext'),
              'aria-label': t('reader.findNext'),
              'data-primary': '',
              disabled: !query.trim(),
            }, h(ChevronRight)),
            h('button', { type: 'button', className: 'sr-input-search-btn', onClick: closeSearch }, t('reader.cancel')),
            h('span', {
              className: 'sr-input-search-status',
              role: 'status',
              title: searchStatusText,
            }, searchStatusText)),
          )
        : null;

      if (!visible) {
        return h(Fragment, null,
          h('span', { ref: anchorRef, style: { display: 'none' }, 'aria-hidden': 'true' }),
          h('style', null, INPUT_READER_CSS),
          searchPop);
      }

      return h(Fragment, null,
        h('span', { ref: anchorRef, style: { display: 'none' }, 'aria-hidden': 'true' }),
        h('style', null, INPUT_READER_CSS),
        h('div', { className: 'sr-input-line', 'data-fish-reader': '' },
          h('span', { ref: bodyRef, className: 'sr-input-body' }, bodyContent),
          toast,
          h('div', { className: 'sr-input-meta' },
            h('span', { className: 'sr-input-percent', title: active.alias }, percentLabel),
            h('button', {
              type: 'button',
              className: 'sr-input-icon-btn',
              title: t('reader.searchButton'),
              'aria-label': t('reader.searchButton'),
              onMouseDown: keepEditor,
              onClick: openSearch,
            }, h(SearchIcon)))),
        searchPop);
    }

    function ReaderToolbar(props) {
      var store = props.store;
      var locale = props.locale;
      var state = useStore(store);
      var t = useT(locale);
      var rootRef = React.useRef(null);
      var active = state.active;
      var page = null;
      if (active) {
        page = core.readPage(active.text, state.cursor, state.settings.pageSize, state.settings.trimNextLine);
      }

      function blurEditor() {
        var card = rootRef.current && rootRef.current.closest('[data-composer-card]');
        var editor = card && card.querySelector('[contenteditable="true"]');
        if (editor && typeof editor.blur === 'function') editor.blur();
      }

      function revealReader() {
        if (store.showReader()) blurEditor();
      }

      function keepEditor(event) {
        event.preventDefault();
        event.stopPropagation();
      }

      if (!state.ready || !active) return null;

      var toolbarStyle = {
        display: 'flex',
        alignItems: 'center',
        alignSelf: 'center',
        gap: '2px',
        height: '26px',
        minWidth: 0,
        margin: 0,
        padding: 0,
      };
      var toolbarButtonStyle = {
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flex: 'none',
        width: '24px',
        height: '24px',
        boxSizing: 'border-box',
        margin: 0,
        padding: 0,
        lineHeight: 1,
      };

      return h(Fragment, null,
        h('style', null, TOOLBAR_CSS),
        h('div', { ref: rootRef, className: 'sr-toolbar', 'data-fish-reader-toolbar': '', style: toolbarStyle },
          h('button', {
            type: 'button',
            className: 'sr-toolbar-btn',
            style: toolbarButtonStyle,
            title: t('reader.prev'),
            'aria-label': t('reader.prev'),
            disabled: !page || page.atStart || state.inputMode,
            onMouseDown: keepEditor,
            onClick: function () {
              if (state.inputMode) return;
              revealReader();
              store.previous();
            },
          }, h(ChevronLeft)),
          h('button', {
            type: 'button',
            className: 'sr-toolbar-btn',
            style: toolbarButtonStyle,
            title: t('reader.next'),
            'aria-label': t('reader.next'),
            disabled: !page || page.atEnd || state.inputMode,
            onMouseDown: keepEditor,
            onClick: function () {
              if (state.inputMode) return;
              revealReader();
              store.nextVisible();
            },
          }, h(ChevronRight)),
          h('button', {
            type: 'button',
            className: 'sr-toolbar-btn',
            style: toolbarButtonStyle,
            title: t('reader.boss'),
            'aria-label': t('reader.boss'),
            onMouseDown: keepEditor,
            onClick: function () {
              if (state.inputMode || state.hidden) revealReader();
              else store.toggleBoss();
            },
          }, h(EyeIcon))));
    }

    function BookRow(props) {
      var store = props.store;
      var locale = props.locale;
      var book = props.book;
      var active = props.active;
      var selecting = !!props.selecting;
      var selected = !!props.selected;
      var onToggle = props.onToggle;
      var t = useT(locale);
      var renameState = React.useState(false);
      var renaming = renameState[0];
      var setRenaming = renameState[1];
      var nameState = React.useState(book.alias);
      var name = nameState[0];
      var setName = nameState[1];
      var confirmState = React.useState(false);
      var confirming = confirmState[0];
      var setConfirming = confirmState[1];
      var progress = props.progress;
      var percentValue = progress && Number.isFinite(progress.percent) ? Math.max(0, Math.min(100, progress.percent)) : 0;
      var metaLine = [
        book.encoding || 'TXT',
        book.format === 'epub' && book.chapterCount > 0 ? t('library.chapters', { count: book.chapterCount }) : null,
        t('library.chars', { count: book.charCount }),
        book.sourceName && book.sourceName !== book.alias ? book.sourceName : null,
      ].filter(Boolean).join(' · ');

      function startRename() {
        setName(book.alias);
        setRenaming(true);
        setConfirming(false);
      }

      function saveRename() {
        var result = store.renameBook(book.id, name);
        if (result.ok) setRenaming(false);
      }

      return h('li', { className: 'sr-book', 'data-active': active ? '' : undefined, 'data-selecting': selecting ? '' : undefined },
        selecting ? h('label', { className: 'sr-book-check' },
          h('input', {
            type: 'checkbox',
            checked: selected,
            'aria-label': t('library.batch') + ' ' + book.alias,
            onChange: function () { if (onToggle) onToggle(book.id); },
          })) : null,
        h('div', { className: 'sr-book-main' },
          h('div', { className: 'sr-book-title' },
            h('span', { title: book.alias }, book.alias),
            active ? h('span', { className: 'sr-chip', 'data-tone': 'brand' }, t('library.active')) : null,
            book.uncertain ? h('span', { className: 'sr-chip' }, '编码?') : null),
          h('div', { className: 'sr-book-meta' }, metaLine),
          h('div', { className: 'sr-book-progress' },
            h('div', { className: 'sr-progress', role: 'progressbar', 'aria-label': t('library.progressLabel'), 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': percentValue },
              h('span', { style: { width: percentValue + '%' } })),
            h('span', null, progress ? t('library.lastRead', { percent: percentValue }) : t('library.neverRead'))),
          renaming ? h('div', { className: 'sr-book-edit' },
            h('input', {
              className: 'sr-text-input',
              type: 'text',
              value: name,
              maxLength: 80,
              'aria-label': t('library.rename'),
              onChange: function (event) { setName(event.target.value); },
              onKeyDown: function (event) {
                if (event.key === 'Enter') { event.preventDefault(); saveRename(); }
                if (event.key === 'Escape') { event.preventDefault(); setRenaming(false); }
              },
            }),
            h('button', { type: 'button', className: 'sr-ghost-btn', onClick: saveRename }, t('library.save')),
            h('button', { type: 'button', className: 'sr-ghost-btn', onClick: function () { setRenaming(false); } }, t('library.cancel'))) : null,
          confirming ? h('div', { className: 'sr-book-edit' },
            h('span', { className: 'sr-field-hint' }, t('library.deleteNote')),
            h('button', { type: 'button', className: 'sr-ghost-btn', 'data-danger': '', onClick: function () { void store.deleteBook(book.id); setConfirming(false); } }, t('library.confirm')),
            h('button', { type: 'button', className: 'sr-ghost-btn', onClick: function () { setConfirming(false); } }, t('library.cancel'))) : null),
        selecting ? null : h('div', { className: 'sr-book-actions' },
          h(Fragment, null,
            h('button', {
              type: 'button',
              className: 'sr-ghost-btn',
              onClick: function () { void store.openBook(book.id); },
            }, progress ? t('library.resume') : t('library.openBook')),
            active ? h('button', { type: 'button', className: 'sr-ghost-btn', onClick: function () { store.closeBook(); } }, t('library.closeBook')) : null,
            h('button', { type: 'button', className: 'sr-ghost-btn', onClick: startRename }, t('library.rename')),
            h('button', { type: 'button', className: 'sr-ghost-btn', 'data-danger': '', onClick: function () { setConfirming(true); setRenaming(false); } }, t('library.delete')))));
    }

    function LibraryPanel(props) {
      var store = props.store;
      var locale = props.locale;
      var embedded = props.embedded === true;
      var state = useStore(store);
      var t = useT(locale);
      var fileRef = React.useRef(null);
      var tab = state.libraryTab || 'books';
      var selectingState = React.useState(false);
      var selecting = selectingState[0];
      var setSelecting = selectingState[1];
      var selectedState = React.useState([]);
      var selected = selectedState[0];
      var setSelected = selectedState[1];
      var batchConfirmState = React.useState(false);
      var batchConfirm = batchConfirmState[0];
      var setBatchConfirm = batchConfirmState[1];
      var tabStyle = {
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '28px',
        boxSizing: 'border-box',
        lineHeight: 1,
      };
      // Read progress lazily from localStorage through the same key the store
      // writes; this keeps the row in sync after every page turn.
      var progressMap = readJson(LS_PROGRESS, {});

      function chooseFiles(event) {
        var files = event.target.files;
        if (files && files.length) void store.importFiles(files);
        event.target.value = '';
      }

      function switchTab(next) {
        store.setLibraryTab(next);
      }

      function enterSelecting() {
        setSelecting(true);
        setSelected([]);
        setBatchConfirm(false);
      }

      function exitSelecting() {
        setSelecting(false);
        setSelected([]);
        setBatchConfirm(false);
      }

      function toggleSelected(id) {
        setSelected(function (current) {
          return current.indexOf(id) >= 0
            ? current.filter(function (value) { return value !== id; })
            : current.concat(id);
        });
        setBatchConfirm(false);
      }

      function toggleSelectAll() {
        setSelected(function (current) {
          return current.length === books.length ? [] : books.map(function (book) { return book.id; });
        });
        setBatchConfirm(false);
      }

      async function deleteSelected() {
        var result = await store.deleteBooks(selected);
        if (result.ok) exitSelecting();
        else setBatchConfirm(false);
      }

      function onDropFiles(event) {
        event.preventDefault();
        if (state.importing) return;
        var files = event.dataTransfer && event.dataTransfer.files;
        if (files && files.length) void store.importFiles(files);
      }

      var books = state.books;
      var importing = state.importing;

      React.useEffect(function () {
        if (!state.shortcutCapture) return undefined;
        var action = state.shortcutCapture;
        var onKey = function (event) {
          event.preventDefault();
          event.stopPropagation();
          if (event.key === 'Escape') {
            store.cancelShortcutCapture();
            return;
          }
          var combo = core.shortcutFromEvent(event);
          if (combo === null) return;
          if (combo === '') {
            store.setShortcutError(t('settings.shortcutErrorModifier'));
            return;
          }
          store.assignShortcut(action, combo);
        };
        window.addEventListener('keydown', onKey, true);
        return function () { window.removeEventListener('keydown', onKey, true); };
      }, [state.shortcutCapture, store, t]);

      function shortcutRow(action, labelKey) {
        var capturing = state.shortcutCapture === action;
        return h('div', { className: 'sr-shortcut-row', key: action },
          h('span', { className: 'sr-shortcut-label' }, t(labelKey)),
          h('span', { className: 'sr-shortcut-value', 'data-capturing': capturing ? '' : undefined },
            capturing ? t('settings.shortcutRecording') : core.shortcutLabel(state.settings.shortcuts[action])),
          h('button', {
            type: 'button',
            className: 'sr-ghost-btn',
            onClick: function () {
              if (capturing) store.cancelShortcutCapture();
              else store.startShortcutCapture(action);
            },
          }, capturing ? t('settings.shortcutCancel') : t('settings.shortcutEdit')));
      }

      var settings = h('div', { className: 'sr-settings' },
        h('div', { className: 'sr-field' },
          h('div', { className: 'sr-field-head' },
            h('span', { className: 'sr-field-label' }, t('settings.pageSize')),
            h('div', { className: 'sr-field-row' },
              h('input', {
                className: 'sr-number',
                type: 'number',
                min: 5,
                max: 500,
                step: 1,
                value: state.settings.pageSize,
                'aria-label': t('settings.pageSize'),
                onChange: function (event) { store.updateSettings({ pageSize: Number(event.target.value) }); },
              }),
              h('span', { className: 'sr-field-hint' }, '5–500'))),
          h('span', { className: 'sr-field-hint' }, t('settings.pageSizeHint'))),
        h('div', { className: 'sr-field' },
          h('div', { className: 'sr-field-head' },
            h('span', { className: 'sr-field-label' }, t('settings.hiddenSeconds')),
            h('input', {
              className: 'sr-number',
              type: 'number',
              min: 0,
              max: 3600,
              step: 1,
              value: state.settings.hiddenSeconds,
              'aria-label': t('settings.hiddenSeconds'),
              onChange: function (event) { store.updateSettings({ hiddenSeconds: Number(event.target.value) }); },
            })),
          h('span', { className: 'sr-field-hint' }, t('settings.hiddenSecondsHint'))),
        h('div', { className: 'sr-field' },
          h('label', { className: 'sr-check' },
            h('input', {
              type: 'checkbox',
              checked: state.settings.trimNextLine,
              onChange: function (event) { store.updateSettings({ trimNextLine: event.target.checked }); },
            }),
            h('span', null, t('settings.trim'))),
          h('span', { className: 'sr-field-hint' }, t('settings.trimHint'))),
        h('div', { className: 'sr-field' },
          h('div', { className: 'sr-field-head' },
            h('span', { className: 'sr-field-label' }, t('settings.shortcuts')),
            h('button', {
              type: 'button',
              className: 'sr-ghost-btn',
              onClick: function () { store.resetShortcuts(); },
            }, t('settings.shortcutReset'))),
          h('div', { className: 'sr-shortcut-list' },
            shortcutRow('prev', 'settings.shortcutPrev'),
            shortcutRow('next', 'settings.shortcutNext'),
            shortcutRow('boss', 'settings.shortcutBoss'),
            shortcutRow('search', 'settings.shortcutSearch')),
          state.shortcutError ? h('span', { className: 'sr-shortcut-error', role: 'alert' }, state.shortcutError) : null,
          h('span', { className: 'sr-field-hint' }, t('settings.shortcutHint'))),
        h('p', { className: 'sr-note-line' }, t('settings.localOnly') + ' ' + t('settings.resetHint')));

      var booksView = h('div', { onDragOver: function (event) { event.preventDefault(); }, onDrop: onDropFiles },
        h('div', { className: 'sr-library-toolbar' },
          h('button', {
            type: 'button',
            className: 'sr-primary-btn',
            disabled: !!importing || selecting,
            onClick: function () { if (fileRef.current) fileRef.current.click(); },
          }, h(BookIcon), t('library.import')),
          h('input', {
            ref: fileRef,
            type: 'file',
            accept: '.txt,.text,.epub,text/plain,application/epub+zip',
            multiple: true,
            style: { display: 'none' },
            onChange: chooseFiles,
          }),
          h('button', {
            type: 'button',
            className: 'sr-ghost-btn',
            style: { height: '30px' },
            disabled: !!importing || books.length === 0,
            onClick: selecting ? exitSelecting : enterSelecting,
          }, selecting ? t('library.batchCancel') : t('library.batch')),
          h('span', { className: 'sr-field-hint' }, t('library.importHint')),
          h('span', { className: 'sr-field-hint' }, t('library.copyNote'))),
        selecting ? h('div', { className: 'sr-batch-bar' },
          h('label', { className: 'sr-check' },
            h('input', {
              type: 'checkbox',
              checked: books.length > 0 && selected.length === books.length,
              onChange: toggleSelectAll,
            }),
            h('span', null, t('library.batchSelectAll'))),
          h('span', { className: 'sr-field-hint' }, t('library.batchSelected', { count: selected.length })),
          h('button', {
            type: 'button',
            className: 'sr-ghost-btn',
            'data-danger': '',
            disabled: selected.length === 0,
            onClick: function () { setBatchConfirm(true); },
          }, t('library.batchDelete')),
          h('button', { type: 'button', className: 'sr-ghost-btn', onClick: exitSelecting }, t('library.batchCancel'))) : null,
        batchConfirm && selected.length ? h('div', { className: 'sr-batch-confirm' },
          h('span', { className: 'sr-field-hint' }, t('library.batchConfirmNote', { count: selected.length })),
          h('button', { type: 'button', className: 'sr-ghost-btn', 'data-danger': '', onClick: function () { void deleteSelected(); } }, t('library.batchConfirm')),
          h('button', { type: 'button', className: 'sr-ghost-btn', onClick: function () { setBatchConfirm(false); } }, t('library.cancel'))) : null,
        importing ? h('div', { className: 'sr-import-status' },
          h('span', null, t('library.importing', { name: importing.name, index: importing.index, total: importing.total })),
          h('div', { className: 'sr-progress' }, h('span', { style: { width: (importing.percent || 0) + '%' } }))) : null,
        state.error ? h('div', { className: 'sr-alert', role: 'alert' }, state.error) : null,
        books.length === 0
          ? h('div', { className: 'sr-empty-state' },
            h('strong', null, t('library.empty')),
            h('span', null, t('library.emptyHint')))
          : h('ul', { className: 'sr-book-list' }, books.map(function (book) {
            return h(BookRow, {
              key: book.id,
              store: store,
              locale: locale,
              book: book,
              active: !!(state.active && state.active.id === book.id),
              progress: progressMap[book.id],
              selecting: selecting,
              selected: selected.indexOf(book.id) >= 0,
              onToggle: toggleSelected,
            });
          })),
        state.notice ? h('div', { className: 'sr-notice', 'data-tone': state.notice.tone || 'info', role: 'status' }, state.notice.text) : null);

      if (embedded) {
        return h(Fragment, null,
          h('style', null, LIBRARY_CSS),
          h('div', { className: 'sr-settings-page' },
            h('h2', null, t('section.title')),
            h('p', null, t('section.description')),
            h('div', { className: 'sr-tabs', style: { padding: '0 0 10px' } },
              h('button', { type: 'button', className: 'sr-tab', style: tabStyle, 'data-active': tab === 'books' ? '' : undefined, onClick: function () { switchTab('books'); } }, t('library.tab.books')),
              h('button', { type: 'button', className: 'sr-tab', style: tabStyle, 'data-active': tab === 'settings' ? '' : undefined, onClick: function () { switchTab('settings'); } }, t('library.tab.settings'))),
            tab === 'books' ? booksView : settings));
      }

      return h(Fragment, null,
        h('style', null, LIBRARY_CSS),
        h('div', { className: 'sr-modal-header' },
          h('h2', { className: 'sr-modal-title' }, t('library.title')),
          h('span', { className: 'sr-modal-sub' }, state.active ? t('reader.book', { alias: state.active.alias }) : t('section.description')),
          h('button', { type: 'button', className: 'sr-close-btn', 'aria-label': t('library.close'), title: t('library.close'), onClick: function () { store.closeLibrary(); } }, h(CloseIcon))),
        h('div', { className: 'sr-tabs' },
          h('button', { type: 'button', className: 'sr-tab', style: tabStyle, 'data-active': tab === 'books' ? '' : undefined, onClick: function () { switchTab('books'); } }, t('library.tab.books')),
          h('button', { type: 'button', className: 'sr-tab', style: tabStyle, 'data-active': tab === 'settings' ? '' : undefined, onClick: function () { switchTab('settings'); } }, t('library.tab.settings'))),
        h('div', { className: 'sr-modal-body' }, tab === 'books' ? booksView : settings));
    }

    function LibraryOverlay(props) {
      var store = props.store;
      var locale = props.locale;
      var state = useStore(store);
      var t = useT(locale);
      var panelRef = React.useRef(null);

      React.useEffect(function () {
        if (!state.libraryOpen) return undefined;
        var onKey = function (event) {
          if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            store.closeLibrary();
          }
        };
        window.addEventListener('keydown', onKey, true);
        var timer = window.setTimeout(function () {
          if (panelRef.current) panelRef.current.focus();
        }, 0);
        return function () {
          window.removeEventListener('keydown', onKey, true);
          window.clearTimeout(timer);
        };
      }, [state.libraryOpen, store]);

      if (!state.libraryOpen) return null;

      return h(Fragment, null,
        h('style', null, LIBRARY_CSS),
        h('div', {
          className: 'sr-overlay',
          onMouseDown: function (event) {
            if (event.target === event.currentTarget) store.closeLibrary();
          },
        },
          h('section', {
            ref: panelRef,
            className: 'sr-modal',
            role: 'dialog',
            'aria-modal': 'true',
            'aria-label': t('library.title'),
            tabIndex: -1,
          },
            h(LibraryPanel, { store: store, locale: locale, embedded: false }))));
    }

    function LibraryButton(props) {
      var store = props.store;
      var locale = props.locale;
      var state = useStore(store);
      var t = useT(locale);
      var wide = props.wide !== false;
      return h(Fragment, null,
        h('style', null, BUTTON_CSS),
        h('button', {
          type: 'button',
          className: 'sr-side-btn ' + (wide ? 'sr-side-wide' : 'sr-side-rail'),
          title: t('library.open'),
          'aria-label': t('library.open'),
          'aria-expanded': state.libraryOpen,
          'data-active': state.active ? '' : undefined,
          onClick: function () { store.toggleLibrary(); },
        },
          h(BookIcon, { filled: !!state.active })));
    }

    function SettingsSection(props) {
      var store = props.store;
      var locale = props.locale;
      return h(LibraryPanel, { store: store, locale: locale, embedded: true });
    }

    return {
      InputReader: InputReader,
      ReaderToolbar: ReaderToolbar,
      LibraryOverlay: LibraryOverlay,
      LibraryButton: LibraryButton,
      SettingsSection: SettingsSection,
    };
  }

  // ---------------------------------------------------------------------------
  // Client plugin entry.
  // ---------------------------------------------------------------------------

  window.__ModuleLoader__.load({
    id: MODULE_ID,
    factory(require) {
      var React = require('react');
      var h = React.createElement;
      var components = createComponents(React, h);

      return {
        inject: ['slots', 'locale'],

        apply(ctx) {
          var t = ctx.locale.bind(NS);
          var tr = function (key, vars) { return formatText(t(key), vars); };

          ctx.effect(function () {
            return ctx.locale.register(NS, 'en', EN);
          }, 'fish-reader: locale en');
          ctx.effect(function () {
            return ctx.locale.register(NS, 'zh', ZH);
          }, 'fish-reader: locale zh');
          ctx.effect(function () {
            return ctx.locale.register(NS, 'zh-CN', ZH);
          }, 'fish-reader: locale zh-CN');

          var store = createStore(tr);

          ctx.effect(function () {
            store.init();
            return function () { store.dispose(); };
          }, 'fish-reader: store');

          // Shortcuts are global because the reading session outlives any one
          // slot render, but they only do anything while a book is open and
          // never while an editable control has focus.
          ctx.effect(function () {
            var onKeyDown = function (event) {
              if (event.defaultPrevented || event.isComposing) return;
              var current = store.getSnapshot();
              if (!current.ready || !current.active || current.libraryOpen || current.shortcutCapture) return;
              var combo = core.shortcutFromEvent(event);
              if (!combo) return;
              var target = event.target;
              var element = target && target.closest ? target : null;
              if (element && element.closest('input, textarea, select')) return;
              var editor = element && element.closest('[contenteditable="true"], [contenteditable=""], [role="textbox"]');
              if (editor) {
                // Only the hide/show shortcut may cross from a focused, empty
                // composer into the reader.  A real draft keeps focus.
                if (combo !== current.settings.shortcuts.boss) return;
                if ((editor.innerText || '').trim() !== '') return;
                event.preventDefault();
                event.stopPropagation();
                if (store.showReader()) {
                  if (editor && typeof editor.blur === 'function') editor.blur();
                }
                return;
              }
              var shortcuts = current.settings.shortcuts;
              if (combo === shortcuts.prev) {
                event.preventDefault();
                event.stopPropagation();
                store.previous();
              } else if (combo === shortcuts.next) {
                event.preventDefault();
                event.stopPropagation();
                store.nextVisible();
              } else if (combo === shortcuts.boss) {
                event.preventDefault();
                event.stopPropagation();
                store.toggleBoss();
              } else if (combo === shortcuts.search) {
                event.preventDefault();
                event.stopPropagation();
                store.openSearch();
              }
            };
            window.addEventListener('keydown', onKeyDown, true);
            return function () { window.removeEventListener('keydown', onKeyDown, true); };
          }, 'fish-reader: shortcuts');

          function injectFace() {
            return { store: store, locale: ctx.locale };
          }

          ctx.slots.inject('conversation.input.overlay', function () {
            return ctx.slots.register({
              name: 'conversation.input.overlay',
              id: 'fish-reader',
              order: 20,
              inject: injectFace,
            }, components.InputReader);
          });

          ctx.slots.inject('conversation.input.left', function () {
            return ctx.slots.register({
              name: 'conversation.input.left',
              id: 'fish-reader',
              order: 0,
              inject: injectFace,
            }, components.ReaderToolbar);
          });

          ctx.slots.inject('sidebar.footer.action', function () {
            return ctx.slots.register({
              name: 'sidebar.footer.action',
              id: 'fish-reader-library',
              order: 30,
              inject: injectFace,
            }, components.LibraryButton);
          });

          ctx.slots.inject('shell.overlay', function () {
            return ctx.slots.register({
              name: 'shell.overlay',
              id: 'fish-reader-library',
              order: 70,
              inject: injectFace,
            }, components.LibraryOverlay);
          });

          ctx.slots.inject('settings.section', function () {
            return ctx.slots.register({
              name: 'settings.section',
              id: 'fish-reader',
              order: 30,
              label: function () { return t('section.label'); },
              inject: injectFace,
            }, components.SettingsSection);
          });
        },

        // Test hook used by test/core.test.mjs.  It is inert in DSH.
        __core: core,
      };
    },
  });
})();
