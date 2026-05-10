"use client"

import { Award } from "lucide-react"
import { useEffect, useState } from "react"

interface Certificate {
  id: string
  imageUrl: string
  title: string
}

// Fallback şəkillər — DB boş olduqda göstərilir
const FALLBACK_IMAGES = [
  "https://picsum.photos/seed/cert1/480/320",
  "https://picsum.photos/seed/cert2/480/320",
  "https://picsum.photos/seed/cert3/480/320",
  "https://picsum.photos/seed/cert4/480/320",
  "https://picsum.photos/seed/cert5/480/320",
  "https://picsum.photos/seed/cert6/480/320",
  "https://picsum.photos/seed/cert7/480/320",
  "https://picsum.photos/seed/cert8/480/320",
  "https://picsum.photos/seed/cert9/480/320",
  "https://picsum.photos/seed/cert10/480/320",
  "https://picsum.photos/seed/cert11/480/320",
  "https://picsum.photos/seed/cert12/480/320",
].map((url, i) => ({ id: String(i), imageUrl: url, title: "" }))

export default function CertificatesSection() {
  const [certs, setCerts] = useState<Certificate[]>([])

  useEffect(() => {
    fetch("/api/certificates")
      .then((r) => r.json())
      .then((d) => setCerts(Array.isArray(d) && d.length > 0 ? d : FALLBACK_IMAGES))
      .catch(() => setCerts(FALLBACK_IMAGES))
  }, [])

  const half = Math.ceil(certs.length / 2)
  const ROW1 = certs.slice(0, half)
  const ROW2 = certs.slice(half)

export default function CertificatesSection() {
  return (
    <section className="py-16 overflow-hidden"
      style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.5) 0%, rgba(191,231,255,0.15) 100%)" }}>
      <div className="container mx-auto mb-10">
        {/* Başlıq */}
        <div className="text-center">
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
      </div>

      {/* Sıra 1 — sola sürüşür */}
      <div className="relative mb-4">
        <div className="flex gap-4 marquee-track marquee-left">
          {[...ROW1, ...ROW1].map((cert, i) => (
            <div key={i} className="marquee-item flex-shrink-0 rounded-2xl overflow-hidden shadow-md"
              style={{ width: 280, height: 186, border: "1.5px solid rgba(147,204,255,0.25)" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={cert.imageUrl} alt={cert.title || `Sertifikat ${i + 1}`}
                className="w-full h-full object-cover" loading="lazy" />
            </div>
          ))}
        </div>
      </div>

      {/* Sıra 2 — sağa sürüşür */}
      <div className="relative">
        <div className="flex gap-4 marquee-track marquee-right">
          {[...ROW2, ...ROW2].map((cert, i) => (
            <div key={i} className="marquee-item flex-shrink-0 rounded-2xl overflow-hidden shadow-md"
              style={{ width: 280, height: 186, border: "1.5px solid rgba(147,204,255,0.25)" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={cert.imageUrl} alt={cert.title || `Sertifikat ${i + 7}`}
                className="w-full h-full object-cover" loading="lazy" />
            </div>
          ))}
        </div>
      </div>

      {/* Kənar gradient overlay-lər */}
      <div className="pointer-events-none absolute inset-y-0 left-0 w-32 z-10"
        style={{ background: "linear-gradient(to right, rgba(248,250,252,1), transparent)" }} />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-32 z-10"
        style={{ background: "linear-gradient(to left, rgba(248,250,252,1), transparent)" }} />
    </section>
  )
}
