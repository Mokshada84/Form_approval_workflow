import { describe, expect, it } from 'vitest'
import { reciprocalRankFusion } from './fuse'

const ids = (lists: string[][], k?: number) =>
  reciprocalRankFusion(lists, k).map((entry) => entry.id)

describe('reciprocalRankFusion', () => {
  it('keeps a single list in its original order', () => {
    expect(ids([['a', 'b', 'c']])).toEqual(['a', 'b', 'c'])
  })

  it('rewards agreement over one retriever being certain', () => {
    // 'b' is nobody's favourite but both retrievers rate it highly; 'a' and
    // 'c' are each a single retriever's top pick and the other's miss. That
    // is exactly the case fusion exists for.
    expect(ids([
      ['a', 'b'],
      ['c', 'b'],
    ])[0]).toBe('b')
  })

  it('merges results neither list had alone', () => {
    const fused = ids([['a', 'b'], ['c', 'd']])
    expect(fused).toHaveLength(4)
    expect(new Set(fused)).toEqual(new Set(['a', 'b', 'c', 'd']))
  })

  it('records where each retriever placed a result', () => {
    const [top] = reciprocalRankFusion([['x', 'y'], ['y', 'x']])
    expect(top.ranks).toHaveLength(2)
    // Found by both, so neither rank is null.
    expect(top.ranks.every((rank) => rank !== null)).toBe(true)
  })

  it('marks a retriever that missed a result', () => {
    const onlyInFirst = reciprocalRankFusion([['a'], ['b']]).find((e) => e.id === 'a')
    expect(onlyInFirst?.ranks).toEqual([1, null])
  })

  it('lets a smaller k sharpen the advantage of first place', () => {
    // With a large k the positions flatten and agreement wins; with a small k
    // a first place counts for much more. Worth knowing the knob exists.
    expect(ids([['a', 'b', 'c'], ['b', 'c', 'a']], 60)[0]).toBe('b')
    expect(ids([['a', 'b', 'c'], ['a', 'c', 'b']], 1)[0]).toBe('a')
  })

  it('returns nothing for no lists', () => {
    expect(reciprocalRankFusion([])).toEqual([])
  })
})
