export default function ThreadLoading() {
  return (
    <div style={{
      position: 'fixed',
      top: 65, left: 0, right: 0, bottom: 0,
      background: 'var(--surface-0)',
      overflow: 'hidden',
    }}>
      <style>{`
        @keyframes shimmer {
          0%   { background-position: -600px 0; }
          100% { background-position:  600px 0; }
        }
        .sk {
          background: linear-gradient(90deg, rgb(var(--ink-rgb) / 0.04) 25%, rgb(var(--ink-rgb) / 0.08) 50%, rgb(var(--ink-rgb) / 0.04) 75%);
          background-size: 600px 100%;
          animation: shimmer 1.4s infinite linear;
          border-radius: 4px;
        }
        @media (prefers-reduced-motion: reduce) { .sk { animation: none; } }

        .sk-layout { display: flex; height: 100%; overflow: hidden; }
        .sk-left {
          flex: 2; min-width: 0; height: 100%; overflow: hidden;
          border-right: 1px solid rgb(var(--ink-rgb) / 0.08);
          padding: 12px 16px;
          display: flex; flex-direction: column; gap: 10;
        }
        .sk-middle {
          flex: 6; min-width: 0; height: 100%; overflow: hidden;
          display: flex; flex-direction: column;
        }
        .sk-right {
          flex: 4; min-width: 0; height: 100%; overflow: hidden;
          border-left: 1px solid rgb(var(--ink-rgb) / 0.08);
          display: flex; flex-direction: column;
        }
        .sk-tabs { display: none; }
        @media (max-width: 1199px) {
          .sk-left, .sk-right { display: none; }
          .sk-layout { flex-direction: column; }
          .sk-middle { flex: unset; width: 100%; height: calc(100% - 41px); }
          .sk-tabs {
            display: flex; height: 41px; flex-shrink: 0;
            border-bottom: 1px solid rgb(var(--ink-rgb) / 0.1);
            align-items: center; gap: 24px; padding: 0 16px;
          }
        }
      `}</style>

      <div className="sk-layout">
        <div className="sk-tabs">
          <div className="sk" style={{ width: 54, height: 12 }} />
          <div className="sk" style={{ width: 54, height: 12 }} />
        </div>

        <div className="sk-left">
          <div className="sk" style={{ width: '60%', height: 12, marginBottom: 4 }} />
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <div className="sk" style={{ width: 14, height: 14, borderRadius: 3, flexShrink: 0 }} />
              <div className="sk" style={{ width: `${45 + (i * 23) % 45}%`, height: 12 }} />
            </div>
          ))}
        </div>

        <div className="sk-middle">
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '8px 10px', flexShrink: 0,
          }}>
            <div className="sk" style={{ flex: 1, height: 40, borderRadius: 8 }} />
            <div className="sk" style={{ width: 72, height: 40, borderRadius: 8, flexShrink: 0 }} />
          </div>

          <div style={{ flex: 1, overflow: 'hidden', padding: '0 4px', display: 'flex', flexDirection: 'column', gap: 2 }}>
            {Array.from({ length: 22 }).map((_, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '2px 8px',
                opacity: 1 - i * 0.03,
              }}>
                <div className="sk" style={{ width: 36, height: 10, flexShrink: 0 }} />
                <div className="sk" style={{ width: 64, height: 10, flexShrink: 0 }} />
                <div className="sk" style={{ width: 24, height: 24, borderRadius: '50%', flexShrink: 0 }} />
                <div className="sk" style={{ width: 66, height: 17, borderRadius: 3, flexShrink: 0 }} />
                <div className="sk" style={{ width: `${70 + (i * 37) % 130}px`, height: 15 }} />
                <div className="sk" style={{ width: `${40 + (i * 19) % 70}px`, height: 12 }} />
              </div>
            ))}
          </div>
        </div>

        <div className="sk-right">
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '10px 16px 8px', flexShrink: 0,
            borderBottom: '1px solid rgb(var(--ink-rgb) / 0.06)',
          }}>
            <div className="sk" style={{ flex: 1, height: 16 }} />
            <div className="sk" style={{ width: 52, height: 12, flexShrink: 0 }} />
          </div>

          <div style={{
            display: 'flex', gap: 14, padding: '10px 16px', flexShrink: 0,
            borderBottom: '1px solid rgb(var(--ink-rgb) / 0.08)',
          }}>
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="sk" style={{ width: 38, height: 11 }} />
            ))}
          </div>

          <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="sk" style={{ width: '70%', height: 12 }} />
            <div className="sk" style={{ width: '100%', height: 56, borderRadius: 6 }} />
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div className="sk" style={{ width: 22, height: 22, borderRadius: '50%', flexShrink: 0 }} />
                <div className="sk" style={{ flex: 1, height: 11 }} />
                <div className="sk" style={{ width: 32, height: 11, flexShrink: 0 }} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
