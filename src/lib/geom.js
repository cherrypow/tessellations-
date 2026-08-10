// Ray-casting point-in-polygon test, used for tap/click hit-testing against
// tile vertex lists produced by the tessellate engine.
export function pointInPolygon([px, py], verts) {
  let inside = false
  for (let i = 0, j = verts.length - 1; i < verts.length; j = i++) {
    const [xi, yi] = verts[i]
    const [xj, yj] = verts[j]
    const intersects = yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi
    if (intersects) inside = !inside
  }
  return inside
}
