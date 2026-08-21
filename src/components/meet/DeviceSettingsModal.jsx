import React, { useState, useEffect } from 'react'
import {
  X,
  Settings,
  Mic,
  Video,
  Volume2,
  Sliders,
  CheckCircle,
  Play
} from 'lucide-react'
import { sounds } from './utils/soundEffects'

export const DeviceSettingsModal = ({
  onClose,
  currentVideoDevice,
  currentAudioDevice,
  onSelectVideoDevice,
  onSelectAudioDevice
}) => {
  const [activeTab, setActiveTab] = useState('audio') // 'audio' | 'video' | 'general'
  const [audioDevices, setAudioDevices] = useState([])
  const [videoDevices, setVideoDevices] = useState([])
  const [audioLevel, setAudioLevel] = useState(0)
  const [noiseCancel, setNoiseCancel] = useState(true)
  const [sendResolution, setSendResolution] = useState('720p')

  useEffect(() => {
    // Enumerate connected multimedia hardware devices
    if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
      navigator.mediaDevices.enumerateDevices().then(devices => {
        const audioInputs = devices.filter(d => d.kind === 'audioinput')
        const videoInputs = devices.filter(d => d.kind === 'videoinput')
        setAudioDevices(audioInputs)
        setVideoDevices(videoInputs)
      }).catch(err => console.warn('Device enumeration error:', err))
    }

    // Simulate animated audio meter
    const interval = setInterval(() => {
      setAudioLevel(Math.random() * 60 + 20)
    }, 150)
    return () => clearInterval(interval)
  }, [])

  const handleTestSpeaker = () => {
    sounds.playJoinChime()
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4">
      <div className="bg-[#202124] text-white w-full max-w-xl rounded-2xl sm:rounded-3xl border border-[#3c4043] shadow-2xl overflow-hidden flex flex-col max-h-[90dvh] animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-3.5 sm:py-4 border-b border-[#3c4043] bg-[#28292c]">
          <div className="flex items-center gap-2.5">
            <Settings className="w-5 h-5 text-[#8ab4f8]" />
            <h2 className="text-base sm:text-lg font-medium text-white">Settings</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-white hover:bg-[#3c4043] rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Layout: Responsive Tabs + Content */}
        <div className="flex flex-col sm:flex-row flex-1 min-h-0 overflow-hidden">
          {/* Top/Left Navigation Tabs */}
          <div className="sm:w-44 bg-[#28292c] sm:border-r border-b sm:border-b-0 border-[#3c4043] p-2 sm:p-3 flex sm:flex-col gap-1 overflow-x-auto shrink-0">
            {[
              { id: 'audio', label: 'Audio', icon: Mic },
              { id: 'video', label: 'Video', icon: Video },
              { id: 'general', label: 'General', icon: Sliders }
            ].map(tab => {
              const Icon = tab.icon
              const isSelected = activeTab === tab.id

              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 sm:flex-none flex items-center justify-center sm:justify-start gap-2 sm:gap-3 px-3 py-2 sm:py-2.5 rounded-xl text-xs font-semibold transition-colors ${
                    isSelected
                      ? 'bg-[#8ab4f8]/20 text-[#8ab4f8]'
                      : 'text-gray-400 hover:text-white hover:bg-[#3c4043]/50'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                </button>
              )
            })}
          </div>

          {/* Right/Bottom Content */}
          <div className="flex-1 p-4 sm:p-6 space-y-5 sm:space-y-6 overflow-y-auto min-h-0">
            {activeTab === 'audio' && (
              <div className="space-y-5 sm:space-y-6">
                {/* Microphone */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-gray-300 block">Microphone</label>
                  <select
                    className="w-full px-3.5 py-2.5 bg-[#28292c] border border-[#3c4043] rounded-xl text-xs text-white focus:outline-none focus:border-[#8ab4f8]"
                    onChange={(e) => onSelectAudioDevice && onSelectAudioDevice(e.target.value)}
                  >
                    {audioDevices.length > 0 ? (
                      audioDevices.map((d, i) => (
                        <option key={d.deviceId || i} value={d.deviceId}>{d.label || `Microphone ${i+1}`}</option>
                      ))
                    ) : (
                      <option>Default System Microphone</option>
                    )}
                  </select>

                  {/* Audio visualizer test meter */}
                  <div className="pt-1 flex items-center gap-3">
                    <span className="text-[11px] text-gray-400">Input Level:</span>
                    <div className="flex-1 h-2 bg-[#28292c] rounded-full overflow-hidden border border-[#3c4043]">
                      <div
                        className="h-full bg-gradient-to-r from-green-500 via-yellow-500 to-green-400 transition-all duration-100"
                        style={{ width: `${audioLevel}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Speakers */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-gray-300 block">Speakers</label>
                  <div className="flex gap-2">
                    <select className="flex-1 px-3.5 py-2.5 bg-[#28292c] border border-[#3c4043] rounded-xl text-xs text-white focus:outline-none focus:border-[#8ab4f8]">
                      <option>Default System Speakers</option>
                    </select>
                    <button
                      onClick={handleTestSpeaker}
                      className="px-4 py-2 bg-[#3c4043] hover:bg-[#4a4e52] text-xs font-semibold rounded-xl text-[#8ab4f8] flex items-center gap-1.5 transition-colors shrink-0"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" /> Test
                    </button>
                  </div>
                </div>

                {/* Noise Cancellation */}
                <div className="flex items-center justify-between p-3 bg-[#28292c] rounded-xl border border-[#3c4043]">
                  <div>
                    <p className="text-xs font-semibold text-white">Noise cancellation</p>
                    <p className="text-[11px] text-gray-400">Filters out sound that isn't speech</p>
                  </div>
                  <button
                    onClick={() => setNoiseCancel(!noiseCancel)}
                    className={`w-10 h-5 rounded-full transition-colors relative ${
                      noiseCancel ? 'bg-[#8ab4f8]' : 'bg-gray-600'
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded-full bg-white absolute top-0.5 transition-transform ${
                        noiseCancel ? 'right-0.5' : 'left-0.5'
                      }`}
                    />
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'video' && (
              <div className="space-y-5 sm:space-y-6">
                {/* Camera */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-gray-300 block">Camera</label>
                  <select
                    className="w-full px-3.5 py-2.5 bg-[#28292c] border border-[#3c4043] rounded-xl text-xs text-white focus:outline-none focus:border-[#8ab4f8]"
                    onChange={(e) => onSelectVideoDevice && onSelectVideoDevice(e.target.value)}
                  >
                    {videoDevices.length > 0 ? (
                      videoDevices.map((d, i) => (
                        <option key={d.deviceId || i} value={d.deviceId}>{d.label || `Camera ${i+1}`}</option>
                      ))
                    ) : (
                      <option>Default Camera</option>
                    )}
                  </select>
                </div>

                {/* Send Resolution */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-gray-300 block">Send resolution (maximum)</label>
                  <select
                    value={sendResolution}
                    onChange={(e) => setSendResolution(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[#28292c] border border-[#3c4043] rounded-xl text-xs text-white focus:outline-none focus:border-[#8ab4f8]"
                  >
                    <option value="1080p">High definition (1080p)</option>
                    <option value="720p">High definition (720p)</option>
                    <option value="360p">Standard definition (360p)</option>
                    <option value="auto">Auto (Adaptive)</option>
                  </select>
                </div>
              </div>
            )}

            {activeTab === 'general' && (
              <div className="space-y-4 text-xs text-gray-300">
                <div className="p-3 bg-[#28292c] rounded-xl border border-[#3c4043] space-y-1.5">
                  <p className="font-semibold text-white">Keyboard Shortcuts</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-gray-400 text-[11px] pt-1">
                    <p><kbd className="px-1.5 py-0.5 bg-[#202124] rounded border border-[#3c4043] text-white">Ctrl+D</kbd> Toggle Mic</p>
                    <p><kbd className="px-1.5 py-0.5 bg-[#202124] rounded border border-[#3c4043] text-white">Ctrl+E</kbd> Toggle Camera</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-3.5 sm:p-4 border-t border-[#3c4043] bg-[#28292c] flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-[#8ab4f8] hover:bg-[#aecbfa] text-[#202124] text-xs font-bold rounded-xl transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
