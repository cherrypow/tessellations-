// A single Penrose "sun" — 10 Robinson triangles fanned around a center point,
// then deflated `depth` times. Ported from designworks' patterns.js
// (penroseTiles/deflate), but built as one self-contained, boundary-clean
// rosette instead of a grid of them — the same shift buildRosette makes for
// girih (one closed motif instead of an unbounded field), so it reads as a
// puzzle with a finite tile count rather than an infinite canvas.
//
// Fixed a real bug found while verifying this: the original seed alternated
// kind:'thick'/'thin' by wedge index, but every wedge here is geometrically
// the same golden triangle (apex at center, two equal radius-length legs,
// 36° apex angle) — labeling half of them 'thin' fed them through the wrong
// deflate() branch and produced degenerate (zero-area) triangles. All 10
// seed wedges are 'thick'; only the B/C winding still alternates.
//
// That fix makes depth=1 clean (verified: 20 tiles, zero overlap). Deeper
// levels still show real cross-wedge overlap — getting a decagonal Penrose
// "sun" vertex fully self-consistent past one deflation needs the actual
// vertex-matching rules, not this fan-of-golden-triangles approximation.
// Capped at depth=1 until that's solved properly.
import { PHIR, deg } from './tessellate/math'

function vLerpTo(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]
}

function deflate(tris) {
  const out = []
  for (const t of tris) {
    const { A, B, C } = t
    if (t.kind === 'thick') {
      const P = vLerpTo(A, B, PHIR)
      out.push({ kind: 'thick', A: C, B: P, C: B }, { kind: 'thin', A: P, B: C, C: A })
    } else {
      const Q = vLerpTo(B, A, PHIR)
      out.push({ kind: 'thick', A: Q, B: A, C: B }, { kind: 'thin', A: A, B: Q, C })
    }
  }
  return out
}

export const MAX_SAFE_DEPTH = 1

export function buildPenroseSun(cx, cy, r, depth) {
  const d = Math.min(depth, MAX_SAFE_DEPTH)
  let tris = []
  for (let k = 0; k < 10; k++) {
    const a0 = deg(90) + k * deg(36)
    const a1 = deg(90) + (k + 1) * deg(36)
    const A = [cx, cy]
    const B = [cx + r * Math.cos(a0), cy + r * Math.sin(a0)]
    const C = [cx + r * Math.cos(a1), cy + r * Math.sin(a1)]
    tris.push(k % 2 === 0 ? { kind: 'thick', A, B, C } : { kind: 'thick', A, B: C, C: B })
  }
  for (let i = 0; i < d; i++) tris = deflate(tris)
  return tris.map((t) => ({ verts: [t.A, t.B, t.C], kind: t.kind }))
}
