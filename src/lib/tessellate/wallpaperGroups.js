// General 17-wallpaper-group replicator: takes a motif (array of polygons, each
// an array of [x,y] points in a unit cell roughly [0,1]x[0,1]) and a group name,
// and returns every symmetric copy of that motif whose lattice cell overlaps a
// given viewport. One engine, reused by any pattern generator in the app.

function I() {
  return [
    [1, 0],
    [0, 1],
  ]
}
function rotMat(deg) {
  const a = (deg * Math.PI) / 180
  const c = Math.cos(a), s = Math.sin(a)
  return [
    [c, -s],
    [s, c],
  ]
}
// reflection about a line through the origin at angle `deg`
function reflMat(deg) {
  const a = (2 * deg * Math.PI) / 180
  const c = Math.cos(a), s = Math.sin(a)
  return [
    [c, s],
    [s, -c],
  ]
}
function applyMat(M, [x, y]) {
  return [M[0][0] * x + M[0][1] * y, M[1][0] * x + M[1][1] * y]
}

// Each op: { M: 2x2 matrix, glide: [gx, gy] fractional lattice offset (optional) }
export const WALLPAPER_GROUPS = {
  p1: { lattice: 'oblique', centered: false, ops: [{ M: I() }] },
  p2: { lattice: 'oblique', centered: false, ops: [{ M: I() }, { M: rotMat(180) }] },
  pm: { lattice: 'rect', centered: false, ops: [{ M: I() }, { M: reflMat(0) }] },
  pg: {
    lattice: 'rect',
    centered: false,
    ops: [{ M: I() }, { M: reflMat(0), glide: [0.5, 0] }],
  },
  cm: { lattice: 'rect', centered: true, ops: [{ M: I() }, { M: reflMat(0) }] },
  pmm: {
    lattice: 'rect',
    centered: false,
    ops: [{ M: I() }, { M: reflMat(0) }, { M: reflMat(90) }, { M: rotMat(180) }],
  },
  pmg: {
    lattice: 'rect',
    centered: false,
    ops: [
      { M: I() },
      { M: rotMat(180) },
      { M: reflMat(90) },
      { M: reflMat(0), glide: [0.5, 0] },
    ],
  },
  pgg: {
    lattice: 'rect',
    centered: false,
    ops: [
      { M: I() },
      { M: rotMat(180) },
      { M: reflMat(0), glide: [0.5, 0.5] },
      { M: reflMat(90), glide: [0.5, 0.5] },
    ],
  },
  cmm: {
    lattice: 'rect',
    centered: true,
    ops: [{ M: I() }, { M: reflMat(0) }, { M: reflMat(90) }, { M: rotMat(180) }],
  },
  p4: {
    lattice: 'square',
    centered: false,
    ops: [{ M: I() }, { M: rotMat(90) }, { M: rotMat(180) }, { M: rotMat(270) }],
  },
  p4m: {
    lattice: 'square',
    centered: false,
    ops: [
      { M: I() }, { M: rotMat(90) }, { M: rotMat(180) }, { M: rotMat(270) },
      { M: reflMat(0) }, { M: reflMat(45) }, { M: reflMat(90) }, { M: reflMat(135) },
    ],
  },
  p4g: {
    lattice: 'square',
    centered: false,
    ops: [
      { M: I() }, { M: rotMat(90) }, { M: rotMat(180) }, { M: rotMat(270) },
      { M: reflMat(45) }, { M: reflMat(135) },
      { M: reflMat(0), glide: [0.5, 0.5] }, { M: reflMat(90), glide: [0.5, 0.5] },
    ],
  },
  p3: {
    lattice: 'hex',
    centered: false,
    ops: [{ M: I() }, { M: rotMat(120) }, { M: rotMat(240) }],
  },
  p3m1: {
    lattice: 'hex',
    centered: false,
    ops: [
      { M: I() }, { M: rotMat(120) }, { M: rotMat(240) },
      { M: reflMat(0) }, { M: reflMat(120) }, { M: reflMat(240) },
    ],
  },
  p31m: {
    lattice: 'hex',
    centered: false,
    ops: [
      { M: I() }, { M: rotMat(120) }, { M: rotMat(240) },
      { M: reflMat(30) }, { M: reflMat(150) }, { M: reflMat(270) },
    ],
  },
  p6: {
    lattice: 'hex',
    centered: false,
    ops: [
      { M: I() }, { M: rotMat(60) }, { M: rotMat(120) },
      { M: rotMat(180) }, { M: rotMat(240) }, { M: rotMat(300) },
    ],
  },
  p6m: {
    lattice: 'hex',
    centered: false,
    ops: [
      { M: I() }, { M: rotMat(60) }, { M: rotMat(120) },
      { M: rotMat(180) }, { M: rotMat(240) }, { M: rotMat(300) },
      { M: reflMat(0) }, { M: reflMat(30) }, { M: reflMat(60) },
      { M: reflMat(90) }, { M: reflMat(120) }, { M: reflMat(150) },
    ],
  },
}

function latticeBasis(type, cell, angleDeg) {
  if (type === 'square') return [[cell, 0], [0, cell]]
  if (type === 'hex') {
    const a = (60 * Math.PI) / 180
    return [[cell, 0], [cell * Math.cos(a), cell * Math.sin(a)]]
  }
  if (type === 'rect') return [[cell, 0], [0, cell * 1.4]]
  // oblique
  const a = (angleDeg * Math.PI) / 180
  return [[cell, 0], [cell * Math.cos(a), cell * Math.sin(a)]]
}

// motifItems: array of { verts: [[x,y],...], ...meta } already in absolute/world
// coordinates (not rescaled here — the caller controls the motif's own size).
// `cell` only controls the lattice translation spacing. Returns instances of
// each item, transformed, with their metadata preserved, covering [0,W]x[0,H].
export function tileWallpaperGroup(motifItems, groupName, W, H, cell, obliqueAngle = 80) {
  const group = WALLPAPER_GROUPS[groupName]
  if (!group) return []
  const [e1, e2] = latticeBasis(group.lattice, cell, obliqueAngle)
  const centerings = group.centered ? [[0, 0], [0.5, 0.5]] : [[0, 0]]

  const pad = cell * 2
  const cx = W / 2, cy = H / 2
  const range = Math.ceil((Math.max(W, H) / 2 + pad) / cell) + 2

  const out = []
  for (let m = -range; m <= range; m++) {
    for (let n = -range; n <= range; n++) {
      for (const [ox, oy] of centerings) {
        const lx = (m + ox) * e1[0] + (n + oy) * e2[0]
        const ly = (m + ox) * e1[1] + (n + oy) * e2[1]
        for (const op of group.ops) {
          const gx = (op.glide?.[0] ?? 0) * e1[0] + (op.glide?.[1] ?? 0) * e2[0]
          const gy = (op.glide?.[0] ?? 0) * e1[1] + (op.glide?.[1] ?? 0) * e2[1]
          const tx = cx + lx + gx
          const ty = cy + ly + gy
          for (const item of motifItems) {
            if (item.img) {
              // Image motifs can't have their pixels transformed like a
              // polygon's points — instead we transform the image's local
              // offset point (e.g. how far it's pushed off its own rotation
              // center) by the same matrix, and pass the op matrix through
              // so the renderer can apply it as a canvas transform right
              // before drawImage().
              const [ox, oy] = item.offsetPt ?? [0, 0]
              const [rx, ry] = applyMat(op.M, [ox, oy])
              out.push({ ...item, M: op.M, tx: tx + rx, ty: ty + ry })
            } else {
              const verts = item.verts.map((p) => {
                const [rx, ry] = applyMat(op.M, p)
                return [rx + tx, ry + ty]
              })
              out.push({ ...item, verts })
            }
          }
        }
      }
    }
  }
  return out
}

export const WALLPAPER_GROUP_NAMES = Object.keys(WALLPAPER_GROUPS)
