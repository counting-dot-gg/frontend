import seedrandom from 'seedrandom'
import dictionary from './dictionary.json'
import { todaySeedString } from './util'

export function getRandomNonDictionaryWord(seed?: number): string {
  if (!seed) {
    seed = Number(todaySeedString())
  }
  let result = ''
  let failCount = 0
  const characters = 'abcdefghijklmnopqrstuvwxyz'
  const charactersLength = characters.length

  const rngWord = () => {
    let rng_counter = 0
    while (rng_counter < 5) {
      const rng = seedrandom(`${seed}-${failCount}-${rng_counter}`)
      result += characters.charAt(Math.floor(rng() * charactersLength))
      rng_counter += 1
    }
    return result
  }

  let word = rngWord()

  while ((dictionary as string[]).includes(word)) {
    failCount += 1
    word = rngWord()
  }
  return word
}
