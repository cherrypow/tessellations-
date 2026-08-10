export default function PaletteBar({ colors, active, onSelect }) {
  return (
    <div className="palette-bar">
      {colors.map((c, i) => (
        <button
          key={c + i}
          className={'swatch' + (i === active ? ' active' : '')}
          style={{ background: c }}
          aria-label={`Color ${i + 1}`}
          onClick={() => onSelect(i)}
        />
      ))}
    </div>
  )
}
