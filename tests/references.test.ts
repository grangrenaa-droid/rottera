import { describe, expect, it } from 'vitest'
import { REFERENCE_KINDS, cleanReferences } from '../src/shared/storyboard'
import { parseScriptFile, serialize } from '../src/shared/scriptfile'
import { emptyStoryboard, type Script } from '../src/shared/types'

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

describe('storyboard references', () => {
  it('kinds name what a reference is for', () => {
    expect(Object.values(REFERENCE_KINDS)).toEqual(['Luz', 'Cor', 'Figurino', 'Locação', 'Enquadramento', 'Outro'])
  })

  it('go into the file with the storyboard and come back as they were', () => {
    const refs = [{ id: 'r1', image: PNG, caption: 'Luz de fim de tarde', kind: 'light' as const, scenes: ['s1'] }]
    const s: Script = { titlePage: { title: '', author: '', contact: '' }, blocks: [], storyboard: { ...emptyStoryboard(), references: refs } }
    expect(parseScriptFile(serialize(s)).storyboard?.references).toEqual(refs)
  })

  it('throw away what is not a picture, and unknown kinds become Outro', () => {
    expect(
      cleanReferences([
        { id: 'a', image: 'javascript:1', caption: 'x', kind: 'light' },
        { id: 'b', image: PNG, caption: 'y'.repeat(900), kind: 'cheiro', scenes: ['s1', 3, 's2'] },
        { image: PNG },
        'x'
      ])
    ).toEqual([{ id: 'b', image: PNG, caption: 'y'.repeat(600), kind: 'other', scenes: ['s1', 's2'] }])
    expect(cleanReferences('x')).toEqual([])
  })
})
