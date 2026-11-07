import MarkdownIt from 'markdown-it'
import type { MarkdownIt as MarkdownItInstance } from 'markdown-it'
import { getEmote, escapeHtml } from './emotes'

const MAX_NESTING = 8

const EMOTE_AT = /`([^`\n]{1,40})`/y

const emotePlugin = (md: MarkdownItInstance) => {
  md.inline.ruler.before('backticks', 'emote', (state, silent) => {
    if (state.src.charCodeAt(state.pos) !== 0x60 ) return false
    EMOTE_AT.lastIndex = state.pos
    const match = EMOTE_AT.exec(state.src)
    if (!match) return false
    const emote = getEmote(match[1])
    if (!emote) return false
    if (!silent) {
      const token = state.push('emote', 'img', 0)
      token.attrSet('src', emote.imgUrl)
      token.attrSet('alt', emote.id)
    }
    state.pos += match[0].length
    return true
  })

  md.renderer.rules.emote = (tokens, idx, _opts, env) => {
    const size = (env as { emoteSize?: number })?.emoteSize ?? 20
    const src = escapeHtml(String(tokens[idx].attrGet('src') ?? ''))
    const id = escapeHtml(String(tokens[idx].attrGet('alt') ?? ''))
    const shift = Math.round(size * -0.22)
    return `<img src="${src}" alt="${id}" title="${id}" ` +
      `style="height:${size}px;width:auto;vertical-align:${shift}px;display:inline-block;">`
  }
}

const tablePlugin = (md: MarkdownItInstance) => {
  md.renderer.rules.table_open = () => '<div class="md-table"><table>'
  md.renderer.rules.table_close = () => '</table></div>'
}

const linkPlugin = (md: MarkdownItInstance) => {
  const base = md.renderer.rules.link_open
  md.renderer.rules.link_open = (tokens, idx, opts, env, self) => {
    tokens[idx].attrSet('target', '_blank')
    tokens[idx].attrSet('rel', 'noopener noreferrer nofollow ugc')
    return base
      ? base(tokens, idx, opts, env, self)
      : self.renderToken(tokens, idx, opts)
  }
}

const md = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: true,
  typographer: false,
  maxNesting: MAX_NESTING,
})

md.use(emotePlugin)
md.use(linkPlugin)
md.use(tablePlugin)

md.disable(['image', 'heading', 'lheading', 'hr'])

const MAX_LINE_BREAKS = 30

function capLineBreaks(text: string): string {
  let seen = 0
  return text.replace(/\n/g, (nl) => (++seen <= MAX_LINE_BREAKS ? nl : ' '))
}

export function renderMarkdown(text: string, size = 20): string {
  if (!text) return ''
  return md.render(capLineBreaks(text), { emoteSize: size })
}

const mdLongform = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: false,
  typographer: false,
  maxNesting: MAX_NESTING,
})

mdLongform.use(linkPlugin)
mdLongform.use(tablePlugin)

mdLongform.renderer.rules.heading_open = (tokens, idx, opts, _env, self) => {
  const level = Math.min(6, Number(tokens[idx].tag.slice(1)) + 1)
  tokens[idx].tag = `h${level}`
  return self.renderToken(tokens, idx, opts)
}
mdLongform.renderer.rules.heading_close = (tokens, idx, opts, _env, self) => {
  const level = Math.min(6, Number(tokens[idx].tag.slice(1)) + 1)
  tokens[idx].tag = `h${level}`
  return self.renderToken(tokens, idx, opts)
}

const INVISIBLE_PADDING = /[​﻿]/g

const MAX_LONGFORM_BLOCKS = 300

export function hasVisibleProse(text: string | null | undefined): boolean {
  if (!text) return false
  return text.replace(INVISIBLE_PADDING, '').trim().length > 0
}

export function renderLongform(text: string): string {
  if (!text) return ''

  const cleaned = text
    .replace(INVISIBLE_PADDING, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  if (!cleaned) return ''

  const html = mdLongform.render(cleaned)

  const blocks = (html.match(/<\/(p|h[1-6]|li|tr|blockquote|pre)>/g) || []).length
  if (blocks <= MAX_LONGFORM_BLOCKS) return html

  return mdLongform.render(
    cleaned.split('\n\n').slice(0, MAX_LONGFORM_BLOCKS).join('\n\n'),
  ) + '<p><em>… truncated</em></p>'
}
