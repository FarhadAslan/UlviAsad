"use client";

export default function RubiksLoader() {
  const faces = ["front", "back", "left", "right", "top", "bottom"];
  const faceColors: Record<string, string[]> = {
    front:  ["#ff3d00","#ffeb3b","#4caf50","#2196f3","#ffffff","#ffeb3b","#4caf50","#2196f3","#ff3d00"],
    back:   ["#4caf50","#ff3d00","#ffeb3b","#2196f3","#ffffff","#ff3d00","#ffeb3b","#4caf50","#2196f3"],
    left:   ["#ffeb3b","#4caf50","#2196f3","#ff3d00","#ffffff","#4caf50","#2196f3","#ffeb3b","#ff3d00"],
    right:  ["#4caf50","#ff3d00","#ffeb3b","#2196f3","#ffffff","#ff3d00","#ffeb3b","#4caf50","#2196f3"],
    top:    ["#2196f3","#ffeb3b","#ff3d00","#4caf50","#ffffff","#ffeb3b","#ff3d00","#4caf50","#2196f3"],
    bottom: ["#ffffff","#4caf50","#2196f3","#ff3d00","#ffeb3b","#4caf50","#2196f3","#ffffff","#ff3d00"],
  };
  const faceTransforms: Record<string, string> = {
    front:  "translateZ(36px)",
    back:   "rotateY(180deg) translateZ(36px)",
    left:   "rotateY(-90deg) translateZ(36px)",
    right:  "rotateY(90deg) translateZ(36px)",
    top:    "rotateX(90deg) translateZ(36px)",
    bottom: "rotateX(-90deg) translateZ(36px)",
  };

  return (
    <>
      <style>{`
        @keyframes rubiks-spin {
          0%   { transform: rotateX(0deg) rotateY(0deg); }
          100% { transform: rotateX(360deg) rotateY(360deg); }
        }
      `}</style>

      <div style={{
        position: "fixed", inset: 0, zIndex: 99999,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: "linear-gradient(160deg,rgba(223,244,255,0.97) 0%,rgba(238,249,255,0.98) 50%,rgba(255,255,255,0.97) 100%)",
        backdropFilter: "blur(8px)",
      }}>
        <div style={{ width: 72, height: 72, perspective: 400 }}>
          <div style={{
            width: "100%", height: "100%", position: "relative",
            transformStyle: "preserve-3d",
            animation: "rubiks-spin 5s infinite linear",
          }}>
            {faces.map((face) => (
              <div key={face} style={{
                position: "absolute", display: "flex", flexWrap: "wrap",
                width: "100%", height: "100%",
                transform: faceTransforms[face],
              }}>
                {faceColors[face].map((color, i) => (
                  <div key={i} style={{
                    width: "33.33%", height: "33.33%",
                    background: color,
                    border: "1px solid rgba(0,0,0,0.2)",
                    borderRadius: 1,
                    boxSizing: "border-box",
                  }} />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
