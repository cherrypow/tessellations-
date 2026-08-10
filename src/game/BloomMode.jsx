import { useEffect, useMemo, useRef, useState } from 'react'
import { buildBloomTiles, BLOOM_GROUPS } from '../lib/bloomMotif'
import { generatePalette } from '../lib/tessellate/color'
import { pointInPolygon } from '../lib/geom'
import PaletteBar from './PaletteBar'

const GROUND = '#12131c'
const UNPAINTED = '#1c1e28'
const HAIRLINE = 'rgba(203,162,74,0.35)'

export default function BloomMode() {
  const canvasRef = useRef(null)
  const containerRef = useRef(null)
  const [size, setSize] = useState({ w: 600, h: 600 })
  const [groupName, setGroupName] = useState('p6m')
  const [colors] = useState(() => generatePalette('#3E6FA6', 'triadic', 5).concat(['#cba24a']))
  const [activeColor, setActiveColor] = useState(0)
  const [fills, setFills] = useState({})

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect
      setSize({ w: Math.max(1, Math.round(width)), h: Math.max(1, Math.round(height)) })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const r = Math.max(26, Math.min(size.w, size.h) / 6.5)
  const tiles = useMemo(
    () => buildBloomTiles(size.w, size.h, r, 6, groupName),
    [size.w, size.h, r, groupName],
  )

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    canvas.width = size.w * dpr
    canvas.height = size.h * dpr
    canvas.style.width = size.w + 'px'
    canvas.style.height = size.h + 'px'
    const ctx = canvas.getContext('2d')
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    ctx.fillStyle = GROUND
    ctx.fillRect(0, 0, size.w, size.h)

    for (const t of tiles) {
      ctx.beginPath()
      ctx.moveTo(t.verts[0][0], t.verts[0][1])
      for (let k = 1; k < t.verts.length; k++) ctx.lineTo(t.verts[k][0], t.verts[k][1])
      ctx.closePath()
      ctx.fillStyle = fills[t.groupId] || UNPAINTED
      ctx.fill()
      ctx.strokeStyle = HAIRLINE
      ctx.lineWidth = 1
      ctx.stroke()
    }
  }, [tiles, fills, size])

  function handlePick(e) {
    const rect = canvasRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    for (let i = tiles.length - 1; i >= 0; i--) {
      if (pointInPolygon([x, y], tiles[i].verts)) {
        const gid = tiles[i].groupId
        setFills((f) => ({ ...f, [gid]: colors[activeColor] }))
        break
      }
    }
  }

  function reset() {
    setFills({})
  }

  return (
    <div className="mode bloom-mode">
      <div className="canvas-wrap" ref={containerRef}>
        <canvas ref={canvasRef} onPointerDown={handlePick} />
      </div>
      <div className="controls">
        <div className="group-row">
          {BLOOM_GROUPS.map((g) => (
            <button
              key={g}
              className={'chip' + (g === groupName ? ' active' : '')}
              onClick={() => setGroupName(g)}
            >
              {g}
            </button>
          ))}
          <button className="text-btn" onClick={reset}>Reset</button>
        </div>
        <PaletteBar colors={colors} active={activeColor} onSelect={setActiveColor} />
      </div>
    </div>
  )
}
