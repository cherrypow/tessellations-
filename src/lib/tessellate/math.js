export const PHI = (1 + Math.sqrt(5)) / 2
export const PHIR = 1 / PHI
export const TAU = Math.PI * 2

export function deg(d) {
  return (d * Math.PI) / 180
}

export function polygon(n, r, cx = 0, cy = 0, offset = 0) {
  const pts = []
  for (let i = 0; i < n; i++) {
    pts.push([cx + r * Math.cos(offset + (TAU * i) / n), cy + r * Math.sin(offset + (TAU * i) / n)])
  }
  return pts
}
