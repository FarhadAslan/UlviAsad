"use client"

import dynamic from "next/dynamic"
import { Suspense } from "react"
import { Award } from "lucide-react"

// SSR-də Canvas işləmir
const Canvas = dynamic(
  () => import("@react-three/fiber").then((m) => m.Canvas),
  { ssr: false }
)
const OrbitControls = dynamic(
  () => import("@react-three/drei").then((m) => m.OrbitControls),
  { ssr: false }
)
const ParticleSphere = dynamic(
  () => import("@/components/ui/cosmos-3d-orbit-gallery").then((m) => m.ParticleSphere),
  { ssr: false }
)

// Sertifikat nümunə şəkilləri — picsum.photos CORS-a icazə verir
const CERTIFICATE_IMAGES = [
  "https://picsum.photos/seed/cert1/400/280",
  "https://picsum.photos/seed/cert2/400/280",
  "https://picsum.photos/seed/cert3/400/280",
  "https://picsum.photos/seed/cert4/400/280",
  "https://picsum.photos/seed/cert5/400/280",
  "https://picsum.photos/seed/cert6/400/280",
  "https://picsum.photos/seed/cert7/400/280",
  "https://picsum.photos/seed/cert8/400/280",
  "https://picsum.photos/seed/cert9/400/280",
  "https://picsum.photos/seed/cert10/400/280",
  "https://picsum.photos/seed/cert11/400/280",
  "https://picsum.photos/seed/cert12/400/280",
]

function CanvasFallback() {
  return (
    <div className="w-full h-full flex items-center justify-center">
      <div className="w-16 h-16 border-4 border-[rgba(147,204,255,0.3)] border-t-[#1a7fe0] rounded-full animate-spin" />
    </div>
  )
}

export default function CertificatesSection() {
  return (
    <section className="py-16 relative overflow-hidden"
      style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.5) 0%, rgba(191,231,255,0.15) 100%)" }}>
      <div className="container mx-auto">
        {/* Başlıq */}
        <div className="text-center mb-4">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-semibold mb-4"
            style={{ background: "rgba(31,111,67,0.08)", color: "#1f6f43", border: "1px solid rgba(31,111,67,0.2)" }}>
            <Award size={14} />
            Uğur Hekayələri
          </div>
          <h2 className="section-title">Tələbə Sertifikatları</h2>
          <p className="section-subtitle max-w-xl mx-auto">
            Platformamızda uğurla quiz keçən tələbələrimizin qazandığı sertifikatlar
          </p>
        </div>

        {/* 3D Orbit Gallery */}
        <div className="relative w-full" style={{ height: "520px" }}>
          <Suspense fallback={<CanvasFallback />}>
            <Canvas
              camera={{ position: [0, 0, 18], fov: 65 }}
              style={{ background: "transparent" }}
              gl={{ alpha: true }}
            >
              <ambientLight intensity={0.8} />
              <pointLight position={[10, 10, 10]} intensity={1.2} />
              <pointLight position={[-10, -10, -10]} intensity={0.5} color="#93ccff" />
              <ParticleSphere images={CERTIFICATE_IMAGES} />
              <OrbitControls
                enablePan={false}
                enableZoom={false}
                enableRotate={true}
                autoRotate={false}
              />
            </Canvas>
          </Suspense>

          {/* Kənar gradient overlay-lər */}
          <div className="absolute inset-y-0 left-0 w-16 pointer-events-none"
            style={{ background: "linear-gradient(to right, rgba(248,250,252,0.8), transparent)" }} />
          <div className="absolute inset-y-0 right-0 w-16 pointer-events-none"
            style={{ background: "linear-gradient(to left, rgba(248,250,252,0.8), transparent)" }} />
        </div>

        {/* Alt mətn */}
        <p className="text-center text-sm text-slate-400 mt-2">
          🖱️ Sürükləyərək fırladın
        </p>
      </div>
    </section>
  )
}
