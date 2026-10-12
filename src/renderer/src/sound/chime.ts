let ctx: AudioContext | null = null

/** Soft two-note chime, like the one the car plays on every shift. */
export function playShiftChime(): void {
  try {
    ctx ??= new AudioContext()
    const t0 = ctx.currentTime + 0.01
    const notes: [number, number][] = [
      [1318.5, 0],
      [987.8, 0.11]
    ]
    for (const [freq, offset] of notes) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0.0001, t0 + offset)
      gain.gain.exponentialRampToValueAtTime(0.12, t0 + offset + 0.015)
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + offset + 0.45)
      osc.connect(gain).connect(ctx.destination)
      osc.start(t0 + offset)
      osc.stop(t0 + offset + 0.5)
    }
  } catch {
    // audio unavailable
  }
}
