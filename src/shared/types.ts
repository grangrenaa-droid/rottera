export type Kind =
  | 'scene_heading'
  | 'action'
  | 'character'
  | 'dialogue'
  | 'parenthetical'
  | 'transition'
  | 'shot'

export interface Block {
  kind: Kind
  text: string
  /** Part of the right-hand speaker of a dual dialogue (set on every block of that group). */
  dual?: boolean
  /** Revision set id (see revisions.ts) this block was last changed in. */
  rev?: string
  /** Locked scene number, only on scene headings. */
  sn?: string
  /** Beat (board card) this scene was made from, only on scene headings. */
  bid?: string
}

export interface TitlePage {
  title: string
  author: string
  contact: string
}

export interface Lane {
  id: string
  name: string
}

export interface Beat {
  id: string
  lane: string
  title: string
  body: string
  color: string
}

export interface Board {
  lanes: Lane[]
  beats: Beat[]
}

/** Entries the writer added to the SmartType lists by hand. */
export interface Extras {
  characters: string[]
  locations: string[]
  times: string[]
}

export interface RevisionState {
  mode: boolean
  color: string
}

export type StoryboardAspect = '16:9' | '2.39:1' | '4:3' | '1:1' | '9:16'
export type StoryboardLayout = 2 | 4 | 6 | 9

export interface Frame {
  id: string
  /** data:image/... URL, already downscaled by the app. Empty for a planned shot with no picture yet. */
  image: string
  caption: string
  /** Free label, usually the scene number this shot belongs to. */
  scene: string
}

export interface Storyboard {
  frames: Frame[]
  aspect: StoryboardAspect
  /** Frames per printed page. */
  layout: StoryboardLayout
  /** Append the storyboard pages to the script PDF. */
  includeInPdf: boolean
}

export type LightItemType =
  | 'camera'
  | 'actor'
  | 'fresnel'
  | 'led'
  | 'hmi'
  | 'softbox'
  | 'practical'
  | 'sun'
  | 'flag'
  | 'diffuser'
  | 'reflector'
  | 'bounce'
  | 'cstand'
  | 'monitor'
  | 'dolly'
  | 'table'
  | 'chair'
  | 'door'
  | 'window'
  | 'wall'

export interface LightItem {
  id: string
  type: LightItemType
  /** Position in metres from the top-left corner of the set. */
  x: number
  y: number
  /** Degrees, 0 = pointing to the top of the drawing, clockwise. */
  rotation: number
  label: string
  /** Beam or field-of-view angle in degrees (cameras and lights). */
  spread?: number
  /** Beam length in metres. */
  range?: number
  /** Length in metres (flags, tracks, walls, doors...). */
  length?: number
}

export interface LightMap {
  id: string
  name: string
  /** Scene number this diagram belongs to (free text). */
  scene: string
  /** Size of the set in metres. */
  width: number
  height: number
  items: LightItem[]
  notes: string
  includeInPdf: boolean
}

export type Paper = 'letter' | 'a4'

/** What the writer says about a character. Matched to the script by name (capitals, no extension). */
export interface CharacterSheet {
  id: string
  name: string
  alias: string
  age: string
  role: string
  appearance: string
  personality: string
  goal: string
  conflict: string
  arc: string
  relationships: string
  notes: string
  /** data:image/... URL, already downscaled by the app. Empty when there is no picture. */
  image: string
  includeInPdf: boolean
}

export interface Script {
  titlePage: TitlePage
  blocks: Block[]
  board?: Board
  storyboard?: Storyboard
  /** Paper for the PDF and for page counting. Missing means letter. */
  paper?: Paper
  characters?: CharacterSheet[]
  lightMaps?: LightMap[]
  extras?: Extras
  revision?: RevisionState
  /** Scene numbers are frozen (new scenes get 3A, 3B...). */
  scenesLocked?: boolean
  /** Show scene numbers in the margins. */
  numberScenes?: boolean
}

export interface ScriptFile {
  /** Files saved before the app had its name say 'clapboard'; both are read, new files say 'rotera'. */
  format: 'rotera' | 'clapboard'
  version: 1
  savedAt: string
  script: Script
}

export function emptyBoard(): Board {
  return { lanes: [], beats: [] }
}

export function emptyStoryboard(): Storyboard {
  return { frames: [], aspect: '16:9', layout: 6, includeInPdf: true }
}

export function emptyExtras(): Extras {
  return { characters: [], locations: [], times: [] }
}

export function emptyScript(): Script {
  return {
    titlePage: { title: '', author: '', contact: '' },
    blocks: [{ kind: 'scene_heading', text: '' }]
  }
}
