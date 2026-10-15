import type { Frame, Paper, Storyboard, StoryboardAspect, StoryboardLayout } from './types'
import { PAPER } from './paginate'

export const ASPECTS: { id: StoryboardAspect; label: string; ratio: number }[] = [
  { id: '16:9', label: '16:9 (padrão)', ratio: 16 / 9 },
  { id: '2.39:1', label: '2,39:1 (cinemascope)', ratio: 2.39 },
  { id: '4:3', label: '4:3', ratio: 4 / 3 },
  { id: '1:1', label: '1:1', ratio: 1 },
  { id: '9:16', label: '9:16 (vertical)', ratio: 9 / 16 }
]

export const LAYOUTS: { id: StoryboardLayout; label: string; cols: number; rows: number }[] = [
  { id: 2, label: '2 por página', cols: 1, rows: 2 },
  { id: 4, label: '4 por página', cols: 2, rows: 2 },
  { id: 6, label: '6 por página', cols: 2, rows: 3 },
  { id: 9, label: '9 por página', cols: 3, rows: 3 }
]

export function aspectRatio(a: StoryboardAspect): number {
  return ASPECTS.find((x) => x.id === a)?.ratio ?? 16 / 9
}

/** Printed page, in inches. */
export const SB_PAGE = { width: 8.5, height: 11, left: 0.75, right: 0.75, top: 0.95, bottom: 0.75, gap: 0.25 }

export interface Cell {
  /** Index in `frames`. */
  index: number
  /** Cell box (frame area plus caption) in inches from the page corner. */
  x: number
  y: number
  w: number
  h: number
  /** Picture box inside the cell. */
  fx: number
  fy: number
  fw: number
  fh: number
  /** Where the caption starts, below the picture box. */
  captionY: number
  captionH: number
}

export interface SbPage {
  number: number
  cells: Cell[]
}

export function storyboardPages(sb: Pick<Storyboard, 'frames' | 'aspect' | 'layout'>, paper: Paper = 'letter'): SbPage[] {
  const lay = LAYOUTS.find((l) => l.id === sb.layout) ?? LAYOUTS[2]
  const ratio = aspectRatio(sb.aspect)
  const usableW = PAPER[paper].width - SB_PAGE.left - SB_PAGE.right
  const usableH = PAPER[paper].height - SB_PAGE.top - SB_PAGE.bottom
  const cellW = (usableW - (lay.cols - 1) * SB_PAGE.gap) / lay.cols
  const cellH = (usableH - (lay.rows - 1) * SB_PAGE.gap) / lay.rows
  const captionH = lay.cols === 3 ? 0.62 : 0.85
  const availH = cellH - captionH
  const fw = Math.min(cellW, availH * ratio)
  const fh = fw / ratio
  // Rows only take the height their content needs, so wide frames do not leave big empty bands.
  const rowH = Math.min(cellH, fh + captionH)
  const per = lay.cols * lay.rows

  const pages: SbPage[] = []
  for (let i = 0; i < sb.frames.length; i += per) {
    const cells: Cell[] = []
    for (let k = 0; k < per && i + k < sb.frames.length; k++) {
      const col = k % lay.cols
      const row = Math.floor(k / lay.cols)
      const x = SB_PAGE.left + col * (cellW + SB_PAGE.gap)
      const y = SB_PAGE.top + row * (rowH + SB_PAGE.gap)
      cells.push({
        index: i + k,
        x,
        y,
        w: cellW,
        h: rowH,
        fx: x + (cellW - fw) / 2,
        fy: y,
        fw,
        fh,
        captionY: y + fh + 0.08,
        captionH: rowH - fh - 0.08
      })
    }
    pages.push({ number: pages.length + 1, cells })
  }
  return pages
}

const IMAGE_URL = /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/
export const MAX_IMAGE_CHARS = 14 * 1024 * 1024

export function isSafeImage(url: string): boolean {
  return url === '' || (url.length <= MAX_IMAGE_CHARS && IMAGE_URL.test(url))
}

export function cleanFrame(f: Partial<Frame>): Frame | null {
  if (!f || typeof f !== 'object') return null
  const image = typeof f.image === 'string' ? f.image : ''
  if (!isSafeImage(image)) return null
  return {
    id: typeof f.id === 'string' && f.id ? f.id : `frame-${Math.random().toString(36).slice(2, 10)}`,
    image,
    caption: typeof f.caption === 'string' ? f.caption.slice(0, 2000) : '',
    scene: typeof f.scene === 'string' ? f.scene.slice(0, 40) : ''
  }
}

/**
 * Gives a frame its scene and moves it next to that scene: right after the scene's last frame, or, when the
 * scene has no frames yet, after the frames of the closest earlier scene (`order` is the script's scene order).
 * Returns the new list and where the frame ended up.
 */
export function placeInScene(frames: Frame[], id: string, scene: string, order: string[]): { frames: Frame[]; index: number } {
  const from = frames.findIndex((f) => f.id === id)
  if (from < 0) return { frames, index: -1 }
  const moved = { ...frames[from], scene }
  const rest = frames.filter((f) => f.id !== id)
  const lastOf = (match: (s: string) => boolean): number => {
    for (let i = rest.length - 1; i >= 0; i--) if (match(rest[i].scene)) return i
    return -1
  }
  let at = lastOf((s) => s === scene) + 1
  if (at === 0) {
    const rank = order.indexOf(scene)
    if (rank >= 0) {
      at = lastOf((s) => order.indexOf(s) >= 0 && order.indexOf(s) < rank) + 1
      if (at === 0) at = rest.findIndex((f) => order.indexOf(f.scene) > rank)
    } else at = -1
  }
  if (at < 0) return { frames: frames.map((f) => (f.id === id ? moved : f)), index: from }
  rest.splice(at, 0, moved)
  return { frames: rest, index: at }
}

/** Approximate size of the stored pictures, in megabytes. */
export function storyboardMegabytes(frames: Frame[]): number {
  return frames.reduce((n, f) => n + (f.image.length * 3) / 4, 0) / (1024 * 1024)
}
