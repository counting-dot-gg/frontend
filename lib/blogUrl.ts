export function slugify(title: string): string {
  const slug = (title || '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/, '')
  return slug || 'post'
}

export function blogPath(blog: { id?: number; uuid: string; title: string }): string {
  if (typeof blog.id !== 'number' || !Number.isFinite(blog.id)) {
    return `/blog/${blog.uuid}`
  }
  return `/blog/${slugify(blog.title)}-${blog.id}`
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function parseBlogParam(param: string): { id?: number; uuid?: string } {
  const value = decodeURIComponent(param || '')

  if (UUID_RE.test(value)) return { uuid: value }

  const trailing = value.match(/-(\d+)$/)
  if (trailing) return { id: Number(trailing[1]) }

  if (/^\d+$/.test(value)) return { id: Number(value) }

  return {}
}

export function parseBlogTimestamp(timestamp: string | number | null | undefined): Date | null {
  if (timestamp === null || timestamp === undefined || timestamp === '') return null
  const ms = Number(timestamp)
  if (!Number.isFinite(ms)) return null
  const d = new Date(ms)
  return Number.isNaN(d.getTime()) ? null : d
}
