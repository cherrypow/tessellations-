import { PHIR } from './math'

export function hexToHsv(hex) {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16) / 255
  const g = parseInt(h.slice(2, 4), 16) / 255
  const b = parseInt(h.slice(4, 6), 16) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const d = max - min
  let hue = 0
  if (d !== 0) {
    if (max === r) hue = ((g - b) / d) % 6
    else if (max === g) hue = (b - r) / d + 2
    else hue = (r - g) / d + 4
    hue /= 6
    if (hue < 0) hue += 1
  }
  const sat = max === 0 ? 0 : d / max
  return [hue, sat, max]
}

export function hsvToHex(hue, sat, val) {
  const h = ((hue % 1) + 1) % 1
  const s = Math.max(0, Math.min(1, sat))
  const v = Math.max(0, Math.min(1, val))
  const i = Math.floor(h * 6)
  const f = h * 6 - i
  const p = v * (1 - s)
  const q = v * (1 - f * s)
  const t = v * (1 - (1 - f) * s)
  let r, g, b
  switch (i % 6) {
    case 0: [r, g, b] = [v, t, p]; break
    case 1: [r, g, b] = [q, v, p]; break
    case 2: [r, g, b] = [p, v, t]; break
    case 3: [r, g, b] = [p, q, v]; break
    case 4: [r, g, b] = [t, p, v]; break
    default: [r, g, b] = [v, p, q]; break
  }
  const to255 = (x) => Math.round(x * 255).toString(16).padStart(2, '0')
  return `#${to255(r)}${to255(g)}${to255(b)}`
}

export function generatePalette(baseHex, mode, nColors = 5) {
  const [h, s, v] = hexToHsv(baseHex)
  const palettes = {
    complementary: [h, h + 0.5],
    triadic: [h, h + 1 / 3, h + 2 / 3],
    analogous: [h - 0.1, h - 0.05, h, h + 0.05, h + 0.1],
    'split-comp': [h, h + 5 / 12, h + 7 / 12],
    tetradic: [h, h + 0.25, h + 0.5, h + 0.75],
    monochromatic: [h, h, h, h, h],
    golden: [0, 1, 2, 3, 4].map((i) => h + i * PHIR),
  }
  const angles = (palettes[mode] || [h, h + 0.5]).slice(0, nColors)
  const result = angles.map((angle, i) => {
    const sv = v * (0.7 + 0.3 * (i % 2))
    const ss = s * (0.6 + 0.4 * ((i + 1) % 2))
    return hsvToHex(angle, ss, sv)
  })
  while (result.length < nColors) result.push(result[result.length - 1])
  return result
}

export function darken(hexC, amount = 0.3) {
  const [h, s, v] = hexToHsv(hexC)
  return hsvToHex(h, s, v * (1 - amount))
}

export function lighten(hexC, amount = 0.3) {
  const [h, s, v] = hexToHsv(hexC)
  return hsvToHex(h, s * 0.8, Math.min(1, v * (1 + amount * 2)))
}

export function isValidHex(v) {
  return /^#[0-9a-fA-F]{6}$/.test(v)
}
