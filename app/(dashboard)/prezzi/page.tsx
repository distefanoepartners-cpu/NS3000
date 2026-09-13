// app/dashboard/prezzi/page.tsx
'use client'

import { useState, useRef, useEffect, useCallback } from 'react'

const TABS = [
  { id: 'locazione', label: '🚤 Locazione', image: '/images/listino-prezzi-2026.png' },
  { id: 'tour', label: '⚓ Tour Privati', image: '/images/listino-tour-2026.png' },
  { id: 'taxi', label: '🚕 Taxi', image: '/images/listino-taxi-2026.png' },
]

function ZoomableImage({ src, alt }: { src: string; alt: string }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const transformRef = useRef({ x: 0, y: 0, scale: 1 })
  const dragRef = useRef({ active: false, startX: 0, startY: 0, lastX: 0, lastY: 0 })
  const pinchRef = useRef({ active: false, startDist: 0, startScale: 1 })
  const [displayZoom, setDisplayZoom] = useState(100)

  const applyTransform = useCallback(() => {
    const el = containerRef.current?.querySelector('.zoomable-img') as HTMLElement
    if (!el) return
    const t = transformRef.current
    el.style.transform = `translate(${t.x}px, ${t.y}px) scale(${t.scale})`
    setDisplayZoom(Math.round(t.scale * 100))
  }, [])

  const resetView = useCallback(() => {
    transformRef.current = { x: 0, y: 0, scale: 1 }
    applyTransform()
  }, [applyTransform])

  const zoomTo = useCallback((newScale: number) => {
    transformRef.current.scale = Math.min(Math.max(newScale, 0.5), 5)
    applyTransform()
  }, [applyTransform])

  // Mount: registra tutti gli event listener nativi (non React)
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const getDistance = (t1: Touch, t2: Touch) => {
      const dx = t1.clientX - t2.clientX
      const dy = t1.clientY - t2.clientY
      return Math.sqrt(dx * dx + dy * dy)
    }

    // --- TOUCH START ---
    const onTouchStart = (e: TouchEvent) => {
      e.preventDefault()
      e.stopPropagation()

      if (e.touches.length === 1) {
        // Drag con un dito
        const t = transformRef.current
        dragRef.current = {
          active: true,
          startX: e.touches[0].clientX - t.x,
          startY: e.touches[0].clientY - t.y,
          lastX: t.x,
          lastY: t.y,
        }
        pinchRef.current.active = false
      } else if (e.touches.length === 2) {
        // Pinch zoom con due dita
        dragRef.current.active = false
        pinchRef.current = {
          active: true,
          startDist: getDistance(e.touches[0], e.touches[1]),
          startScale: transformRef.current.scale,
        }
      }
    }

    // --- TOUCH MOVE ---
    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault()
      e.stopPropagation()

      if (e.touches.length === 1 && dragRef.current.active) {
        const newX = e.touches[0].clientX - dragRef.current.startX
        const newY = e.touches[0].clientY - dragRef.current.startY
        transformRef.current.x = newX
        transformRef.current.y = newY

        const el = container.querySelector('.zoomable-img') as HTMLElement
        if (el) {
          el.style.transform = `translate(${newX}px, ${newY}px) scale(${transformRef.current.scale})`
        }
      } else if (e.touches.length === 2 && pinchRef.current.active) {
        const dist = getDistance(e.touches[0], e.touches[1])
        const ratio = dist / pinchRef.current.startDist
        const newScale = Math.min(Math.max(pinchRef.current.startScale * ratio, 0.5), 5)
        transformRef.current.scale = newScale

        const el = container.querySelector('.zoomable-img') as HTMLElement
        if (el) {
          el.style.transform = `translate(${transformRef.current.x}px, ${transformRef.current.y}px) scale(${newScale})`
        }
        setDisplayZoom(Math.round(newScale * 100))
      }
    }

    // --- TOUCH END ---
    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length === 0) {
        dragRef.current.active = false
        pinchRef.current.active = false
      } else if (e.touches.length === 1) {
        // Da pinch a drag
        pinchRef.current.active = false
        const t = transformRef.current
        dragRef.current = {
          active: true,
          startX: e.touches[0].clientX - t.x,
          startY: e.touches[0].clientY - t.y,
          lastX: t.x,
          lastY: t.y,
        }
      }
    }

    // --- MOUSE WHEEL (Desktop) ---
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const delta = e.deltaY > 0 ? -0.15 : 0.15
      const t = transformRef.current
      t.scale = Math.min(Math.max(t.scale + delta, 0.5), 5)

      const el = container.querySelector('.zoomable-img') as HTMLElement
      if (el) {
        el.style.transform = `translate(${t.x}px, ${t.y}px) scale(${t.scale})`
      }
      setDisplayZoom(Math.round(t.scale * 100))
    }

    // --- MOUSE DRAG (Desktop) ---
    let mouseDown = false
    let mStartX = 0, mStartY = 0

    const onMouseDown = (e: MouseEvent) => {
      mouseDown = true
      const t = transformRef.current
      mStartX = e.clientX - t.x
      mStartY = e.clientY - t.y
      container.style.cursor = 'grabbing'
    }

    const onMouseMove = (e: MouseEvent) => {
      if (!mouseDown) return
      const t = transformRef.current
      t.x = e.clientX - mStartX
      t.y = e.clientY - mStartY

      const el = container.querySelector('.zoomable-img') as HTMLElement
      if (el) {
        el.style.transform = `translate(${t.x}px, ${t.y}px) scale(${t.scale})`
      }
    }

    const onMouseUp = () => {
      mouseDown = false
      container.style.cursor = 'grab'
    }

    // Registra tutti i listener come NON-passive
    container.addEventListener('touchstart', onTouchStart, { passive: false })
    container.addEventListener('touchmove', onTouchMove, { passive: false })
    container.addEventListener('touchend', onTouchEnd)
    container.addEventListener('wheel', onWheel, { passive: false })
    container.addEventListener('mousedown', onMouseDown)
    container.addEventListener('mousemove', onMouseMove)
    container.addEventListener('mouseup', onMouseUp)
    container.addEventListener('mouseleave', onMouseUp)

    return () => {
      container.removeEventListener('touchstart', onTouchStart)
      container.removeEventListener('touchmove', onTouchMove)
      container.removeEventListener('touchend', onTouchEnd)
      container.removeEventListener('wheel', onWheel)
      container.removeEventListener('mousedown', onMouseDown)
      container.removeEventListener('mousemove', onMouseMove)
      container.removeEventListener('mouseup', onMouseUp)
      container.removeEventListener('mouseleave', onMouseUp)
    }
  }, [src])

  // Reset al cambio immagine
  useEffect(() => {
    transformRef.current = { x: 0, y: 0, scale: 1 }
    const el = containerRef.current?.querySelector('.zoomable-img') as HTMLElement
    if (el) el.style.transform = 'translate(0px, 0px) scale(1)'
    setDisplayZoom(100)
  }, [src])

  return (
    <div className="relative">
      {/* Controlli zoom */}
      <div className="flex items-center justify-end gap-1.5 mb-2">
        <button
          onClick={() => zoomTo(transformRef.current.scale - 0.5)}
          className="p-2 bg-white hover:bg-gray-100 active:bg-gray-200 rounded-lg border shadow-sm"
        >
          <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
          </svg>
        </button>

        <span className="text-sm font-mono text-gray-600 min-w-[48px] text-center bg-white px-1.5 py-1 rounded border">
          {displayZoom}%
        </span>

        <button
          onClick={() => zoomTo(transformRef.current.scale + 0.5)}
          className="p-2 bg-white hover:bg-gray-100 active:bg-gray-200 rounded-lg border shadow-sm"
        >
          <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>

        <button
          onClick={resetView}
          className="p-2 bg-white hover:bg-gray-100 active:bg-gray-200 rounded-lg border shadow-sm"
          title="Reset"
        >
          <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>

      {/* Container immagine */}
      <div
        ref={containerRef}
        className="overflow-hidden rounded-lg border border-gray-200 shadow-sm bg-white"
        style={{
          touchAction: 'none',
          cursor: 'grab',
          height: 'calc(100vh - 250px)',
          minHeight: '300px',
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          className="zoomable-img w-full h-auto object-contain select-none pointer-events-none"
          draggable={false}
          style={{
            transformOrigin: 'center center',
            willChange: 'transform',
          }}
        />
      </div>
    </div>
  )
}

export default function PrezziPage() {
  const [activeTab, setActiveTab] = useState('locazione')
  const currentTab = TABS.find(t => t.id === activeTab) || TABS[0]

  return (
    <div className="p-3 md:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <h1 className="text-xl md:text-2xl font-bold text-gray-800 mb-1">
        💰 Listino Prezzi 2026
      </h1>
      <p className="text-xs text-gray-500 mb-3">
        📱 Trascina con un dito · Pizzica con due dita per zoomare · Usa +/- per zoom rapido
      </p>

      {/* Tabs */}
      <div className="flex gap-1 mb-3 bg-gray-100 p-1 rounded-lg">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition ${
              activeTab === tab.id
                ? 'bg-white text-blue-700 shadow-sm'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Immagine zoomabile */}
      <ZoomableImage src={currentTab.image} alt={currentTab.label} />
    </div>
  )
}