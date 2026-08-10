import { useEffect, useMemo, useRef, useState } from 'react'
import { buildPenroseSun } from '../lib/penroseSun'
import { generatePalette } from '../lib/tessellate/color'
import { pointInPolygon } from '../lib/geom'
import PaletteBar from './PaletteBar'

const PAPER = '#eeeee6'
const HAIRLINE = 'rgba(90,74,158,0.35)'

export default function PenroseMode() {
  const canvasRef = useRef(null)
  const containerRef = useRef(null)
  const [size, setSize] = useState({ w: 600, h: 600 })
  const [spin, setSpin] = useState(0)
  const [colors] = useState(() => generatePalette('#5a4a9e', 'analogous', 5).concat(['#0A0E13']))
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

  const r = Math.max(24, Math.min(size.w, size.h) * 0.4)
  const tiles = useMemo(
    () => buildPenroseSun(size.w / 2, size.h / 2, r, 1).map((t) => rotateTile(t, spin, size.w / 2, size.h / 2)),
    [r, size.w, size.h, spin],
  )

  const filledCount = Object.keys(fills).length
  const complete = filledCount >= tiles.length

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

    ctx.fillStyle = PAPER
    ctx.fillRect(0, 0, size.w, size.h)

    for (let i = 0; i < tiles.length; i++) {
      const t = tiles[i]
      ctx.beginPath()
      ctx.moveTo(t.verts[0][0], t.verts[0][1])
      for (let k = 1; k < t.verts.length; k++) ctx.lineTo(t.verts[k][0], t.verts[k][1])
      ctx.closePath()
      ctx.fillStyle = fills[i] || '#ffffff'
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
        setFills((f) => ({ ...f, [i]: colors[activeColor] }))
        break
      }
    }
  }

  function reshuffle() {
    setSpin((s) => s + 18 + Math.random() * 18)
    setFills({})
  }

  return (
    <div className="mode rosette-mode">
      <div className="canvas-wrap" ref={containerRef}>
        <canvas ref={canvasRef} onPointerDown={handlePick} />
        {complete && (
          <div className="complete-banner">
            <span>Sun complete</span>
            <button onClick={reshuffle}>New sun</button>
          </div>
        )}
      </div>
      <div className="controls">
        <div className="status-row">
          <span className="seed-name">Penrose sun</span>
          <span className="progress">{filledCount}/{tiles.length}</span>
          <button className="text-btn" onClick={reshuffle}>Shuffle</button>
        </div>
        <PaletteBar colors={colors} active={activeColor} onSelect={setActiveColor} />
      </div>
    </div>
  )
}

function rotateTile(t, deg, cx, cy) {
  const a = (deg * Math.PI) / 180
  const c = Math.cos(a), s = Math.sin(a)
  return {
    ...t,
    verts: t.verts.map(([x, y]) => {
      const dx = x - cx, dy = y - cy
      return [cx + dx * c - dy * s, cy + dx * s + dy * c]
    }),
  }
}
