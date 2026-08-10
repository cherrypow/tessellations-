import { useEffect, useMemo, useRef, useState } from 'react'
import { buildHexaflakeRing, buildAdjacency } from '../lib/hexaflake'
import { pointInPolygon } from '../lib/geom'

// Piece Wars — the movable-pieces evolution of Flake Wars. Same fixed
// numbered board (see hexaflake.js), same bridge rule, but ownership is no
// longer permanent: each side has 3 PIECES, and once placed, a turn moves
// one piece to an adjacent empty cell instead of claiming a new one. The
// cell a piece leaves reverts to unclaimed. Your score reflects where your
// pieces currently ARE, not everywhere they've ever been.
//
// Why: the prior (permanent-claim) version was rated well below chess/
// checkers specifically because nothing ever moved — no mobility means no
// forks, no repositioning, no risk in anything you'd already built. This
// is the direct fix: bridges are now inherently temporary (a piece moving
// away breaks one for free, no separate "contested bridge" mechanic
// needed), and every move is a real trade-off, not a pure addition.
//
// Dropped for this version: envelopment and check. Both were built around
// a densely-filling 91-cell board; with only 3 live pieces per side they
// don't make sense as-is (envelopment's "3 neighbors" would need literally
// all of one side's pieces surrounding a single cell). A piece-appropriate
// forcing mechanic is a real next step, not built yet.
//
// Setup: your first 3 moves are placements (tap any empty cell). After
// that, tap one of your own pieces to select it, then tap a highlighted
// adjacent empty cell to move it there. No captures — you can't move onto
// a cell the opponent occupies. Game ends after MOVE_LIMIT actions per
// side (placements included); highest live score wins.
const THEMES = {
  light: { paper: '#eeeee6', hairline: 'rgba(32,34,44,0.25)' },
  dark: { paper: '#1a1c27', hairline: 'rgba(255,255,255,0.14)' },
}
const CELL_WHITE = '#ffffff'
const CELL_INK = '#20222c'
const BRIDGE_COLOR = '#cba24a'
const SELECT_COLOR = '#e0b866'
const LEGAL_MOVE_COLOR = 'rgba(224,184,102,0.55)'
const SHADES = {
  you: { dark: '#1e4a73', light: '#5b8fc4' },
  ai: { dark: '#7a2430', light: '#c9525f' },
}
const SCORE_WEIGHTS = { bridge: 10 }
const PIECES_PER_SIDE = 3
const MOVE_LIMIT = 20
// See FlakeWars.jsx for the measured reasoning behind this number — a
// small amount of calculated play overwhelms non-targeting opponents, so
// full-strength AI produced a near-unbeatable wall there. Starting Piece
// Wars at the same setting; needs its own simulation pass once the core
// loop is confirmed working, since the game shape is different enough
// that the old numbers don't necessarily transfer.
const AI_SKILL = 0.15

function nextShade(moveCount) {
  return moveCount % 2 === 0 ? 'dark' : 'light'
}

function groupByBox(tiles) {
  const map = new Map()
  tiles.forEach((t, i) => {
    if (!map.has(t.box)) map.set(t.box, [])
    map.get(t.box).push(i)
  })
  return map
}

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function countCrossBoxOpportunities(fixedValues, tiles, adj) {
  let count = 0
  const seen = new Set()
  for (let i = 0; i < adj.length; i++) {
    for (const j of adj[i]) {
      if (tiles[i].box === tiles[j].box) continue
      const key = i < j ? `${i}-${j}` : `${j}-${i}`
      if (seen.has(key)) continue
      seen.add(key)
      if (fixedValues[i] === fixedValues[j] || fixedValues[i] + fixedValues[j] === 8) count++
    }
  }
  return count
}

function generateFixedValues(boxes, tiles, adj) {
  let best = null
  for (let attempt = 0; attempt < 20; attempt++) {
    const values = {}
    for (const idxs of boxes.values()) {
      const perm = shuffle([1, 2, 3, 4, 5, 6, 7])
      idxs.forEach((idx, k) => { values[idx] = perm[k] })
    }
    if (countCrossBoxOpportunities(values, tiles, adj) > 0) return values
    best = values
  }
  return best
}

// Same rule as Flake Wars: same value or complementary (sum to 8), cross a
// flower boundary, alternating shade. Now inherently temporary — owners
// and shades only ever reflect CURRENT piece positions.
function buildBridgeEdges(fixedValues, owners, shades, tiles, adj) {
  const edges = []
  const seen = new Set()
  for (let i = 0; i < adj.length; i++) {
    if (!owners[i]) continue
    for (const j of adj[i]) {
      if (tiles[i].box === tiles[j].box) continue
      if (!owners[j] || owners[i] !== owners[j]) continue
      if (!shades[i] || !shades[j] || shades[i] === shades[j]) continue
      const key = i < j ? `${i}-${j}` : `${j}-${i}`
      if (seen.has(key)) continue
      if (fixedValues[i] !== fixedValues[j] && fixedValues[i] + fixedValues[j] !== 8) continue
      seen.add(key)
      edges.push({ a: i, b: j, owner: owners[i] })
    }
  }
  return edges
}

// Live score: value of cells your pieces currently occupy, plus current
// bridges. No box-completion bonus (structurally near-impossible with only
// 3 live pieces per side spread across a 91-cell board — would've been the
// same "always reads 0" mistake made twice already this project).
function computeScores(fixedValues, owners, edges) {
  const cellPoints = { you: 0, ai: 0 }
  for (const [i, p] of Object.entries(owners)) cellPoints[p] += fixedValues[i]
  const bridgeCount = { you: 0, ai: 0 }
  for (const e of edges) bridgeCount[e.owner]++
  const total = (p) => cellPoints[p] + bridgeCount[p] * SCORE_WEIGHTS.bridge
  return { cellPoints, bridgeCount, total: { you: total('you'), ai: total('ai') } }
}

function scoreFor(fixedValues, claims, tiles, adj) {
  const edges = buildBridgeEdges(fixedValues, claims.owners, claims.shades, tiles, adj)
  return computeScores(fixedValues, claims.owners, edges)
}

function inSetup(claims, player) {
  return claims.piecePositions[player].length < PIECES_PER_SIDE
}

// from=null means placement (setup phase); otherwise the cell a piece is
// moving away from, which reverts to unclaimed.
function simulateMove(claims, from, to, player) {
  const owners = { ...claims.owners }
  const shades = { ...claims.shades }
  if (from != null) {
    delete owners[from]
    delete shades[from]
  }
  const shade = nextShade(claims.moveCount[player])
  owners[to] = player
  shades[to] = shade
  const moveCount = { ...claims.moveCount, [player]: claims.moveCount[player] + 1 }
  const piecePositions = { ...claims.piecePositions }
  const arr = [...piecePositions[player]]
  if (from == null) arr.push(to)
  else arr[arr.indexOf(from)] = to
  piecePositions[player] = arr
  return { owners, shades, moveCount, piecePositions }
}

// Every legal action for `player` right now: placements during setup,
// piece-moves after. { from: null|cellIdx, to: cellIdx }[]
function legalActions(claims, player, tiles, adj) {
  if (inSetup(claims, player)) {
    const out = []
    for (let i = 0; i < tiles.length; i++) if (!claims.owners[i]) out.push({ from: null, to: i })
    return out
  }
  const out = []
  for (const from of claims.piecePositions[player]) {
    for (const to of adj[from]) {
      if (!claims.owners[to]) out.push({ from, to })
    }
  }
  return out
}

// Greedy: maximize the marginal live-score gain from taking this action —
// no denial term yet (the old "deny the human a good cell" heuristic
// doesn't translate directly when cells aren't permanent; a piece-aware
// version is a follow-up, not built here).
function chooseAiAction(fixedValues, claims, tiles, adj) {
  const actions = legalActions(claims, 'ai', tiles, adj)
  if (actions.length === 0) return null
  if (Math.random() > AI_SKILL) return actions[Math.floor(Math.random() * actions.length)]
  const baseline = scoreFor(fixedValues, claims, tiles, adj)
  let best = null
  let bestGain = -Infinity
  for (const a of actions) {
    const next = simulateMove(claims, a.from, a.to, 'ai')
    const gain = scoreFor(fixedValues, next, tiles, adj).total.ai - baseline.total.ai
    if (gain > bestGain) {
      bestGain = gain
      best = a
    }
  }
  return best
}

function centroidOf(verts) {
  let x = 0, y = 0
  for (const [px, py] of verts) { x += px; y += py }
  return [x / verts.length, y / verts.length]
}

function textColorFor(hex) {
  const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.55 ? '#20222c' : '#f5f3ee'
}

function emptyClaims() {
  return { owners: {}, shades: {}, moveCount: { you: 0, ai: 0 }, piecePositions: { you: [], ai: [] } }
}

export default function PieceWars() {
  const canvasRef = useRef(null)
  const containerRef = useRef(null)
  const [size, setSize] = useState({ w: 600, h: 600 })
  const [claims, setClaims] = useState(emptyClaims)
  const [turn, setTurn] = useState('you')
  const [gameOver, setGameOver] = useState(false)
  const [round, setRound] = useState(0)
  const [history, setHistory] = useState([])
  const [darkMode, setDarkMode] = useState(true)
  const [selectedPiece, setSelectedPiece] = useState(null)
  const theme = THEMES[darkMode ? 'dark' : 'light']

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

  const r = Math.max(30, Math.min(size.w, size.h) * 0.42)
  const tiles = useMemo(
    () => buildHexaflakeRing(size.w / 2, size.h / 2, r, 2),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [r, size.w, size.h],
  )
  const boxes = useMemo(() => groupByBox(tiles), [tiles])
  const adj = useMemo(() => buildAdjacency(tiles), [tiles])
  const fixedValues = useMemo(
    () => generateFixedValues(boxes, tiles, adj),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [boxes, tiles, adj, round],
  )
  const edges = useMemo(() => buildBridgeEdges(fixedValues, claims.owners, claims.shades, tiles, adj), [fixedValues, claims, tiles, adj])
  const scores = useMemo(() => computeScores(fixedValues, claims.owners, edges), [fixedValues, claims, edges])
  const youInSetup = inSetup(claims, 'you')
  const movesUsedYou = claims.moveCount.you
  const legalDestinations = selectedPiece != null ? adj[selectedPiece].filter((n) => !claims.owners[n]) : []

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

    ctx.fillStyle = theme.paper
    ctx.fillRect(0, 0, size.w, size.h)

    const centroids = tiles.map((t) => centroidOf(t.verts))
    const legalSet = new Set(legalDestinations)

    for (let i = 0; i < tiles.length; i++) {
      const t = tiles[i]
      ctx.beginPath()
      ctx.moveTo(t.verts[0][0], t.verts[0][1])
      for (let k = 1; k < t.verts.length; k++) ctx.lineTo(t.verts[k][0], t.verts[k][1])
      ctx.closePath()
      const v = fixedValues[i]
      const owner = claims.owners[i]
      const shade = claims.shades[i] || 'dark'
      const fill = owner ? SHADES[owner][shade] : CELL_WHITE
      ctx.fillStyle = fill
      ctx.fill()

      if (i === selectedPiece) {
        ctx.strokeStyle = SELECT_COLOR
        ctx.lineWidth = 3.5
      } else if (legalSet.has(i)) {
        ctx.strokeStyle = LEGAL_MOVE_COLOR
        ctx.lineWidth = 3
      } else {
        ctx.strokeStyle = theme.hairline
        ctx.lineWidth = 1
      }
      ctx.stroke()

      const [cx, cy] = centroids[i]
      const leafR = Math.hypot(t.verts[0][0] - cx, t.verts[0][1] - cy)
      ctx.fillStyle = owner ? textColorFor(fill) : CELL_INK
      ctx.font = `700 ${Math.round(leafR * 0.62)}px ui-monospace, "SF Mono", "Cascadia Code", monospace`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(String(v), cx, cy + leafR * 0.03)
    }

    ctx.lineWidth = 3
    ctx.lineCap = 'round'
    for (const e of edges) {
      const [ax, ay] = centroids[e.a]
      const [bx, by] = centroids[e.b]
      ctx.strokeStyle = BRIDGE_COLOR
      ctx.globalAlpha = e.owner === 'you' ? 1 : 0.55
      ctx.beginPath()
      ctx.moveTo(ax, ay)
      ctx.lineTo(bx, by)
      ctx.stroke()
    }
    ctx.globalAlpha = 1
  }, [tiles, fixedValues, claims, edges, size, theme, selectedPiece, legalDestinations, adj])

  function checkGameOver(next) {
    if (next.moveCount.you >= MOVE_LIMIT && next.moveCount.ai >= MOVE_LIMIT) {
      setGameOver(true)
      return true
    }
    return false
  }

  function aiTurn(currentClaims) {
    const action = chooseAiAction(fixedValues, currentClaims, tiles, adj)
    if (action == null) {
      setGameOver(true)
      return
    }
    setHistory((h) => [...h, { claims: currentClaims, turn: 'ai', selectedPiece: null }])
    const next = simulateMove(currentClaims, action.from, action.to, 'ai')
    setClaims(next)
    if (!checkGameOver(next)) setTurn('you')
  }

  useEffect(() => {
    if (turn !== 'ai' || gameOver) return
    const t = setTimeout(() => aiTurn(claims), 500)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turn, gameOver])

  function handleCanvasClick(e) {
    if (turn !== 'you' || gameOver) return
    const rect = canvasRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    let idx = null
    for (let i = tiles.length - 1; i >= 0; i--) {
      if (pointInPolygon([x, y], tiles[i].verts)) { idx = i; break }
    }
    if (idx == null) return

    if (youInSetup) {
      if (claims.owners[idx]) return
      commitMove(null, idx)
      return
    }

    if (selectedPiece == null) {
      if (claims.owners[idx] === 'you') setSelectedPiece(idx)
      return
    }
    if (idx === selectedPiece) {
      setSelectedPiece(null)
      return
    }
    if (claims.owners[idx]) return
    if (!adj[selectedPiece].includes(idx)) return
    commitMove(selectedPiece, idx)
  }

  function commitMove(from, to) {
    setHistory((h) => [...h, { claims, turn: 'you', selectedPiece: null }])
    const next = simulateMove(claims, from, to, 'you')
    setClaims(next)
    setSelectedPiece(null)
    if (!checkGameOver(next)) setTurn('ai')
  }

  function undo() {
    if (history.length === 0) return
    const prev = history[history.length - 1]
    setHistory((h) => h.slice(0, -1))
    setClaims(prev.claims)
    setTurn(prev.turn)
    setSelectedPiece(prev.selectedPiece)
    setGameOver(false)
  }

  function newGame() {
    setClaims(emptyClaims())
    setTurn('you')
    setGameOver(false)
    setHistory([])
    setSelectedPiece(null)
    setRound((n) => n + 1)
  }

  const winner = gameOver && (scores.total.you !== scores.total.ai ? (scores.total.you > scores.total.ai ? 'you' : 'ai') : 'draw')
  const phaseLabel = youInSetup ? `Place piece ${claims.piecePositions.you.length + 1}/${PIECES_PER_SIDE}` : selectedPiece != null ? 'Pick a destination' : 'Select a piece to move'

  return (
    <div className="mode rosette-mode">
      <div className="canvas-wrap" ref={containerRef}>
        <canvas ref={canvasRef} onPointerDown={handleCanvasClick} />
        {gameOver && (
          <div className="complete-banner">
            <span>
              {winner === 'draw' ? 'Draw' : winner === 'you' ? 'You win' : 'AI wins'} — {scores.total.you} to {scores.total.ai}
            </span>
            <button onClick={newGame}>New game</button>
          </div>
        )}
      </div>
      <div className="controls">
        <div className="status-row">
          <span className="seed-name">{gameOver ? 'Game over' : turn === 'you' ? phaseLabel : 'AI thinking…'}</span>
          <span className="progress">score {scores.total.you}-{scores.total.ai} · move {movesUsedYou}/{MOVE_LIMIT}</span>
          <button className="text-btn" onClick={() => setDarkMode((d) => !d)}>{darkMode ? 'Light' : 'Dark'}</button>
          <button className="text-btn" onClick={undo} disabled={history.length === 0}>Undo</button>
          <button className="text-btn" onClick={newGame}>New game</button>
        </div>
        <div className="status-row" style={{ fontSize: 11 }}>
          <span>value {scores.cellPoints.you}-{scores.cellPoints.ai}</span>
          <span style={{ color: BRIDGE_COLOR }}>bridges {scores.bridgeCount.you}-{scores.bridgeCount.ai}</span>
        </div>
        <div className="status-row" style={{ fontSize: 11 }}>
          <span>
            3 pieces each. First 3 moves place them; after that, tap a piece then a lit adjacent cell to move it — the cell you leave reverts to unclaimed.
          </span>
        </div>
        <div className="status-row" style={{ fontSize: 11 }}>
          <span>Bridges (+10): same number, or 1↔7 · 2↔6 · 3↔5, alternating shade, cross a flower boundary. No captures — game ends at {MOVE_LIMIT} moves/side.</span>
        </div>
      </div>
    </div>
  )
}
