import { deg } from './math'

// ── Exact girih tile prototypes ──────────────────────────────────────────
// All five tiles share one edge length and interior angles that are multiples
// of 36°, which is what lets their decorating lines connect seamlessly across
// shared edges (Lu & Steinhardt, Science 315, 1106 (2007)).

function traceEquilateralPolygon(interiorAngles, edgeLen) {
  let heading = 0
  let pos = [0, 0]
  const pts = [pos]
  for (let i = 0; i < interiorAngles.length; i++) {
    const next = [pos[0] + edgeLen * Math.cos(heading), pos[1] + edgeLen * Math.sin(heading)]
    pts.push(next)
    pos = next
    heading += deg(180 - interiorAngles[i])
  }
  return pts.slice(0, -1)
}

export const TILE_TYPES = {
  decagon: { label: 'Decagon', angles: new Array(10).fill(144), defaultColor: '#7FC1E0' },
  pentagon: { label: 'Pentagon', angles: new Array(5).fill(108), defaultColor: '#3E7CA6' },
  hexagon: { label: 'Hexagon', angles: [72, 144, 144, 72, 144, 144], defaultColor: '#B7C4CE' },
  bowtie: { label: 'Bowtie', angles: [72, 72, 216, 72, 72, 216], defaultColor: '#1B3A5C' },
  rhombus: { label: 'Rhombus', angles: [72, 108, 72, 108], defaultColor: '#5B9BC7' },
}

export function tileShape(type, edgeLen) {
  return traceEquilateralPolygon(TILE_TYPES[type].angles, edgeLen)
}

// ── 7 preset ring-type seeds for the growth field, plus a manual "Custom"
// 8th option (handled separately in the UI via girihRingA/girihRingB) ─────
export const GIRIH_SEEDS = {
  'Classic Star': ['pentagon'],
  'Bowtie Weave': ['bowtie'],
  'Hex Lace': ['hexagon'],
  'Rhombus Field': ['rhombus'],
  'Alternating Duo': ['pentagon', 'bowtie'],
  'Triple Braid': ['pentagon', 'hexagon', 'rhombus'],
  'Full Mix': ['pentagon', 'bowtie', 'hexagon', 'rhombus'],
}
export const GIRIH_SEED_NAMES = Object.keys(GIRIH_SEEDS)

// ── Hankin's "polygons in contact" strapwork construction ───────────────
// At every edge midpoint, two decorating lines cross at 72°/108° to the edge;
// each leans toward one end of the edge and meets the matching line from the
// neighboring edge near the shared vertex, tracing a closed zigzag just
// inside the tile's boundary. Because the rule only depends on the shared
// edge (not which tile it belongs to), the lines run straight through when
// two tiles are placed edge-to-edge.
export function girihDecoration(verts, contactAngle = 72) {
  const n = verts.length
  const rot = ([x, y], a) => {
    const c = Math.cos(a), s = Math.sin(a)
    return [x * c - y * s, x * s + y * c]
  }
  const norm = ([x, y]) => {
    const l = Math.hypot(x, y) || 1
    return [x / l, y / l]
  }
  const mids = []
  const towardNext = []
  const towardPrev = []
  for (let i = 0; i < n; i++) {
    const a = verts[i]
    const b = verts[(i + 1) % n]
    mids.push([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2])
    const dir = norm([b[0] - a[0], b[1] - a[1]])
    towardNext.push(rot(dir, deg(contactAngle)))
    towardPrev.push(rot([-dir[0], -dir[1]], deg(-contactAngle)))
  }
  const rayIntersect = (p1, d1, p2, d2) => {
    const denom = d1[0] * d2[1] - d1[1] * d2[0]
    if (Math.abs(denom) < 1e-9) return null
    const t = ((p2[0] - p1[0]) * d2[1] - (p2[1] - p1[1]) * d2[0]) / denom
    return [p1[0] + d1[0] * t, p1[1] + d1[1] * t]
  }
  const corners = []
  for (let i = 0; i < n; i++) {
    const prevIdx = (i - 1 + n) % n
    const p = rayIntersect(mids[prevIdx], towardNext[prevIdx], mids[i], towardPrev[i])
    corners.push(p || verts[i])
  }
  const path = []
  for (let i = 0; i < n; i++) {
    path.push(mids[i])
    path.push(corners[(i + 1) % n])
  }
  return path
}

// ── Rigid attach: glue a tile's edge0 onto a target edge, outward-facing ──
// For a CCW host polygon edge (from -> to), the interior is on the left of
// (from -> to); mapping the new tile's local edge0 onto the *reversed*
// target edge flips its interior to the right, i.e. outside the host.
function attachEdge(localVerts, targetFrom, targetTo) {
  const A0 = localVerts[0]
  const A1 = localVerts[1]
  const localDir = Math.atan2(A1[1] - A0[1], A1[0] - A0[0])
  const targetDir = Math.atan2(targetFrom[1] - targetTo[1], targetFrom[0] - targetTo[0])
  const theta = targetDir - localDir
  const c = Math.cos(theta), s = Math.sin(theta)
  const rotate = ([x, y]) => [x * c - y * s, x * s + y * c]
  const A0rot = rotate(A0)
  const tx = targetTo[0] - A0rot[0]
  const ty = targetTo[1] - A0rot[1]
  return localVerts.map((p) => {
    const r = rotate(p)
    return [r[0] + tx, r[1] + ty]
  })
}

function makeTile(type, verts) {
  return { type, verts, decoration: girihDecoration(verts) }
}

// ── One rosette: a central decagon with a ring of edge-matched tiles ─────
export function buildRosette(edgeLen, ringTypes, cx = 0, cy = 0, rotation = 0) {
  const decagonLocal = tileShape('decagon', edgeLen)
  const decagonVerts = decagonLocal.map(([x, y]) => {
    const c = Math.cos(rotation), s = Math.sin(rotation)
    return [x * c - y * s + cx, x * s + y * c + cy]
  })
  const tiles = [makeTile('decagon', decagonVerts)]
  const seq = ringTypes.length ? ringTypes : ['pentagon']
  for (let i = 0; i < 10; i++) {
    const type = seq[i % seq.length]
    const from = decagonVerts[i]
    const to = decagonVerts[(i + 1) % 10]
    const local = tileShape(type, edgeLen)
    const verts = attachEdge(local, from, to)
    tiles.push(makeTile(type, verts))
  }
  return tiles
}

// ── Odd-row-offset hex neighbor table ────────────────────────────────────
// Matches the `offset = mod2(row) * colW * 0.5` stagger below: each cell has
// 6 neighbors, 2 in the same row and 4 split across the rows above/below,
// which side depends on row parity.
function mod2(n) {
  return ((n % 2) + 2) % 2
}
function hexOffsetNeighbors(col, row) {
  const odd = mod2(row) === 1
  return odd
    ? [
        [col - 1, row], [col + 1, row],
        [col, row - 1], [col + 1, row - 1],
        [col, row + 1], [col + 1, row + 1],
      ]
    : [
        [col - 1, row], [col + 1, row],
        [col - 1, row - 1], [col, row - 1],
        [col - 1, row + 1], [col, row + 1],
      ]
}

// Enough BFS rings to cover a W×H canvas at tile radius r — shared by
// buildGirihField's default and the UI's growth-dial max, so the two never
// drift out of sync.
export function defaultGirihGrowthRings(W, H, r) {
  const colW = r * 2 * (1 + Math.cos(deg(36)))
  const rowH = r * 2 * Math.sin(deg(72))
  const cols = Math.floor(W / colW) + 3
  const rows = Math.floor(H / rowH) + 3
  return Math.max(cols, rows)
}

// ── Tile a canvas with rosettes grown outward from the center, ring by ring
// (BFS over the hex-offset neighbor graph) ───────────────────────────────
// `growthRings` caps how many rings out from the center rosette are placed —
// this is the "dial." Left undefined, it defaults to enough rings to cover
// the whole W×H canvas, i.e. identical coverage to the old fixed full-grid
// version of this function.
export function buildGirihField(W, H, r, ringTypes, growthRings) {
  const edgeLen = 2 * r * Math.sin(deg(18))
  const colW = r * 2 * (1 + Math.cos(deg(36)))
  const rowH = r * 2 * Math.sin(deg(72))
  const maxRing = growthRings ?? defaultGirihGrowthRings(W, H, r)

  function cellCenter(col, row) {
    const offset = mod2(row) * colW * 0.5
    return [W / 2 + col * colW + offset, H / 2 + row * rowH]
  }

  const depthOf = new Map()
  depthOf.set('0,0', 0)
  const queue = [[0, 0, 0]]
  for (let qi = 0; qi < queue.length; qi++) {
    const [col, row, depth] = queue[qi]
    if (depth >= maxRing) continue
    for (const [nc, nr] of hexOffsetNeighbors(col, row)) {
      const key = `${nc},${nr}`
      if (!depthOf.has(key)) {
        depthOf.set(key, depth + 1)
        queue.push([nc, nr, depth + 1])
      }
    }
  }

  const tiles = []
  for (const [key] of depthOf) {
    const [col, row] = key.split(',').map(Number)
    const [cx, cy] = cellCenter(col, row)
    tiles.push(...buildRosette(edgeLen, ringTypes, cx, cy, deg(90)))
  }
  return tiles
}
