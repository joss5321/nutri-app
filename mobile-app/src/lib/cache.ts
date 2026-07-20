import AsyncStorage from '@react-native-async-storage/async-storage'

const PREFIX = 'apicache:'
const TTL = 12 * 60 * 60 * 1000 // 12 hours

type Entry<T> = { data: T; ts: number }

export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(PREFIX + key)
    if (!raw) return null
    const entry: Entry<T> = JSON.parse(raw)
    if (Date.now() - entry.ts > TTL) return null
    return entry.data
  } catch {
    return null
  }
}

export async function cacheSet<T>(key: string, data: T): Promise<void> {
  try {
    const entry: Entry<T> = { data, ts: Date.now() }
    await AsyncStorage.setItem(PREFIX + key, JSON.stringify(entry))
  } catch {}
}

export async function cacheInvalidate(key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(PREFIX + key)
  } catch {}
}

export async function withCache<T>(
  key: string,
  fetcher: () => Promise<T>,
): Promise<T> {
  try {
    const result = await fetcher()
    await cacheSet(key, result)
    return result
  } catch (err) {
    const cached = await cacheGet<T>(key)
    if (cached !== null) return cached
    throw err
  }
}
