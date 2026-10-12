import { useState } from 'react'
import { Equalizer, Heart, Next, Pause, Play, Prev, Repeat, Search, Shuffle } from '../icons'
import styles from './MediaCard.module.css'

export function MediaCard() {
  const [playing, setPlaying] = useState(true)
  return (
    <div className={styles.card}>
      <div className={styles.top}>
        <div className={styles.art} />
        <div className={styles.meta}>
          <b>Under the Bridge</b>
          <span>Heathered Pearls</span>
        </div>
        <Shuffle size={34} className={styles.dim} />
        <Repeat size={34} className={styles.dim} />
      </div>
      <div className={styles.progress}>
        <i style={{ width: '26%' }} />
      </div>
      <div className={styles.controls}>
        <Prev size={34} />
        <button onClick={() => setPlaying((p) => !p)} aria-label={playing ? 'Pause' : 'Play'}>
          {playing ? <Pause size={34} /> : <Play size={34} />}
        </button>
        <Next size={34} />
        <Heart size={32} />
        <Equalizer size={34} />
        <Search size={32} />
      </div>
    </div>
  )
}
