// Hexaflake: a hexagon replaced by 7 copies of itself at 1/3 scale (one
// center, six around), recursed. Only leaves are emitted as tiles — a parent
// hex's footprint is exactly covered by its own children, so drawing both
// would double-color the same area.
//
// hexPoints() puts vertices at i*60°, so edge midpoints sit at i*60°+30° —
// satellite centers have to go there (not at the vertex angles) for the six
// child hexagons to actually meet edge-to-edge with zero gap or overlap.
//
// Each leaf also carries a `box` id: the path of its immediate parent
// (root-to-leaf branch indices, minus the leaf's own last index). All 7
// leaves under one parent share a box id — that's the Sudoku-style
// constraint group Flake Wars enforces (each box must end up with 7
// distinct values). It falls straight out of the recursion, not bolted on.
import { TAU } from './tessellate/math'

function hexPoints(cx, cy, r) {
  const pts = []
  for (let i = 0; i < 6; i++) {
    const a = (TAU * i) / 6
    pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)])
  }
  return pts
}

function subtree(cx, cy, r, depth, path, tiles) {
  if (depth <= 0) {
    tiles.push({ verts: hexPoints(cx, cy, r), box: path.slice(0, -1).join('.') })
    return
  }
  const childR = r / 3
  const dist = childR * Math.sqrt(3)
  subtree(cx, cy, childR, depth - 1, [...path, 0], tiles)
  for (let i = 0; i < 6; i++) {
    const a = (TAU * i) / 6 + Math.PI / 6
    subtree(cx + dist * Math.cos(a), cy + dist * Math.sin(a), childR, depth - 1, [...path, i + 1], tiles)
  }
}

export function buildHexaflake(cx, cy, r, depth) {
  const tiles = []
  subtree(cx, cy, r, Math.max(1, depth), [], tiles)
  return tiles
}

// Grows the board OUTWARD instead of recursing deeper: still 7-cell flowers
// at the same size (leaf radius stays r/9, matching depth-2's own first
// split), just more of them, arranged as real hex-grid rings of FLOWERS
// (each flower treated as one cell in a coarser hex lattice) so they nestle
// against multiple neighbors instead of dangling off a single point.
//
// Ring 1 (the original 6 outer flowers) sit at distance `dist` from center,
// at the 6 angles offset 30° from a flower's own vertex angles (same logic
// as the leaf-level satellites above). Ring 2 has two families of
// positions, same as any hex grid: the 6 "straight" spots continuing
// straight out from center through a ring-1 flower (distance 2*dist, same
// angle — only touches that one ring-1 flower, hence the gappy look), and
// the 6 "corner" spots that sit BETWEEN two ring-1 flowers instead
// (distance dist*sqrt(3), at the angle bisecting the two neighbors it
// touches). The corner spots are what actually nestle — verified by
// touching-leaf-pair count: 1 for a straight spot, 2 for a corner spot.
export function buildHexaflakeRing(cx, cy, r, ringCount) {
  const tiles = []
  const childR = r / 3
  const dist = childR * Math.sqrt(3)
  let boxId = 0
  function placeFlower(bx, by) {
    subtree(bx, by, childR, 1, [boxId++], tiles)
  }
  placeFlower(cx, cy)
  if (ringCount < 1) return tiles
  for (let i = 0; i < 6; i++) {
    const a = (TAU * i) / 6 + Math.PI / 6
    placeFlower(cx + dist * Math.cos(a), cy + dist * Math.sin(a))
  }
  if (ringCount < 2) return tiles
  // ring 2's 6 corner spots — nestled between consecutive ring-1 flowers
  const dist2 = dist * Math.sqrt(3)
  for (let i = 0; i < 6; i++) {
    const a = (TAU * i) / 6 + Math.PI / 6 + Math.PI / 6
    placeFlower(cx + dist2 * Math.cos(a), cy + dist2 * Math.sin(a))
  }
  return tiles
}

// Geometric neighbor graph between leaf hexagons — same-size regular hexagons
// touch edge-to-edge iff their centers sit exactly leafR*sqrt(3) apart. This
// naturally only ever links cells that could hold the SAME value: same-box
// siblings are geometrically adjacent too, but the Sudoku box constraint
// already forbids them sharing a value, so nothing extra needs filtering —
// a same-value match found via this graph is always a cross-box link.
function centroidOf(verts) {
  let x = 0, y = 0
  for (const [px, py] of verts) { x += px; y += py }
  return [x / verts.length, y / verts.length]
}

export function buildAdjacency(tiles) {
  const centers = tiles.map((t) => centroidOf(t.verts))
  const leafR = Math.hypot(tiles[0].verts[0][0] - centers[0][0], tiles[0].verts[0][1] - centers[0][1])
  const threshold = leafR * Math.sqrt(3)
  const adj = tiles.map(() => [])
  for (let i = 0; i < tiles.length; i++) {
    for (let j = i + 1; j < tiles.length; j++) {
      const d = Math.hypot(centers[i][0] - centers[j][0], centers[i][1] - centers[j][1])
      if (Math.abs(d - threshold) < threshold * 0.03) {
        adj[i].push(j)
        adj[j].push(i)
      }
    }
  }
  return adj
}
