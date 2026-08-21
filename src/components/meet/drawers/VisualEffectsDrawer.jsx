import React from 'react'
import {
  X,
  Sparkles,
  Ban,
  SunMedium,
  Palette,
  Check
} from 'lucide-react'

export const VisualEffectsDrawer = ({
  onClose,
  currentEffect = 'none',
  onSelectEffect,
  currentFilter = 'none',
  onSelectFilter
}) => {
  const backgrounds = [
    { id: 'none', label: 'No effect', type: 'none', preview: 'bg-gray-800' },
    { id: 'blur-sm', label: 'Slight blur', type: 'blur', preview: 'bg-gradient-to-r from-slate-700 to-slate-800 backdrop-blur-sm' },
    { id: 'blur-lg', label: 'Full blur', type: 'blur', preview: 'bg-gradient-to-r from-slate-600 to-slate-900 backdrop-blur-lg' },
    {
      id: 'office',
      label: 'Executive Office',
      type: 'image',
      url: 'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=400&q=80'
    },
    {
      id: 'living',
      label: 'Modern Loft',
      type: 'image',
      url: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=400&q=80'
    },
    {
      id: 'studio',
      label: 'Cyber Studio',
      type: 'image',
      url: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=400&q=80'
    },
    {
      id: 'beach',
      label: 'Tropical Sunset',
      type: 'image',
      url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=400&q=80'
    },
    {
      id: 'library',
      label: 'Cozy Library',
      type: 'image',
      url: 'https://images.unsplash.com/photo-1521587760476-6c12a4b040da?auto=format&fit=crop&w=400&q=80'
    }
  ]

  const filters = [
    { id: 'none', label: 'Natural' },
    { id: 'warm', label: 'Warm Glow', css: 'brightness(105%) contrast(105%) sepia(20%)' },
    { id: 'cool', label: 'Cool Bright', css: 'brightness(110%) hue-rotate(15deg)' },
    { id: 'noir', label: 'B&W Classic', css: 'grayscale(100%) contrast(120%)' },
    { id: 'vivid', label: 'Vivid Pop', css: 'saturate(130%) contrast(110%)' }
  ]

  return (
    <div className="w-80 md:w-96 bg-[#202124] text-white flex flex-col h-full border-l border-[#3c4043] shadow-2xl z-30 animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-5 border-b border-[#3c4043]">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-[#8ab4f8]" />
          <h2 className="text-lg font-medium text-white">Visual effects</h2>
        </div>
        <button
          onClick={onClose}
          className="p-2 text-gray-400 hover:text-white hover:bg-[#3c4043] rounded-full transition-colors"
          title="Close"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
        {/* Background Effects */}
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
            Backgrounds & Blur
          </h3>

          <div className="grid grid-cols-2 gap-3">
            {backgrounds.map((bg) => {
              const isSelected = currentEffect === bg.id

              return (
                <button
                  key={bg.id}
                  onClick={() => onSelectEffect(bg.id)}
                  className={`relative rounded-xl overflow-hidden aspect-video border-2 transition-all group flex flex-col items-center justify-end p-2 text-left ${
                    isSelected
                      ? 'border-[#8ab4f8] ring-2 ring-[#8ab4f8]/30 shadow-lg'
                      : 'border-[#3c4043] hover:border-gray-400'
                  }`}
                >
                  {/* Background display */}
                  {bg.url ? (
                    <img
                      src={bg.url}
                      alt={bg.label}
                      className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                  ) : (
                    <div className={`absolute inset-0 ${bg.preview} flex items-center justify-center`}>
                      {bg.id === 'none' && <Ban className="w-6 h-6 text-gray-400" />}
                      {bg.id.startsWith('blur') && <Sparkles className="w-6 h-6 text-gray-300" />}
                    </div>
                  )}

                  {/* Gradient overlay & label */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent pointer-events-none" />
                  <span className="relative z-10 text-[11px] font-medium text-white truncate w-full text-center">
                    {bg.label}
                  </span>

                  {isSelected && (
                    <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-[#8ab4f8] text-[#202124] flex items-center justify-center z-10 shadow">
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* Color & Lighting Filters */}
        <div className="space-y-3 pt-2 border-t border-[#3c4043]">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
            <Palette className="w-3.5 h-3.5 text-[#8ab4f8]" />
            Lighting & Style Filters
          </h3>

          <div className="grid grid-cols-2 gap-2">
            {filters.map((f) => {
              const isSelected = currentFilter === f.id

              return (
                <button
                  key={f.id}
                  onClick={() => onSelectFilter(f.id)}
                  className={`p-2.5 rounded-xl text-xs font-medium border text-left transition-colors flex items-center justify-between ${
                    isSelected
                      ? 'bg-[#8ab4f8]/20 border-[#8ab4f8] text-[#8ab4f8]'
                      : 'bg-[#28292c] border-[#3c4043] text-gray-300 hover:bg-[#323639]'
                  }`}
                >
                  <span>{f.label}</span>
                  {isSelected && <Check className="w-3.5 h-3.5" />}
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
