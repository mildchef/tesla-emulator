/** Model 3 Highland paint options (approximate sRGB values). */
export interface Paint {
  id: string
  name: string
  swatch: string
  color: string
  metalness: number
  roughness: number
}

export const PAINTS: Paint[] = [
  { id: 'stealth-grey', name: 'Stealth Grey', swatch: '#5b6067', color: '#4e545b', metalness: 0.45, roughness: 0.38 },
  { id: 'diamond-black', name: 'Diamond Black', swatch: '#141518', color: '#0a0b0d', metalness: 0.65, roughness: 0.32 },
  { id: 'pearl-white', name: 'Pearl White', swatch: '#ecebe7', color: '#dedcd6', metalness: 0.08, roughness: 0.32 },
  { id: 'ultra-red', name: 'Ultra Red', swatch: '#9e1b25', color: '#8a1520', metalness: 0.5, roughness: 0.28 },
  { id: 'deep-blue', name: 'Deep Blue Metallic', swatch: '#1f3863', color: '#1a2f55', metalness: 0.6, roughness: 0.3 },
  { id: 'quicksilver', name: 'Quicksilver', swatch: '#a9adb2', color: '#9a9ea4', metalness: 0.75, roughness: 0.25 }
]

export function getPaint(id: string): Paint {
  return PAINTS.find((p) => p.id === id) ?? PAINTS[0]
}
