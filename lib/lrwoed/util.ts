import dictionary from './dictionary.json'

export enum Difficulty {
  Normal,
  Hard,
  UltraHard,
}

export const gameName = 'lrwoed'
export const maxGuesses = 8

export const dictionarySet: Set<string> = new Set(dictionary)

export function urlParam(name: string): string | null {
  if (typeof window === 'undefined') return null
  return new URLSearchParams(window.location.search).get(name)
}

export function todaySeedString(): string {
  const now = new Date()
  return (
    now.toLocaleDateString('en-US', { year: 'numeric' }) +
    now.toLocaleDateString('en-US', { month: '2-digit' }) +
    now.toLocaleDateString('en-US', { day: '2-digit' })
  )
}

export function getSeed(): number {
  return Number(urlParam('seed'))
}

export function speak(text: string, priority: 'polite' | 'assertive' = 'assertive') {
  const el = document.createElement('div')
  const id = 'speak-' + Date.now()
  el.setAttribute('id', id)
  el.setAttribute('aria-live', priority || 'polite')
  el.classList.add('sr-only')
  document.body.appendChild(el)

  window.setTimeout(function () {
    const node = document.getElementById(id)
    if (node) node.innerHTML = text
  }, 100)

  window.setTimeout(function () {
    const node = document.getElementById(id)
    if (node) document.body.removeChild(node)
  }, 1000)
}

export function ordinal(n: number): string {
  return n + ([, 'st', 'nd', 'rd'][((n % 100 >> 3) ^ 1) && n % 10] || 'th')
}

export const englishNumbers = 'zero one two three four five six seven eight nine ten eleven'.split(' ')

export function describeSeed(seed: number): string {
  const year = Math.floor(seed / 10000)
  const month = Math.floor(seed / 100) % 100
  const day = seed % 100
  const isLeap = year % (year % 25 ? 4 : 16) === 0
  const feb = isLeap ? 29 : 28
  const days = [0, 31, feb, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  if (year >= 2000 && year <= 2100 && month >= 1 && month <= 12 && day >= 1 && day <= days[month]) {
    return new Date(year, month - 1, day).toLocaleDateString('en-US', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
  } else {
    return 'seed ' + seed
  }
}
