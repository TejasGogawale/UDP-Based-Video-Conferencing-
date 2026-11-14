import React, { useEffect, useState } from 'react'
import { X, Settings, Mic, Video, Sliders, Play, Volume2 } from 'lucide-react'
import { sounds } from './utils/soundEffects'
import { levelToPercent } from '../../lib/media/audioLevels'
import { canSelectSpeaker } from '../../lib/media/localMedia'

const Select = ({ label, value, onChange, options, empty }) => (
  <label className="block space-y-1.5">
    <span className="text-xs font-semibold text-gray-300">{label}</span>
    <select
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      disabled={!options.length}
      className="w-full px-3 py-2.5 bg-[#28292c] border border-[#3c4043] rounded-xl text-base sm:text-sm text-white focus:outline-none focus:border-[#8ab4f8] disabled:opacity-60"
    >
      {!options.length && <option value="">{empty}</option>}
      {options.length > 0 && !options.some((d) => d.deviceId === value) && <option value="">System default</option>}
      {options.map((d, i) => (
        <option key={d.deviceId} value={d.deviceId}>{d.label || `${label} ${i + 1}`}</option>
      ))}
    </select>
  </label>
)

export const DeviceSettingsModal = ({ onClose, devices, selected, micLevel = 0, onSelectMic, onSelectCamera, onSelectSpeaker, onRefresh }) => {
  const [tab, setTab] = useState('audio')

  useEffect(() => {
    onRefresh?.()
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, onRefresh])

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
        onClick={(e) => e.stopPropagation()}
        className="bg-[#202124] text-white w-full sm:max-w-xl rounded-t-3xl sm:rounded-3xl border border-[#3c4043] shadow-2xl overflow-hidden flex flex-col max-h-[90dvh]"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#3c4043] bg-[#28292c]">
          <div className="flex items-center gap-2.5"><Settings className="w-5 h-5 text-[#8ab4f8]" /><h2 className="text-base sm:text-lg font-medium">Settings</h2></div>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-white hover:bg-[#3c4043] rounded-full" aria-label="Close settings"><X className="w-5 h-5" /></button>
        </div>

        <div className="flex flex-col sm:flex-row flex-1 min-h-0">
          <div className="sm:w-40 bg-[#28292c] sm:border-r border-b sm:border-b-0 border-[#3c4043] p-2 flex sm:flex-col gap-1 shrink-0">
            {[{ id: 'audio', label: 'Audio', icon: Mic }, { id: 'video', label: 'Video', icon: Video }, { id: 'general', label: 'General', icon: Sliders }].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`flex-1 sm:flex-none flex items-center justify-center sm:justify-start gap-2 px-3 py-2.5 rounded-xl text-xs font-semibold ${tab === id ? 'bg-[#8ab4f8]/20 text-[#8ab4f8]' : 'text-gray-400 hover:text-white hover:bg-[#3c4043]/50'}`}
              >
                <Icon className="w-4 h-4" /> {label}
              </button>
            ))}
          </div>

          <div className="flex-1 p-4 sm:p-6 space-y-5 overflow-y-auto min-h-0 pb-[calc(1rem+env(safe-area-inset-bottom))]">
            {tab === 'audio' && (
              <>
                <Select label="Microphone" value={selected.mic} onChange={onSelectMic} options={devices.microphones} empty="No microphone found" />
                <div className="flex items-center gap-3">
                  <span className="text-[11px] text-gray-400 w-20">Input level</span>
                  <div className="flex-1 h-2 bg-[#28292c] rounded-full overflow-hidden border border-[#3c4043]">
                    <div className="h-full bg-[#81c995] transition-all duration-150" style={{ width: `${levelToPercent(micLevel)}%` }} />
                  </div>
                </div>
                {canSelectSpeaker() ? (
                  <div className="flex items-end gap-2">
                    <div className="flex-1"><Select label="Speakers" value={selected.speaker} onChange={onSelectSpeaker} options={devices.speakers} empty="System default" /></div>
                    <button onClick={() => sounds.playJoinChime()} className="px-4 py-2.5 bg-[#3c4043] hover:bg-[#4a4e52] text-xs font-semibold rounded-xl text-[#8ab4f8] flex items-center gap-1.5"><Play className="w-3.5 h-3.5" /> Test</button>
                  </div>
                ) : (
                  <div className="p-3 bg-[#28292c] rounded-xl border border-[#3c4043] text-xs text-gray-400 flex items-start gap-2">
                    <Volume2 className="w-4 h-4 shrink-0" />
                    This browser plays call audio through the system's current output device. Change it in your device settings.
                  </div>
                )}
                <p className="text-[11px] text-gray-500">Echo cancellation and noise suppression are always on.</p>
              </>
            )}
            {tab === 'video' && (
              <>
                <Select label="Camera" value={selected.cam} onChange={onSelectCamera} options={devices.cameras} empty="No camera found" />
                <p className="text-[11px] text-gray-500">Video quality adapts to the number of participants: up to 720p in small calls, reduced automatically in larger ones.</p>
              </>
            )}
            {tab === 'general' && (
              <div className="p-3 bg-[#28292c] rounded-xl border border-[#3c4043] space-y-2 text-xs">
                <p className="font-semibold">Keyboard shortcuts</p>
                <p className="text-gray-400"><kbd className="px-1.5 py-0.5 bg-[#202124] rounded border border-[#3c4043] text-white">Ctrl/⌘ + D</kbd> Microphone</p>
                <p className="text-gray-400"><kbd className="px-1.5 py-0.5 bg-[#202124] rounded border border-[#3c4043] text-white">Ctrl/⌘ + E</kbd> Camera</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
