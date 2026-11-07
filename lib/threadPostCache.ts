import type { PostRow } from '@/components/thread/ThreadView'
import type { ThreadInfo } from '@/components/thread/AboutTab'

const MAX_CACHED_THREADS = 12
const MAX_POSTS_PER_THREAD = 60

interface CachedThread {
  threadName: string
  threadUUID: string
  posts: PostRow[]
  thread?: ThreadInfo
  updatedAt: number
}

const cache = new Map<string, CachedThread>()
const uuidToName = new Map<string, string>()

export function getCachedThread(threadName: string): CachedThread | undefined {
  return cache.get(threadName)
}

function touch(threadName: string) {
  const entry = cache.get(threadName)
  if (!entry) return
  cache.delete(threadName)
  cache.set(threadName, entry)
  while (cache.size > MAX_CACHED_THREADS) {
    const oldestKey = cache.keys().next().value
    if (oldestKey === undefined) break
    cache.delete(oldestKey)
  }
}

export function seedThreadPostCache(threadName: string, threadUUID: string, posts: PostRow[], thread?: ThreadInfo) {
  uuidToName.set(threadUUID, threadName)
  cache.set(threadName, {
    threadName,
    threadUUID,
    posts: posts.slice(0, MAX_POSTS_PER_THREAD),
    thread,
    updatedAt: Date.now(),
  })
  touch(threadName)
}

export function appendCachedPost(threadUUID: string, post: PostRow) {
  const threadName = uuidToName.get(threadUUID)
  if (!threadName) return
  const entry = cache.get(threadName)
  if (!entry) return
  if (entry.posts.some(p => p.uuid === post.uuid)) return
  entry.posts = [post, ...entry.posts].slice(0, MAX_POSTS_PER_THREAD)
  entry.updatedAt = Date.now()
  touch(threadName)
}
