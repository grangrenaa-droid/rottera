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
  /** What happens in the scene, in a line, only on scene headings. Shown under the heading and in the navigator; never printed. */
  syn?: string
  /**
   * Stable id of this line, given on demand. Notes pin to it; on scene headings it is the scene's id,
   * which the breakdown, the shooting days, storyboard frames and light maps refer to.
   */
  nid?: string
}

export type NoteColor = 'yellow' | 'blue' | 'pink' | 'green'

/** A sticky note in the notes column, pinned to one line of the script. Never printed. */
export interface Note {
  id: string
  text: string
  color: NoteColor
  /** The `nid` of the line it belongs to. When no line has it any more, the note is loose. */
  anchor: string
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
  /** The day (YYYY-MM-DD) each set's round started, for the heading of the changed pages in the PDF. */
  dates?: Record<string, string>
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
  /** The scene it belongs to (its heading's nid); `scene` then follows that scene's number. */
  sid?: string
  /** The shot, for the shot list: size ("Plano médio"), angle ("Plongée"), movement ("Travelling") and lens in mm. */
  shot?: string
  angle?: string
  move?: string
  lens?: number
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
  | 'par'
  | 'ellipsoidal'
  | 'tube'
  | 'kino'
  | 'chinaball'
  | 'dedo'
  | 'skypanel'
  | 'moon'
  | 'overhead'
  | 'cookie'
  | 'haze'
  | 'generator'

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
  /** The other side of a table, in metres (its "largura"); the length is the long side. */
  depth?: number
  // ---- lights (technical sheet)
  /** Power in watts; 0 for light that needs no power (sun, moon). */
  watts?: number
  /** Colour temperature in kelvin, before the gel. */
  kelvin?: number
  /** Colour or neutral-density gel: "CTO", "1/2 CTB", "ND 0.6"... */
  gel?: string
  diffusion?: string
  /** Dimmer, 0 to 100 %. */
  intensity?: number
  role?: LightRole
  // ---- lights and cameras
  /** Height in metres. */
  height?: number
  // ---- cameras
  /** Focal length in mm; with it the field of view comes from the lens and the sensor. */
  lens?: number
  sensor?: SensorId
  /** Camera movement: "Travelling", "Câmera na mão"... */
  move?: string
  /** A movement that goes somewhere (travelling, dolly, steadicam...): where the camera ends, in metres on the map. */
  moveTo?: { x: number; y: number }
  /** The point the path goes through halfway (dragged to bend it), in metres; missing = a straight path. */
  moveVia?: { x: number; y: number }
  /** Where the camera points at the end (of a path or a pan), in degrees; missing = as at the start. */
  moveRot?: number
  /**
   * The points a camera (with a movement that goes somewhere) or an actor (its marks) goes through after where it stands,
   * in order: A → A2 → A3. Each has its place in metres, where it points (missing = as the point before) and the point
   * its stretch is bent through (missing = straight).
   */
  movePoints?: MoveStop[]
  /** A zoom: how far the field of view reaches at the end, in metres (the lens follows). */
  endRange?: number
  /** A pan: how far the camera turns, in degrees (positive = clockwise). */
  panAngle?: number
  /** Shot size: "Plano médio", "Close"... */
  shot?: string
}

export type LightRole = 'key' | 'fill' | 'back' | 'rim' | 'background' | 'practical' | 'ambient' | 'effect'
export type SensorId = 's35' | 'ff' | 'apsc' | 'mft' | 's16'


export interface LightMap {
  id: string
  name: string
  /** Scene number this diagram belongs to (free text). */
  scene: string
  /** The scene it belongs to (its heading's nid); `scene` then follows that scene's number. */
  sid?: string
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

export type WatermarkStrength = 'light' | 'medium' | 'strong'

/** Text printed faintly across every PDF page. The text is kept while it is off, so it can be turned back on. */
export interface Watermark {
  enabled: boolean
  text: string
  strength: WatermarkStrength
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
  watermark?: Watermark
  notes?: Note[]
  production?: Production
  tableRead?: TableRead
  /** The Som window: microphone plans, sound sheets, ambiences, music and equipment. */
  sound?: Sound
  /** The Luz window: a light sheet per scene, the place for the sun, the light equipment list. */
  lighting?: Lighting
}

/** A voice installed on the computer (its name) and a pitch, 1 = as it is. */
export interface VoiceRole {
  voice: string
  pitch: number
}

/** The voices of a table read: who reads the narration and each character, and how fast. Saved with the script. */
export interface TableRead {
  narrator?: VoiceRole
  /** By character name, as the cues write it (capitals, no extension). */
  cast: Record<string, VoiceRole>
  rate?: number
  /** Read the character names before their lines. */
  names?: boolean
}

/** What a scene needs on set, besides the cast (which comes from the script). */
export type BreakdownCategory =
  | 'extras'
  | 'stunts'
  | 'props'
  | 'wardrobe'
  | 'makeup'
  | 'vehicles'
  | 'animals'
  | 'sfx'
  | 'vfx'
  | 'set'
  | 'sound'
  | 'equipment'

/** One production element (a prop, a car, a costume...) and the scenes it appears in. */
export interface BreakdownItem {
  id: string
  category: BreakdownCategory
  name: string
  /** Scene ids (the nid of each scene heading). */
  scenes: string[]
}

export interface ShootDay {
  id: string
  /** Free text: a date, "Dia 3 - sábado"... Empty shows as "Dia N". */
  label: string
  notes: string
  /** Scene ids in shooting order. */
  scenes: string[]
  /** When each scene is shot that day ("08:30"), by scene id. Missing = no time yet. */
  times?: Record<string, string>
  /**
   * For a scene shot over more than one day: the storyboard frames (shots) of that scene shot on this day, by scene id.
   * Missing for a scene = the scene is shot whole on this day.
   */
  shots?: Record<string, string[]>
  /** When each shot is filmed that day ("09:00"): by scene id, then by storyboard frame id. */
  shotTimes?: Record<string, Record<string, string>>
  /** The calendar date of the day ("2026-11-20"), for the sun. */
  date?: string
  /** Where the day is shot, when not where the film is (Luz → Sol e horários). */
  place?: Place
}

export interface Production {
  items: BreakdownItem[]
  days: ShootDay[]
}

// ---------------------------------------------------------------- sound (the Som window)

export type MicType = 'cardioid' | 'supercardioid' | 'shotgun' | 'omni' | 'figure8' | 'lavalier' | 'recorder'

/** A microphone (or the recorder) on a sound plan. Position in metres from the top-left corner, 0° = up, clockwise. */
export interface Mic {
  id: string
  type: MicType
  x: number
  y: number
  rotation: number
  label: string
  model?: string
  /** Recorder channel, 1–16. */
  channel?: number
  wireless?: boolean
  /** Metres from the floor. */
  height?: number
  /** How far it picks up, in metres. */
  range?: number
  /** Who holds the boom (shotgun, supercardioid). */
  operator?: string
  /** A lavalier: the actor (light map item) it is clipped to; it is drawn where the actor is. */
  actorId?: string
}

/**
 * The microphones of a set: over a light map (`mapId`), drawn faint below them and never changed, or on a plan of
 * its own for a scene with no light map. `width`/`height`/`sid`/`scene` follow the light map while it exists.
 */
export interface SoundPlan {
  id: string
  mapId?: string
  sid?: string
  scene: string
  width: number
  height: number
  mics: Mic[]
  notes: string
}

export type Capture = 'direct' | 'adr' | 'playback' | 'mos'

/** The sound sheet of a scene. */
export interface SoundSheet {
  capture?: Capture
  /** Who speaks (character name, as the cues write it) and how they are miked. */
  voices: Record<string, 'lapela' | 'vara' | 'ambos'>
  risks: string[]
  otherRisk: string
  requests: string
  roomTone: boolean
  roomToneSeconds: number
  effects: string
  playback: string
  notes: string
}

/** Something to record at a location besides the dialogue. */
export interface Ambience {
  id: string
  /** The location as the plan groups scenes ("CINE ESTRELA - CABINE"). */
  location: string
  what: string
  duration: string
  notes: string
  recorded: boolean
}

export interface Song {
  id: string
  title: string
  author: string
  /** Scene ids. */
  scenes: string[]
  kind: 'diegetic' | 'score'
  /** "mm:ss". */
  duration: string
  rights: 'licensed' | 'pending' | 'original' | 'public'
  notes: string
}

/** A line of an equipment list typed by hand. */
export interface EquipItem {
  id: string
  name: string
  qty: number
  rental: string
  out: boolean
  back: boolean
  notes: string
}

/** What is written on a line that comes by itself (from the microphones on the plans), by its key. */
export interface EquipState {
  rental: string
  out: boolean
  back: boolean
  notes: string
}

export interface Sound {
  plans: SoundPlan[]
  /** By scene id. */
  sheets: Record<string, SoundSheet>
  ambiences: Ambience[]
  music: Song[]
  equipment: EquipItem[]
  equipState: Record<string, EquipState>
}

/** A place on Earth for the sun: a city of the list or typed coordinates, with its UTC offset in hours. */
export interface Place {
  name: string
  lat: number
  lon: number
  tz: number
}

/** The light of a scene: the why behind the light map. */
export interface LightSheet {
  quality?: 'hard' | 'soft'
  contrast?: 'high' | 'low'
  /** The overall colour, in words ("quente, âmbar"). */
  color: string
  /** Where the light of the story comes from (LIGHT_SOURCES). */
  sources: string[]
  otherSource: string
  /** Time of day in the story and continuity ("fim de tarde; continua da cena 4"). */
  story: string
  effects: string[]
  otherEffect: string
  /** Power and generator. */
  power: string
  /** Time to rig, in minutes. */
  setupMinutes?: number
  notes: string
}

export interface Lighting {
  /** By scene id. */
  sheets: Record<string, LightSheet>
  /** Where the film is shot, for the sun. */
  place?: Place
  equipment: EquipItem[]
  equipState: Record<string, EquipState>
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

/** One point of a movement or a blocking (see LightItem.movePoints). */
export interface MoveStop {
  x: number
  y: number
  rot?: number
  via?: { x: number; y: number }
}
