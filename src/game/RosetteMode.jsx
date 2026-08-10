import { useEffect, useMemo, useRef, useState } from 'react'
import { buildRosette, GIRIH_SEEDS } from '../lib/tessellate/girihTiles'
import { generatePalette } from '../lib/tessellate/color'
import { deg } from '../lib/tessellate/math'
import { pointInPolygon } from '../lib/geom'
import PaletteBar from './PaletteBar'

const PAPER = '#eeeee6'
const INK = '#20222c'
const HAIRLINE = 'rgba(32,34,44,0.28)'

// buildRosette() closes a single ring around one decagon by attaching each
// tile edge-to-edge with only its immediate decagon edge — it doesn't verify
// that ring-neighbors also close cleanly against each other. That holds for
// pentagon/hexagon/rhombus rings, but the concave bowtie tile overlaps its
// neighbors ~40-50% in this single-rosette construction (confirmed by
// sampling), even though it tiles correctly in the full continuous girih
// field elsewhere in the app. Restrict the puzzle pool to the seeds that
// close without overlap until buildRosette grows a real ring-closure check.
const SAFE_SEED_NAMES = ['Classic Star', 'Hex Lace', 'Rhombus Field', 'Triple Braid']

function dailySeedName() {
  const day = Math.floor(Date.now() / 86400000)
  return SAFE_SEED_NAMES[day % SAFE_SEED_NAMES.length]
}

export default function RosetteMode() {
  const canvasRef = useRef(null)
  const containerRef = useRef(null)
  const [size, setSize] = useState({ w: 600, h: 600 })
  const [seedName, setSeedName] = useState(dailySeedName)
  const [colors] = useState(() => generatePalette('#3E7CA6', 'analogous', 5).concat(['#0A0E13']))
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

  const r = Math.max(24, Math.min(size.w, size.h) * 0.17)
  const edgeLen = 2 * r * Math.sin(deg(18))
  const ringTypes = GIRIH_SEEDS[seedName] || ['pentagon', 'bowtie']

  const tiles = useMemo(
    () => buildRosette(edgeLen, ringTypes, size.w / 2, size.h / 2, deg(90)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [edgeLen, seedName, size.w, size.h],
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

    // strapwork linework drawn on top, in ink, last — this is what makes it
    // read as a printed pattern plate rather than a flat-filled polygon set
    ctx.strokeStyle = INK
    ctx.lineWidth = Math.max(1.5, r * 0.045)
    ctx.lineJoin = 'round'
    for (const t of tiles) {
      ctx.beginPath()
      ctx.moveTo(t.decoration[0][0], t.decoration[0][1])
      for (let k = 1; k < t.decoration.length; k++) ctx.lineTo(t.decoration[k][0], t.decoration[k][1])
      ctx.closePath()
      ctx.stroke()
    }
  }, [tiles, fills, size, r])

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

  function shuffle() {
    const others = SAFE_SEED_NAMES.filter((n) => n !== seedName)
    setSeedName(others[Math.floor(Math.random() * others.length)])
    setFills({})
  }

  return (
    <div className="mode rosette-mode">
      <div className="canvas-wrap" ref={containerRef}>
        <canvas ref={canvasRef} onPointerDown={handlePick} />
        {complete && (
          <div className="complete-banner">
            <span>Rosette complete</span>
            <button onClick={shuffle}>New rosette</button>
          </div>
        )}
      </div>
      <div className="controls">
        <div className="status-row">
          <span className="seed-name">{seedName}</span>
          <span className="progress">{filledCount}/{tiles.length}</span>
          <button className="text-btn" onClick={shuffle}>Shuffle</button>
        </div>
        <PaletteBar colors={colors} active={activeColor} onSelect={setActiveColor} />
      </div>
    </div>
  )
}
