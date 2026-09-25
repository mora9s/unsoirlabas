/** Keep Pacific crossings together instead of stretching them across the map. */
export function routeLongitudeOrigin(longitudes: number[]): number {
  if (!longitudes.length) return 0
  const sorted = [...longitudes].map(lon => ((lon % 360) + 360) % 360).sort((a,b) => a-b)
  let largestGap = -1, start = sorted[0]
  for (let index = 0; index < sorted.length; index++) {
    const next = sorted[(index + 1) % sorted.length] + (index === sorted.length - 1 ? 360 : 0)
    if (next - sorted[index] > largestGap) { largestGap = next - sorted[index]; start = next % 360 }
  }
  const center = start + (360 - largestGap) / 2
  return ((center + 180) % 360) - 180
}

export function nearLongitude(longitude: number, origin: number): number {
  return origin + ((longitude - origin + 540) % 360) - 180
}
