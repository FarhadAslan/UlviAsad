"use client"

import { useEffect, useRef } from "react"

interface Vector2D {
  x: number
  y: number
}

class Particle {
  pos: Vector2D = { x: 0, y: 0 }
  vel: Vector2D = { x: 0, y: 0 }
  acc: Vector2D = { x: 0, y: 0 }
  target: Vector2D = { x: 0, y: 0 }

  closeEnoughTarget = 100
  maxSpeed = 1.0
  maxForce = 0.1
  particleSize = 10
  isKilled = false

  startColor = { r: 0, g: 0, b: 0 }
  targetColor = { r: 0, g: 0, b: 0 }
  colorWeight = 0
  colorBlendRate = 0.01

  move() {
    let proximityMult = 1
    const distance = Math.sqrt(
      Math.pow(this.pos.x - this.target.x, 2) +
      Math.pow(this.pos.y - this.target.y, 2)
    )
    if (distance < this.closeEnoughTarget) {
      proximityMult = distance / this.closeEnoughTarget
    }

    const towardsTarget = {
      x: this.target.x - this.pos.x,
      y: this.target.y - this.pos.y,
    }
    const magnitude = Math.sqrt(
      towardsTarget.x * towardsTarget.x + towardsTarget.y * towardsTarget.y
    )
    if (magnitude > 0) {
      towardsTarget.x = (towardsTarget.x / magnitude) * this.maxSpeed * proximityMult
      towardsTarget.y = (towardsTarget.y / magnitude) * this.maxSpeed * proximityMult
    }

    const steer = {
      x: towardsTarget.x - this.vel.x,
      y: towardsTarget.y - this.vel.y,
    }
    const steerMag = Math.sqrt(steer.x * steer.x + steer.y * steer.y)
    if (steerMag > 0) {
      steer.x = (steer.x / steerMag) * this.maxForce
      steer.y = (steer.y / steerMag) * this.maxForce
    }

    this.acc.x += steer.x
    this.acc.y += steer.y
    this.vel.x += this.acc.x
    this.vel.y += this.acc.y
    this.pos.x += this.vel.x
    this.pos.y += this.vel.y
    this.acc.x = 0
    this.acc.y = 0
  }

  draw(ctx: CanvasRenderingContext2D, drawAsPoints: boolean) {
    if (this.colorWeight < 1.0) {
      this.colorWeight = Math.min(this.colorWeight + this.colorBlendRate, 1.0)
    }
    const c = {
      r: Math.round(this.startColor.r + (this.targetColor.r - this.startColor.r) * this.colorWeight),
      g: Math.round(this.startColor.g + (this.targetColor.g - this.startColor.g) * this.colorWeight),
      b: Math.round(this.startColor.b + (this.targetColor.b - this.startColor.b) * this.colorWeight),
    }
    ctx.fillStyle = `rgb(${c.r},${c.g},${c.b})`
    if (drawAsPoints) {
      ctx.fillRect(this.pos.x, this.pos.y, 2, 2)
    } else {
      ctx.beginPath()
      ctx.arc(this.pos.x, this.pos.y, this.particleSize / 2, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  kill(width: number, height: number) {
    if (!this.isKilled) {
      const rp = this._randomPos(width / 2, height / 2, (width + height) / 2)
      this.target.x = rp.x
      this.target.y = rp.y
      this.startColor = {
        r: this.startColor.r + (this.targetColor.r - this.startColor.r) * this.colorWeight,
        g: this.startColor.g + (this.targetColor.g - this.startColor.g) * this.colorWeight,
        b: this.startColor.b + (this.targetColor.b - this.startColor.b) * this.colorWeight,
      }
      this.targetColor = { r: 0, g: 0, b: 0 }
      this.colorWeight = 0
      this.isKilled = true
    }
  }

  private _randomPos(x: number, y: number, mag: number): Vector2D {
    const rx = Math.random() * 1000
    const ry = Math.random() * 500
    const d = { x: rx - x, y: ry - y }
    const m = Math.sqrt(d.x * d.x + d.y * d.y)
    if (m > 0) { d.x = (d.x / m) * mag; d.y = (d.y / m) * mag }
    return { x: x + d.x, y: y + d.y }
  }
}

interface ParticleTextEffectProps {
  words?: string[]
  className?: string
  height?: number
  bgColor?: string
  interval?: number
}

export function ParticleTextEffect({
  words = ["MÜƏLLIM", "PORTAL", "QUIZLƏR", "TESTLƏR"],
  className = "",
  height = 260,
  bgColor = "rgba(7,16,32,0.18)",
  interval = 220,
}: ParticleTextEffectProps) {
  const canvasRef   = useRef<HTMLCanvasElement>(null)
  const animRef     = useRef<number>()
  const particles   = useRef<Particle[]>([])
  const frameCount  = useRef(0)
  const wordIndex   = useRef(0)
  const mouse       = useRef({ x: 0, y: 0, pressed: false, right: false })
  const pixelSteps  = 6
  const drawAsPoints = true

  const genPos = (x: number, y: number, mag: number): Vector2D => {
    const rx = Math.random() * 1000
    const ry = Math.random() * 500
    const d  = { x: rx - x, y: ry - y }
    const m  = Math.sqrt(d.x * d.x + d.y * d.y)
    if (m > 0) { d.x = (d.x / m) * mag; d.y = (d.y / m) * mag }
    return { x: x + d.x, y: y + d.y }
  }

  const showWord = (word: string, canvas: HTMLCanvasElement) => {
    const off = document.createElement("canvas")
    off.width  = canvas.width
    off.height = canvas.height
    const octx = off.getContext("2d")!
    octx.fillStyle    = "white"
    octx.font         = `bold ${Math.floor(canvas.height * 0.38)}px Arial`
    octx.textAlign    = "center"
    octx.textBaseline = "middle"
    octx.fillText(word, canvas.width / 2, canvas.height / 2)

    const imgData = octx.getImageData(0, 0, canvas.width, canvas.height)
    const px      = imgData.data
    const newColor = {
      r: 80  + Math.random() * 100,
      g: 160 + Math.random() * 95,
      b: 200 + Math.random() * 55,
    }

    const list = particles.current
    let pi = 0
    const coords: number[] = []
    for (let i = 0; i < px.length; i += pixelSteps * 4) coords.push(i)
    for (let i = coords.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [coords[i], coords[j]] = [coords[j], coords[i]]
    }

    for (const ci of coords) {
      if (px[ci + 3] > 0) {
        const x = (ci / 4) % canvas.width
        const y = Math.floor(ci / 4 / canvas.width)
        let p: Particle
        if (pi < list.length) {
          p = list[pi]; p.isKilled = false; pi++
        } else {
          p = new Particle()
          const rp = genPos(canvas.width / 2, canvas.height / 2, (canvas.width + canvas.height) / 2)
          p.pos.x = rp.x; p.pos.y = rp.y
          p.maxSpeed       = Math.random() * 6 + 4
          p.maxForce       = p.maxSpeed * 0.05
          p.particleSize   = Math.random() * 6 + 6
          p.colorBlendRate = Math.random() * 0.0275 + 0.0025
          list.push(p)
        }
        p.startColor = {
          r: p.startColor.r + (p.targetColor.r - p.startColor.r) * p.colorWeight,
          g: p.startColor.g + (p.targetColor.g - p.startColor.g) * p.colorWeight,
          b: p.startColor.b + (p.targetColor.b - p.startColor.b) * p.colorWeight,
        }
        p.targetColor  = newColor
        p.colorWeight  = 0
        p.target.x = x; p.target.y = y
      }
    }
    for (let i = pi; i < list.length; i++) list[i].kill(canvas.width, canvas.height)
  }

  const animate = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx  = canvas.getContext("2d")!
    const list = particles.current

    ctx.fillStyle = bgColor
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    for (let i = list.length - 1; i >= 0; i--) {
      const p = list[i]
      p.move(); p.draw(ctx, drawAsPoints)
      if (p.isKilled && (p.pos.x < 0 || p.pos.x > canvas.width || p.pos.y < 0 || p.pos.y > canvas.height)) {
        list.splice(i, 1)
      }
    }

    if (mouse.current.pressed && mouse.current.right) {
      list.forEach((p) => {
        const d = Math.sqrt(Math.pow(p.pos.x - mouse.current.x, 2) + Math.pow(p.pos.y - mouse.current.y, 2))
        if (d < 50) p.kill(canvas.width, canvas.height)
      })
    }

    frameCount.current++
    if (frameCount.current % interval === 0) {
      wordIndex.current = (wordIndex.current + 1) % words.length
      showWord(words[wordIndex.current], canvas)
    }

    animRef.current = requestAnimationFrame(animate)
  }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const setSize = () => {
      canvas.width  = canvas.offsetWidth
      canvas.height = canvas.offsetHeight
      showWord(words[wordIndex.current], canvas)
    }

    setSize()
    animate()

    const onDown  = (e: MouseEvent) => {
      mouse.current.pressed = true
      mouse.current.right   = e.button === 2
      const r = canvas.getBoundingClientRect()
      mouse.current.x = e.clientX - r.left
      mouse.current.y = e.clientY - r.top
    }
    const onUp    = () => { mouse.current.pressed = false; mouse.current.right = false }
    const onMove  = (e: MouseEvent) => {
      const r = canvas.getBoundingClientRect()
      mouse.current.x = e.clientX - r.left
      mouse.current.y = e.clientY - r.top
    }
    const onCtx   = (e: MouseEvent) => e.preventDefault()
    const onResize = () => setSize()

    canvas.addEventListener("mousedown",    onDown)
    canvas.addEventListener("mouseup",      onUp)
    canvas.addEventListener("mousemove",    onMove)
    canvas.addEventListener("contextmenu",  onCtx)
    window.addEventListener("resize",       onResize)

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current)
      canvas.removeEventListener("mousedown",   onDown)
      canvas.removeEventListener("mouseup",     onUp)
      canvas.removeEventListener("mousemove",   onMove)
      canvas.removeEventListener("contextmenu", onCtx)
      window.removeEventListener("resize",      onResize)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ width: "100%", height: `${height}px`, display: "block" }}
    />
  )
}
