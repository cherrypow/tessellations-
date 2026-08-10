// Draws tiles onto a 2D canvas context. Assumes ctx is already scaled/cleared as needed by the caller.
// A tile is either a filled/stroked polygon ({verts, color, stroke, layer})
// or an image motif ({img, w, h, M, tx, ty, layer}) — the latter carries the
// real pixels of an uploaded cutout instead of a flat vector fill.
export function renderTiles(ctx, tiles, cfg, W, H) {
  ctx.fillStyle = cfg.bgColor
  ctx.fillRect(0, 0, W, H)

  const margin = 60
  const sorted = [...tiles].sort((a, b) => a.layer - b.layer)

  for (const t of sorted) {
    if (t.img) {
      const reach = Math.max(t.w, t.h)
      if (t.tx < -reach || t.tx > W + reach || t.ty < -reach || t.ty > H + reach) continue
      ctx.save()
      ctx.globalAlpha = t.opacity ?? 1
      ctx.translate(t.tx, t.ty)
      ctx.transform(t.M[0][0], t.M[1][0], t.M[0][1], t.M[1][1], 0, 0)
      ctx.drawImage(t.img, -t.w / 2, -t.h / 2, t.w, t.h)
      ctx.restore()
      continue
    }

    const xs = t.verts.map((v) => v[0])
    const ys = t.verts.map((v) => v[1])
    if (Math.max(...xs) < -margin || Math.min(...xs) > W + margin || Math.max(...ys) < -margin || Math.min(...ys) > H + margin) continue
    if (t.verts.length < 3) continue

    ctx.beginPath()
    ctx.moveTo(t.verts[0][0], t.verts[0][1])
    for (let i = 1; i < t.verts.length; i++) ctx.lineTo(t.verts[i][0], t.verts[i][1])
    ctx.closePath()

    ctx.globalAlpha = t.opacity ?? 1
    if (t.color) {
      ctx.fillStyle = t.color
      ctx.fill()
    }
    if (t.stroke) {
      ctx.strokeStyle = t.stroke
      ctx.lineWidth = Math.max(cfg.edgeWidth, 1.25)
      ctx.stroke()
    } else if (cfg.edgeWidth > 0) {
      ctx.strokeStyle = cfg.edgeColor
      ctx.lineWidth = cfg.edgeWidth
      ctx.stroke()
    }
    ctx.globalAlpha = 1
  }
}

export function buildSvg(tiles, cfg, W, H) {
  const lines = [
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`,
    `<!-- TESSELLATE export: ${cfg.pattern} seed=${cfg.seed} -->`,
    `<rect width="${W}" height="${H}" fill="${cfg.bgColor}"/>`,
  ]
  const sorted = [...tiles].sort((a, b) => a.layer - b.layer)

  // Image motifs reuse one <defs> entry per source image, referenced via
  // <use>, so the base64 data isn't duplicated for every tiled instance.
  const imageIds = new Map()
  for (const t of sorted) {
    if (t.img && !imageIds.has(t.img.src)) imageIds.set(t.img.src, `img${imageIds.size}`)
  }
  if (imageIds.size > 0) {
    lines.push('<defs>')
    for (const [src, id] of imageIds) {
      lines.push(`<image id="${id}" href="${src}" width="1" height="1" preserveAspectRatio="none"/>`)
    }
    lines.push('</defs>')
  }

  for (const t of sorted) {
    const opacityAttr = t.opacity != null && t.opacity < 1 ? ` opacity="${t.opacity.toFixed(3)}"` : ''
    if (t.img) {
      const id = imageIds.get(t.img.src)
      const m00 = t.M[0][0], m01 = t.M[0][1], m10 = t.M[1][0], m11 = t.M[1][1]
      const transform =
        `matrix(${m00.toFixed(4)},${m10.toFixed(4)},${m01.toFixed(4)},${m11.toFixed(4)},${t.tx.toFixed(2)},${t.ty.toFixed(2)}) ` +
        `translate(${(-t.w / 2).toFixed(2)},${(-t.h / 2).toFixed(2)}) scale(${t.w.toFixed(2)},${t.h.toFixed(2)})`
      lines.push(`<use href="#${id}" transform="${transform}"${opacityAttr}/>`)
      continue
    }
    const pts = t.verts.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' ')
    const fill = t.color || 'none'
    const strokeColor = t.stroke || (cfg.edgeWidth > 0 ? cfg.edgeColor : null)
    const strokeWidth = t.stroke ? Math.max(cfg.edgeWidth, 1.25) : cfg.edgeWidth
    const stroke = strokeColor ? `stroke="${strokeColor}" stroke-width="${strokeWidth.toFixed(2)}"` : 'stroke="none"'
    lines.push(`<polygon points="${pts}" fill="${fill}" ${stroke}${opacityAttr}/>`)
  }
  lines.push('</svg>')
  return lines.join('\n')
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
