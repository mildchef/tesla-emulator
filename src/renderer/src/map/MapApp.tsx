import { useEffect, useRef } from 'react'
import { Map as MapLibre, Marker, setWorkerUrl } from 'maplibre-gl'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { CarLocation } from '@shared/types'
import { useStore } from '../state/store'
import { RouteIcon, Search } from '../icons'
import styles from './MapApp.module.css'

setWorkerUrl(workerUrl)

/** Free, key-less vector basemaps that resemble the car's dark/light map styles. */
const STYLES = {
  dark: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
  light: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json'
}

function carArrow(): HTMLElement {
  const el = document.createElement('div')
  el.className = styles.car
  el.innerHTML =
    '<svg viewBox="0 0 40 40" width="46" height="46"><path d="M20 4 33 34 20 27 7 34z" fill="#e82127" stroke="#fff" stroke-width="2.4" stroke-linejoin="round"/></svg>'
  return el
}

/**
 * Finds where "the car" is: the Mac's location services first, then a one-off
 * IP lookup. The result becomes the car's GPS position, which the browser
 * guest also receives through geolocation emulation.
 */
async function locate(): Promise<CarLocation | null> {
  const fromGps = await new Promise<CarLocation | null>((resolve) => {
    if (!navigator.geolocation) return resolve(null)
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy, heading: 0, source: 'gps' }),
      () => resolve(null),
      { timeout: 8000, maximumAge: 600_000 }
    )
  })
  if (fromGps) return fromGps
  try {
    const r = await fetch('https://ipapi.co/json/')
    const j = (await r.json()) as { latitude?: number; longitude?: number }
    if (typeof j.latitude === 'number' && typeof j.longitude === 'number') {
      return { lat: j.latitude, lng: j.longitude, accuracy: 5000, heading: 0, source: 'ip' }
    }
  } catch {
    // offline
  }
  return null
}

export function MapApp() {
  const container = useRef<HTMLDivElement>(null)
  const map = useRef<MapLibre | null>(null)
  const marker = useRef<Marker | null>(null)
  const theme = useStore((s) => s.settings.theme)
  const location = useStore((s) => s.vehicle.location)
  const rightApp = useStore((s) => s.rightApp)

  // Create the map once (skipped when WebGL is unavailable; the pane keeps its plain background).
  useEffect(() => {
    if (!container.current) return
    const loc = useStore.getState().vehicle.location
    let m: MapLibre
    try {
      m = new MapLibre({
        container: container.current,
        style: STYLES[useStore.getState().settings.theme],
        center: [loc.lng, loc.lat],
        zoom: 13.5,
        attributionControl: { compact: true },
        pitchWithRotate: false,
        fadeDuration: 0
      })
    } catch (err) {
      console.warn('[map] unavailable:', err)
      return
    }
    m.on('contextmenu', (e) => {
      // Long-press / right-click places the car.
      useStore.getState().patchVehicle({
        location: { lat: e.lngLat.lat, lng: e.lngLat.lng, accuracy: 5, heading: 0, source: 'manual' }
      })
    })
    marker.current = new Marker({ element: carArrow(), rotationAlignment: 'map' }).setLngLat([loc.lng, loc.lat]).addTo(m)
    map.current = m

    if (loc.source === 'default') {
      void locate().then((found) => {
        if (found && useStore.getState().vehicle.location.source === 'default') {
          useStore.getState().patchVehicle({ location: found })
        }
      })
    }
    return () => {
      m.remove()
      map.current = null
    }
  }, [])

  useEffect(() => {
    map.current?.setStyle(STYLES[theme])
  }, [theme])

  useEffect(() => {
    marker.current?.setLngLat([location.lng, location.lat]).setRotation(location.heading)
    map.current?.easeTo({ center: [location.lng, location.lat], duration: 600 })
  }, [location])

  // The map is laid out behind the browser; resize when it becomes visible.
  useEffect(() => {
    map.current?.resize()
  }, [rightApp])

  return (
    <div className={styles.map} data-testid="map">
      <div ref={container} className={styles.canvas} />
      <div className={styles.search}>
        <Search size={26} />
        <span>Navigate</span>
      </div>
      <button
        className={styles.recenter}
        aria-label="Recenter"
        onClick={() => {
          const l = useStore.getState().vehicle.location
          map.current?.easeTo({ center: [l.lng, l.lat], zoom: 14, bearing: 0 })
        }}
      >
        <RouteIcon size={32} />
      </button>
    </div>
  )
}
