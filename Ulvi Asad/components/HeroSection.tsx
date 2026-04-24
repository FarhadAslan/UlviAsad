"use client";

import dynamic from "next/dynamic";

// Inline mini kub — hero yüklənərkən
function MiniCube() {
  return (
    <div style={{ width: 72, height: 72, perspective: 400 }}>
      <div style={{
        width: "100%", height: "100%", position: "relative",
        transformStyle: "preserve-3d",
        animation: "my-rotateCube 5s infinite linear",
      }}>
        {(["front","back","left","right","top","bottom"] as const).map((face) => {
          const colors = ["#ff3d00","#ffeb3b","#4caf50","#2196f3","#ffffff","#ffeb3b","#4caf50","#2196f3","#ff3d00"];
          const transforms: Record<string, string> = {
            front:  "translateZ(36px)",
            back:   "rotateY(180deg) translateZ(36px)",
            left:   "rotateY(-90deg) translateZ(36px)",
            right:  "rotateY(90deg) translateZ(36px)",
            top:    "rotateX(90deg) translateZ(36px)",
            bottom: "rotateX(-90deg) translateZ(36px)",
          };
          return (
            <div key={face} style={{
              position: "absolute", display: "flex", flexWrap: "wrap",
              width: "100%", height: "100%", transform: transforms[face],
            }}>
              {colors.map((c, i) => (
                <div key={i} style={{
                  width: "33.33%", height: "33.33%", background: c,
                  border: "1px solid rgba(0,0,0,0.2)", borderRadius: 1, boxSizing: "border-box",
                }} />
              ))}
            </div>
          );
        })}
      </div>
      <style>{`
        @keyframes my-rotateCube {
          0%   { transform: rotateX(0deg)   rotateY(0deg); }
          100% { transform: rotateX(360deg) rotateY(360deg); }
        }
      `}</style>
    </div>
  );
}

const WovenLightHero = dynamic(
  () => import("@/components/ui/woven-light-hero").then((m) => ({ default: m.WovenLightHero })),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center min-h-[92vh]"
        style={{ background: "linear-gradient(160deg,#f0f8ff 0%,#e8f5ff 40%,#f0fff4 100%)" }}>
        <MiniCube />
      </div>
    ),
  }
);

export default function HeroSection() {
  return <WovenLightHero />;
}
