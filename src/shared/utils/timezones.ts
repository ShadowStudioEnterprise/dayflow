import fallbackZones from './timezone-data'

let cached: string[] | undefined

export function supportedTimezones() {
  if (!cached) {
    const zones =
      typeof Intl.supportedValuesOf === 'function'
        ? Intl.supportedValuesOf('timeZone')
        : fallbackZones.filter((timeZone) => {
            try {
              new Intl.DateTimeFormat('en', { timeZone })
              return true
            } catch {
              return false
            }
          })
    cached = [...new Set(['UTC', ...zones])]
  }
  return cached
}
