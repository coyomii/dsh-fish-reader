import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const fixtures = path.join(here, 'fixtures')

let captured
globalThis.window = {
  __ModuleLoader__: {
    load(definition) {
      captured = definition
    },
  },
}

const fakeReact = {
  Fragment: Symbol('Fragment'),
  createElement() {},
  useCallback(fn) { return fn },
  useState(value) { return [value, () => {}] },
  useRef(value) { return { current: value } },
  useEffect() {},
  useLayoutEffect() {},
  useSyncExternalStore() {},
}

await import(pathToFileURL(path.join(here, '..', 'client.js')).href)
const plugin = captured.factory((name) => {
  if (name === 'react') return fakeReact
  throw new Error(`unexpected module: ${name}`)
})
const core = plugin.__core

const simplified = '第一章 测试\n这是一段用于编码检测的中文文本。\nHello world 12345\n'
const traditional = '第一章 測試\n這是一段用於編碼檢測的中文文本。\nHello world 12345\n'

function bytesOf(name) {
  return new Uint8Array(fs.readFileSync(path.join(fixtures, name)))
}

function decodeStream(bytes, encoding, chunkSize) {
  const decoder = core.createStreamDecoder(encoding)
  const parts = []
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const end = Math.min(offset + chunkSize, bytes.length)
    parts.push(decoder.decode(bytes.subarray(offset, end), end >= bytes.length))
  }
  return parts.join('')
}

test('normalizeText strips BOM and normalizes newlines', () => {
  assert.equal(core.normalizeText('\uFEFFa\r\nb\rc\u0000'), 'a\nb\nc')
})

test('isReadableText rejects binary-looking samples', () => {
  assert.equal(core.isReadableText('第一章 测试\nHello world'), true)
  assert.equal(core.isReadableText('\uFFFD'.repeat(10) + 'abc'), false)
  assert.equal(core.isReadableText('\u0001\u0002\u0003abc'), false)
  assert.equal(core.isReadableText('   \n\t'), false)
})

test('readPage stops at newline and maximum length', () => {
  const text = 'abc\ndefgh\nij'
  const p1 = core.readPage(text, 0, 3, false)
  assert.equal(p1.text, 'abc')
  assert.equal(p1.start, 0)
  assert.equal(p1.rawEnd, 3)
  const p2 = core.readPage(text, p1.rawEnd, 3, false)
  assert.equal(p2.text, 'def')
  assert.equal(p2.start, 4)
  const p3 = core.readPage(text, p2.rawEnd, 3, false)
  assert.equal(p3.text, 'gh')
  const p4 = core.readPage(text, p3.rawEnd, 3, false)
  assert.equal(p4.text, 'ij')
  assert.equal(p4.atEnd, true)
})

test('trimNextLine removes surrounding whitespace but keeps the cursor moving', () => {
  const text = '  abc  \ndef'
  const page = core.readPage(text, 0, 10, true)
  assert.equal(page.text, 'abc')
  assert.equal(page.lead, 2)
  assert.equal(page.rawEnd, 7)
  const next = core.readPage(text, page.rawEnd, 10, true)
  assert.equal(next.text, 'def')
})

test('fitPage advances by exactly the displayed characters when width shrinks', () => {
  const text = 'abcdefghij'
  let cursor = 0
  let shown = ''
  for (const fit of [4, 3, 5]) {
    const page = core.readPage(text, cursor, 10, false)
    const fitted = core.fitPage(page, text.length, fit, false)
    shown += fitted.text
    cursor = fitted.advance
  }
  assert.equal(shown, text)
  assert.equal(cursor, text.length)
})

test('fitPage trims leading whitespace without losing content', () => {
  const text = '   abcdef'
  const base = core.readPage(text, 0, 10, true)
  const first = core.fitPage(base, text.length, 3, true)
  assert.equal(first.text, 'abc')
  assert.equal(first.advance, 6)
  const second = core.fitPage(core.readPage(text, first.advance, 10, true), text.length, 10, true)
  assert.equal(second.text, 'def')
  assert.equal(second.advance, text.length)
})

test('previousPageStart walks back one segment at a time', () => {
  const text = 'a'.repeat(100)
  assert.equal(core.previousPageStart(text, 50, 30), 30)
  assert.equal(core.previousPageStart(text, 30, 30), 0)
  assert.equal(core.previousPageStart('abc\ndef', 4, 10), 0)
})

test('lastPageStart and 100 percent land on the last visible segment', () => {
  const text = 'a'.repeat(100)
  assert.equal(core.lastPageStart(text, 30), 90)
  assert.equal(core.jumpPercent(text, 100, 30, false), 90)
  assert.equal(core.jumpPercent(text, 0, 30, false), 0)
  const withTrailing = 'abc\n\n  \n'
  assert.equal(core.lastPageStart(withTrailing, 30), 0)
  assert.equal(core.readPage(withTrailing, 0, 30, false).text, 'abc')
})

test('percent parsing accepts decimals and rejects out-of-range values', () => {
  assert.deepEqual(core.parsePercent('12'), null)
  assert.deepEqual(core.parsePercent('12%'), { value: 12 })
  assert.deepEqual(core.parsePercent('12.5%'), { value: 12.5 })
  assert.deepEqual(core.parsePercent('100%'), { value: 100 })
  assert.deepEqual(core.parsePercent('101%'), { invalid: true })
  assert.deepEqual(core.parsePercent('abc'), null)
})

test('searchForward matches across page boundaries', () => {
  const text = 'abc\ndefgh\nij'
  assert.equal(core.searchForward(text, 'def', 0), 4)
  assert.equal(core.searchForward(text, 'ghij', 0), -1) // newline is between
  assert.equal(core.searchForward(text, 'efg', 0), 5)
  assert.equal(core.searchForward(text, 'def', 5), -1)
})

test('searchBackward finds the previous occurrence without wrapping', () => {
  const text = 'abc abc abc'
  assert.equal(core.searchBackward(text, 'abc', 10), 8)
  assert.equal(core.searchBackward(text, 'abc', 7), 4)
  assert.equal(core.searchBackward(text, 'abc', 3), 0)
  assert.equal(core.searchBackward(text, 'abc', 0), 0)
  assert.equal(core.searchBackward(text, 'zzz', 10), -1)
})

test('regex search matches lengths, direction and invalid patterns', () => {
  const text = 'abc 123 def 456'
  assert.deepEqual(core.findSearchMatch(text, '\\d+', 0, 'next', true), { index: 4, length: 3 })
  assert.deepEqual(core.findSearchMatch(text, '\\d+', 5, 'next', true), { index: 5, length: 2 })
  assert.deepEqual(core.findSearchMatch(text, '\\d+', 7, 'next', true), { index: 12, length: 3 })
  assert.deepEqual(core.findSearchMatch(text, '\\d+', 11, 'prev', true), { index: 4, length: 3 })
  assert.deepEqual(core.findSearchMatch(text, '^', 0, 'next', true), { index: 0, length: 0 })
  const invalid = core.findSearchMatch(text, '[', 0, 'next', true)
  assert.equal(invalid.index, -1)
  assert.ok(invalid.error)
  assert.deepEqual(core.findSearchMatch('abc abc', 'abc', 4, 'next', false), { index: 4, length: 3 })
})

test('collectSearchMatches counts literal and regex matches with a cap', () => {
  const literal = core.collectSearchMatches('abc abc abc', 'abc', false, 20)
  assert.deepEqual(literal.matches, [
    { index: 0, length: 3 },
    { index: 4, length: 3 },
    { index: 8, length: 3 },
  ])
  assert.equal(literal.truncated, false)

  const regex = core.collectSearchMatches('abc 123 def 456', '\\d+', true, 20)
  assert.deepEqual(regex.matches, [
    { index: 4, length: 3 },
    { index: 12, length: 3 },
  ])
  assert.equal(regex.truncated, false)

  const capped = core.collectSearchMatches('aaaa', 'a', false, 2)
  assert.equal(capped.matches.length, 2)
  assert.equal(capped.truncated, true)

  const invalid = core.collectSearchMatches('abc', '[', true, 20)
  assert.ok(invalid.error)
  assert.equal(invalid.matches.length, 0)
})

test('detects and decodes UTF-8, UTF-16, UTF-32, GB18030 and Big5', () => {
  const cases = [
    ['sample-utf8.txt', 'UTF-8', simplified],
    ['sample-gb18030.txt', 'GB18030', simplified],
    ['sample-big5.txt', 'Big5', traditional],
    ['sample-utf16le-bom.txt', 'UTF-16 LE', simplified],
    ['sample-utf16be-bom.txt', 'UTF-16 BE', simplified],
    ['sample-utf32le-bom.txt', 'UTF-32 LE', simplified],
    ['sample-utf32be-bom.txt', 'UTF-32 BE', simplified],
  ]
  for (const [file, label, expected] of cases) {
    const bytes = bytesOf(file)
    const encoding = core.detectEncoding(bytes)
    assert.equal(encoding.label, label, `${file} label`)
    const decoded = core.decodeAll(bytes, encoding)
    assert.equal(core.normalizeText(decoded), expected, `${file} text`)
  }
})

test('stream decoding survives arbitrary chunk boundaries', () => {
  for (const [file, label] of [
    ['sample-utf8.txt', 'UTF-8'],
    ['sample-gb18030.txt', 'GB18030'],
    ['sample-big5.txt', 'Big5'],
    ['sample-utf16le-bom.txt', 'UTF-16 LE'],
    ['sample-utf32le-bom.txt', 'UTF-32 LE'],
    ['sample-utf32be-bom.txt', 'UTF-32 BE'],
  ]) {
    const bytes = bytesOf(file)
    const encoding = core.detectEncoding(bytes)
    assert.equal(encoding.label, label)
    const text = core.normalizeText(decodeStream(bytes, encoding, 7))
    assert.ok(text.includes('第一章'), `${file} stream text`)
  }
})

test('reads an EPUB through the ZIP container and OPF spine', async () => {
  const bytes = bytesOf('sample.epub')
  const entries = core.parseZipEntries(bytes)
  assert.ok(entries.some((entry) => entry.name === 'META-INF/container.xml'))
  assert.ok(entries.some((entry) => entry.name === 'OEBPS/ch1.xhtml'))
  const result = await core.epubToText(bytes)
  assert.equal(result.chapterCount, 2)
  assert.equal(result.encoding, 'EPUB')
  assert.match(result.text, /第一章 起点/)
  assert.match(result.text, /第二章 继续/)
  assert.match(result.text, /加粗/)
  assert.match(result.text, /& 符号/)
  assert.ok(result.text.indexOf('第一章 起点') < result.text.indexOf('第二章 继续'))
  assert.ok(!result.text.includes('nav.xhtml'))
})

test('htmlToText keeps block breaks, inline text and entities', () => {
  const text = core.htmlToText('<h1>标题</h1><p>第一段<br/>换行 &amp; 实体</p><p>第二段</p>')
  assert.equal(text, '标题\n第一段\n换行 & 实体\n第二段')
})

test('EPUB path resolution handles relative OPF hrefs', () => {
  assert.equal(core.resolveHref('OEBPS/content.opf', 'ch1.xhtml'), 'OEBPS/ch1.xhtml')
  assert.equal(core.resolveHref('OEBPS/content.opf', '../text/ch1.xhtml'), 'text/ch1.xhtml')
  assert.equal(core.resolveHref('OEBPS/content.opf', 'ch1.xhtml#top'), 'OEBPS/ch1.xhtml')
})

test('custom shortcuts normalize, label and validate modifiers', () => {
  assert.equal(core.normalizeShortcut('Shift+Alt+KeyX', null), 'Alt+Shift+KeyX')
  assert.equal(core.normalizeShortcut('Ctrl+Comma', null), 'Ctrl+Comma')
  assert.equal(core.normalizeShortcut('KeyX', null), null)
  assert.equal(core.normalizeShortcut('Shift+KeyX', null), null)
  assert.equal(core.shortcutLabel('Alt+Comma'), 'Alt+,')
  assert.equal(core.shortcutLabel('Alt+Period'), 'Alt+.')
  assert.equal(core.shortcutLabel('Alt+Slash'), 'Alt+/')
  assert.equal(core.shortcutLabel('Alt+KeyF'), 'Alt+F')
  const settings = core.sanitizeSettings({ shortcuts: { prev: 'Shift+KeyX', next: 'Ctrl+Period' } })
  assert.equal(settings.shortcuts.prev, 'Alt+Comma')
  assert.equal(settings.shortcuts.next, 'Ctrl+Period')
  assert.equal(settings.shortcuts.boss, 'Alt+Slash')
  assert.equal(settings.shortcuts.search, 'Alt+KeyF')
})

test('shortcut events produce canonical combinations', () => {
  assert.equal(core.shortcutFromEvent({ code: 'KeyF', altKey: true }), 'Alt+KeyF')
  assert.equal(core.shortcutFromEvent({ code: 'Comma', altKey: true }), 'Alt+Comma')
  assert.equal(core.shortcutFromEvent({ code: 'KeyX', ctrlKey: true, shiftKey: true }), 'Ctrl+Shift+KeyX')
  assert.equal(core.shortcutFromEvent({ code: 'ShiftLeft', shiftKey: true }), null)
  assert.equal(core.shortcutFromEvent({ code: 'KeyF' }), '')
})

test('alias helpers keep names unique and readable', () => {
  assert.equal(core.stripExtension('C:\\books\\活着.txt'), '活着')
  assert.equal(core.stripExtension('no-extension'), 'no-extension')
  assert.equal(core.uniqueAlias('活着', []), '活着')
  assert.equal(core.uniqueAlias('活着', [{ alias: '活着' }]), '活着 (2)')
  assert.equal(core.uniqueAlias('活着', [{ alias: '活着' }, { alias: '活着 (2)' }]), '活着 (3)')
})
