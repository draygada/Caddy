import React from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Html } from '@react-three/drei'

// Four colours with fixed meaning (THE_BUILD.md §4).
export const STATE = { NLR: '#2e9e6b', QUESTION: '#d99a3a', LICENCE: '#c4433c', ITAR: '#111318' }

// Kestrel as primitives. Wing box scales from the span input; nothing here feeds a
// regulated number yet — evaluate() is stubbed until Diego lands it.
function Kestrel({ span }) {
  return (
    <group>
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.09, 0.09, 1.1, 20]} />
        <meshStandardMaterial color={STATE.NLR} />
      </mesh>
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[0.16, 0.03, span]} />
        <meshStandardMaterial color={STATE.NLR} />
      </mesh>
      <mesh position={[-0.5, 0.12, 0]}>
        <boxGeometry args={[0.1, 0.22, 0.42]} />
        <meshStandardMaterial color={STATE.NLR} />
      </mesh>
      <Html position={[0.6, 0.25, 0]} style={{ color: '#8c94a8', fontSize: 11, whiteSpace: 'nowrap' }}>
        span {span.toFixed(1)} m
      </Html>
    </group>
  )
}

export default function App() {
  const [span, setSpan] = React.useState(3.0)
  return (
    <div style={{ height: '100%', display: 'grid', gridTemplateColumns: '1fr 300px' }}>
      <Canvas camera={{ position: [2.4, 1.4, 2.4], fov: 45 }}>
        <ambientLight intensity={0.7} />
        <directionalLight position={[3, 5, 2]} intensity={1.1} />
        <Kestrel span={span} />
        <gridHelper args={[8, 16, '#242a38', '#1a1f2b']} position={[0, -0.5, 0]} />
        <OrbitControls />
      </Canvas>
      <aside style={{ borderLeft: '1px solid #242a38', padding: 16 }}>
        <div style={{ fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase',
                      color: '#8c94a8', marginBottom: 12 }}>Spec</div>
        <label style={{ display: 'block', fontSize: 13 }}>
          Wing span (m)
          <input type="number" step="0.1" min="1" max="6" value={span}
                 onChange={e => setSpan(parseFloat(e.target.value) || 0)}
                 style={{ width: '100%', marginTop: 6, padding: 6, background: '#141824',
                          color: '#e6e9f0', border: '1px solid #242a38', borderRadius: 4 }} />
        </label>
        <p style={{ color: '#8c94a8', fontSize: 12, marginTop: 18, lineHeight: 1.5 }}>
          Flags and destinations appear here once <code>POST /evaluate</code> is wired.
          The engine is stubbed at the 10:00 schema freeze.
        </p>
      </aside>
    </div>
  )
}
