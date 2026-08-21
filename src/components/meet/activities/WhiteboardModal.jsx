import React, { useState, useRef, useEffect } from 'react'
import {
  X,
  PenTool,
  Eraser,
  Trash2,
  Download,
  RotateCcw,
  Palette,
  Maximize2,
  Minimize2
} from 'lucide-react'

export const WhiteboardModal = ({
  onClose,
  strokes = [],
  onDrawStroke,
  onClearWhiteboard
}) => {
  const canvasRef = useRef(null)
  const isDrawingRef = useRef(false)
  const [tool, setTool] = useState('pen') // 'pen' | 'highlighter' | 'eraser'
  const [color, setColor] = useState('#8ab4f8')
  const [strokeWidth, setStrokeWidth] = useState(3)
  const [isFullscreen, setIsFullscreen] = useState(false)

  const colors = ['#ffffff', '#8ab4f8', '#ea4335', '#34a853', '#fbbc04', '#ff7849', '#c58af9']

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')

    // Handle canvas dimensions with Retina/HiDPI scaling
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * 2
    canvas.height = rect.height * 2
    ctx.scale(2, 2)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    // Redraw all strokes
    redrawCanvas()
  }, [])

  useEffect(() => {
    redrawCanvas()
  }, [strokes])

  const redrawCanvas = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')

    // Clear
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Render strokes
    strokes.forEach(stroke => {
      ctx.beginPath()
      ctx.strokeStyle = stroke.tool === 'eraser' ? '#1e1e1e' : stroke.color
      ctx.lineWidth = stroke.width
      ctx.globalAlpha = stroke.tool === 'highlighter' ? 0.35 : 1.0

      if (stroke.points && stroke.points.length > 0) {
        ctx.moveTo(stroke.points[0].x, stroke.points[0].y)
        for (let i = 1; i < stroke.points.length; i++) {
          ctx.lineTo(stroke.points[i].x, stroke.points[i].y)
        }
        ctx.stroke()
      }
    })
    ctx.globalAlpha = 1.0
  }

  const currentPointsRef = useRef([])

  const getCoordinates = (e) => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()

    let clientX, clientY
    if (e.touches && e.touches.length > 0) {
      clientX = e.touches[0].clientX
      clientY = e.touches[0].clientY
    } else {
      clientX = e.clientX
      clientY = e.clientY
    }

    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    }
  }

  const startDrawing = (e) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const { x, y } = getCoordinates(e)

    isDrawingRef.current = true
    currentPointsRef.current = [{ x, y }]

    const ctx = canvas.getContext('2d')
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.strokeStyle = tool === 'eraser' ? '#1e1e1e' : color
    ctx.lineWidth = tool === 'highlighter' ? strokeWidth * 4 : strokeWidth
    ctx.globalAlpha = tool === 'highlighter' ? 0.35 : 1.0
  }

  const draw = (e) => {
    if (!isDrawingRef.current) return
    const canvas = canvasRef.current
    if (!canvas) return
    const { x, y } = getCoordinates(e)

    currentPointsRef.current.push({ x, y })

    const ctx = canvas.getContext('2d')
    ctx.lineTo(x, y)
    ctx.stroke()
  }

  const stopDrawing = () => {
    if (!isDrawingRef.current) return
    isDrawingRef.current = false

    if (currentPointsRef.current.length > 0) {
      const newStroke = {
        tool,
        color: tool === 'eraser' ? '#1e1e1e' : color,
        width: tool === 'highlighter' ? strokeWidth * 4 : strokeWidth,
        points: currentPointsRef.current
      }
      onDrawStroke && onDrawStroke(newStroke)
    }
    currentPointsRef.current = []
  }

  const handleExportImage = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const image = canvas.toDataURL('image/png')
    const link = document.createElement('a')
    link.download = `whiteboard-${Date.now()}.png`
    link.href = image
    link.click()
  }

  return (
    <div className={`fixed inset-0 bg-black/70 backdrop-blur-md z-50 flex items-center justify-center p-2 sm:p-4 ${isFullscreen ? 'p-0' : ''}`}>
      <div className={`bg-[#202124] text-white rounded-2xl sm:rounded-3xl border border-[#3c4043] shadow-2xl flex flex-col overflow-hidden transition-all ${
        isFullscreen ? 'w-full h-full rounded-none border-none' : 'w-full max-w-4xl h-[90dvh] sm:h-[80vh]'
      }`}>
        {/* Top Controls Bar */}
        <div className="px-3 sm:px-6 py-2.5 sm:py-3 border-b border-[#3c4043] flex flex-wrap items-center justify-between gap-2 bg-[#28292c]">
          <div className="flex items-center gap-2">
            <PenTool className="w-4 h-4 sm:w-5 sm:h-5 text-[#8ab4f8]" />
            <h3 className="text-xs sm:text-sm font-semibold text-white">Whiteboard</h3>
          </div>

          {/* Tools Palette */}
          <div className="flex items-center gap-1 sm:gap-1.5 bg-[#202124] px-1.5 sm:px-2 py-1 rounded-xl border border-[#3c4043] overflow-x-auto max-w-full">
            {/* Pen */}
            <button
              onClick={() => setTool('pen')}
              className={`p-1.5 sm:p-2 rounded-lg transition-colors ${
                tool === 'pen' ? 'bg-[#8ab4f8] text-[#202124]' : 'text-gray-400 hover:text-white'
              }`}
              title="Pen"
            >
              <PenTool className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>

            {/* Eraser */}
            <button
              onClick={() => setTool('eraser')}
              className={`p-1.5 sm:p-2 rounded-lg transition-colors ${
                tool === 'eraser' ? 'bg-[#8ab4f8] text-[#202124]' : 'text-gray-400 hover:text-white'
              }`}
              title="Eraser"
            >
              <Eraser className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>

            {/* Colors */}
            <div className="h-4 sm:h-5 w-[1px] bg-[#3c4043] mx-0.5 sm:mx-1" />
            <div className="flex items-center gap-1">
              {colors.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={`w-4 h-4 sm:w-5 sm:h-5 rounded-full transition-transform ${
                    color === c ? 'scale-125 ring-2 ring-white' : 'hover:scale-110'
                  }`}
                  style={{ backgroundColor: c }}
                  title={c}
                />
              ))}
            </div>

            {/* Stroke Width Slider */}
            <div className="h-4 sm:h-5 w-[1px] bg-[#3c4043] mx-0.5 sm:mx-1 hidden sm:block" />
            <input
              type="range"
              min="2"
              max="12"
              value={strokeWidth}
              onChange={(e) => setStrokeWidth(Number(e.target.value))}
              className="w-12 sm:w-16 h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-[#8ab4f8] hidden sm:block"
              title="Brush Size"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 sm:gap-1.5 ml-auto">
            <button
              onClick={onClearWhiteboard}
              className="p-1.5 sm:p-2 text-gray-400 hover:text-red-400 hover:bg-[#3c4043] rounded-lg transition-colors"
              title="Clear Canvas"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              onClick={handleExportImage}
              className="p-1.5 sm:p-2 text-gray-400 hover:text-[#8ab4f8] hover:bg-[#3c4043] rounded-lg transition-colors"
              title="Export PNG"
            >
              <Download className="w-4 h-4" />
            </button>
            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="hidden sm:flex p-1.5 sm:p-2 text-gray-400 hover:text-white hover:bg-[#3c4043] rounded-lg transition-colors"
              title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
            <button
              onClick={onClose}
              className="p-1.5 sm:p-2 text-gray-400 hover:text-white hover:bg-[#3c4043] rounded-lg transition-colors"
            >
              <X className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          </div>
        </div>

        {/* Canvas Area */}
        <div className="flex-1 bg-[#1e1e1e] relative overflow-hidden cursor-crosshair touch-none select-none">
          <canvas
            ref={canvasRef}
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onTouchStart={(e) => {
              e.preventDefault()
              startDrawing(e)
            }}
            onTouchMove={(e) => {
              e.preventDefault()
              draw(e)
            }}
            onTouchEnd={(e) => {
              e.preventDefault()
              stopDrawing()
            }}
            onTouchCancel={(e) => {
              e.preventDefault()
              stopDrawing()
            }}
            className="w-full h-full block touch-none"
          />
        </div>
      </div>
    </div>
  )
}
