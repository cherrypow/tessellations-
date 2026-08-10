import { useState } from 'react'
import RosetteMode from './game/RosetteMode'
import BloomMode from './game/BloomMode'
import PenroseMode from './game/PenroseMode'
import FlakeWars from './game/FlakeWars'
import PieceWars from './game/PieceWars'
import './App.css'

const MODES = [
  { id: 'piecewars', label: 'Piece Wars', Component: PieceWars },
  { id: 'flakewars', label: 'Flake Wars', Component: FlakeWars },
  { id: 'rosette', label: 'Star & Strap', Component: RosetteMode },
  { id: 'bloom', label: 'Wallpaper Bloom', Component: BloomMode },
  { id: 'penrose', label: 'Quasicrystal Drift', Component: PenroseMode },
]

export default function App() {
  const [mode, setMode] = useState('piecewars')
  const Active = MODES.find((m) => m.id === mode)?.Component ?? BloomMode

  return (
    <div className="app-shell">
      <header className="app-tabs">
        {MODES.map((m) => (
          <button
            key={m.id}
            className={'tab' + (m.id === mode ? ' active' : '')}
            onClick={() => setMode(m.id)}
          >
            {m.label}
          </button>
        ))}
      </header>
      <main className="app-stage">
        <Active />
      </main>
    </div>
  )
}
