import { EventEmitter } from 'node:events'
import type { CarLocation, Gear, VehicleState } from '../shared/types'

/** Tesla HQ, Austin — used until a real location is known. */
const DEFAULT_LOCATION: CarLocation = {
  lat: 30.2222,
  lng: -97.6167,
  accuracy: 50,
  heading: 0,
  source: 'default'
}

type Events = { change: [VehicleState, VehicleState] }

/** Single source of truth for vehicle state; the UI and guest frames mirror it. */
class Vehicle extends EventEmitter<Events> {
  private state: VehicleState = {
    gear: 'P',
    locked: true,
    frunkOpen: false,
    trunkOpen: false,
    speedMph: 0,
    location: DEFAULT_LOCATION
  }

  get(): VehicleState {
    return this.state
  }

  get parked(): boolean {
    return this.state.gear === 'P'
  }

  setGear(gear: Gear): void {
    this.patch({ gear })
  }

  patch(patch: Partial<VehicleState>): void {
    const prev = this.state
    const next = { ...prev, ...patch }
    // Frunk and trunk only open in Park; the emulator closes them when you shift.
    if (next.gear !== 'P') {
      next.frunkOpen = false
      next.trunkOpen = false
    }
    if (JSON.stringify(next) === JSON.stringify(prev)) return
    this.state = next
    this.emit('change', next, prev)
  }
}

export const vehicle = new Vehicle()
