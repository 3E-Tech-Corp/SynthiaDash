import { useState, useEffect, useCallback } from 'react'

const ANIMATIONS = [
  'logo-animate-pulse',
  'logo-animate-wiggle',
  'logo-animate-bounce-spin',
  'logo-animate-glitch',
]

interface AnimatedLogoProps {
  className?: string
  interval?: number // ms between animations (default 8000)
}

export default function AnimatedLogo({ className = 'h-10', interval = 8000 }: AnimatedLogoProps) {
  const [animClass, setAnimClass] = useState('')

  const triggerAnimation = useCallback(() => {
    const anim = ANIMATIONS[Math.floor(Math.random() * ANIMATIONS.length)]
    setAnimClass(anim)
    // Remove class after animation completes so it can re-trigger
    setTimeout(() => setAnimClass(''), 1200)
  }, [])

  useEffect(() => {
    // Initial animation after a short delay
    const initTimeout = setTimeout(triggerAnimation, 2000)
    // Recurring animations
    const timer = setInterval(triggerAnimation, interval)
    return () => {
      clearTimeout(initTimeout)
      clearInterval(timer)
    }
  }, [triggerAnimation, interval])

  return (
    <img
      src="/images/synthia-logo.png?v=2"
      alt="Synthia"
      className={`${className} ${animClass} cursor-pointer`}
      style={{ willChange: 'transform, filter' }}
      onClick={triggerAnimation}
    />
  )
}
