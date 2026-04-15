import { useEffect, useRef } from 'react'
import { useTheme } from '../App'

export default function ParticleBackground() {
  const canvasRef = useRef(null)
  const { theme } = useTheme()

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')

    function resize() {
      canvas.width  = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    // Generate particles — mix of tiny dots and slightly larger ones
    const count = Math.min(Math.floor((canvas.width * canvas.height) / 12000), 80)
    const particles = Array.from({ length: count }, () => ({
      x:   Math.random() * canvas.width,
      y:   Math.random() * canvas.height,
      r:   Math.random() * 1.4 + 0.3,
      vx:  (Math.random() - 0.5) * 0.18,
      vy:  (Math.random() - 0.5) * 0.18,
      opacity: Math.random() * 0.28 + 0.07,
      twinkle: Math.random() * Math.PI * 2,   // random phase offset
      twinkleSpeed: Math.random() * 0.015 + 0.006,
    }))

    const particleColor = theme === 'dark'
      ? (op) => `rgba(180,210,255,${op})`
      : (op) => `rgba(60,100,160,${op})`

    let raf
    let frame = 0

    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      particles.forEach(p => {
        // slow drift
        p.x += p.vx
        p.y += p.vy
        // twinkle phase
        p.twinkle += p.twinkleSpeed
        const twinkleMod = 0.5 + 0.5 * Math.sin(p.twinkle)

        // wrap around edges
        if (p.x < -2)              p.x = canvas.width + 2
        if (p.x > canvas.width + 2) p.x = -2
        if (p.y < -2)              p.y = canvas.height + 2
        if (p.y > canvas.height + 2) p.y = -2

        const effectiveOpacity = p.opacity * (0.6 + 0.4 * twinkleMod)

        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fillStyle = particleColor(effectiveOpacity)
        ctx.fill()
      })

      frame++
      raf = requestAnimationFrame(draw)
    }

    draw()

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
    }
  }, [theme])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 0,
      }}
    />
  )
}
