// Media Fallback & Synthetic Video Generator for Multi-Tab Local Testing
// Solves Windows / OS Single-Camera Hardware Lock (NotReadableError)

export const createSyntheticVideoTrack = (userName = 'User') => {
  if (typeof document === 'undefined') return null

  const canvas = document.createElement('canvas')
  canvas.width = 640
  canvas.height = 480
  const ctx = canvas.getContext('2d')
  let frame = 0

  const draw = () => {
    frame++
    // Animated ambient gradient
    const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height)
    const hue1 = (frame * 1.5) % 360
    const hue2 = (frame * 1.5 + 140) % 360
    gradient.addColorStop(0, `hsl(${hue1}, 65%, 35%)`)
    gradient.addColorStop(1, `hsl(${hue2}, 65%, 18%)`)
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // Center Avatar Disc
    ctx.fillStyle = 'rgba(255, 255, 255, 0.15)'
    ctx.beginPath()
    ctx.arc(canvas.width / 2, canvas.height / 2 - 20, 70, 0, Math.PI * 2)
    ctx.fill()

    // Avatar Initial
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 42px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(userName ? userName.charAt(0).toUpperCase() : 'U', canvas.width / 2, canvas.height / 2 - 20)

    // Subtitle Badge
    ctx.font = 'bold 16px sans-serif'
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)'
    ctx.fillText(`${userName}`, canvas.width / 2, canvas.height / 2 + 80)

    ctx.font = '13px monospace'
    ctx.fillStyle = 'rgba(255, 255, 255, 0.65)'
    ctx.fillText(`Development test pattern • ${new Date().toLocaleTimeString()}`, canvas.width / 2, canvas.height / 2 + 110)

    requestAnimationFrame(draw)
  }
  draw()

  const videoStream = canvas.captureStream(30)
  return videoStream.getVideoTracks()[0]
}
