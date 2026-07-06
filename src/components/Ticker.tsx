export default function Ticker({ items }: { items: string[] }) {
  // Lista e dublată ca animația de scroll să se lege fără pauză
  const track = [...items, ...items];
  return (
    <div className="topbar">
      <div className="topbar-inner">
        <span className="live-dot"></span>
        <span className="live-label">Live</span>
        <div className="ticker">
          <div className="ticker-track">
            {track.map((item, i) => (
              <span key={i}>{item}</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
