// Builds the "paint one wedge, watch it bloom" motif for Wallpaper Bloom
// mode: a center medallion plus nFold radial wedges, each tagged with a
// stable groupId. tileWallpaperGroup() (wallpaperGroups.js) then stamps this
// motif across the whole canvas under a real 17-group symmetry, carrying the
// groupId onto every transformed copy — so coloring one wedge and looking up
// its groupId is enough to recolor every symmetric copy of it at once.
import { TAU, deg } from './tessellate/math'
import { tileWallpaperGroup } from './tessellate/wallpaperGroups'

function wedgeMotif(r, nFold, innerR) {
  const items = []

  const corePts = []
  for (let i = 0; i < nFold * 2; i++) {
    const a = deg(90) + (TAU * i) / (nFold * 2)
    const rad = i % 2 === 0 ? innerR * 1.15 : innerR * 0.55
    corePts.push([Math.cos(a) * rad, Math.sin(a) * rad])
  }
  items.push({ verts: corePts, groupId: 'core' })

  for (let i = 0; i < nFold; i++) {
    const a0 = deg(90) + (TAU * i) / nFold
    const a1 = deg(90) + (TAU * (i + 1)) / nFold
    const am = (a0 + a1) / 2
    const p0 = [Math.cos(a0) * r, Math.sin(a0) * r]
    const pm = [Math.cos(am) * innerR, Math.sin(am) * innerR]
    const p1 = [Math.cos(a1) * r, Math.sin(a1) * r]
    items.push({ verts: [p0, pm, p1], groupId: `wedge-${i}` })
  }
  return items
}

export function buildBloomTiles(W, H, r, nFold, groupName, cellScale = 2.6) {
  const innerR = r * 0.42
  const motif = wedgeMotif(r, nFold, innerR)
  const cell = r * cellScale
  return tileWallpaperGroup(motif, groupName, W, H, cell)
}

export const BLOOM_GROUPS = ['p6m', 'p6', 'p4m', 'p4', 'p3m1', 'cmm']
