import { afterEach, expect, it, vi } from 'vitest'
import { throwIfAborted, withAbortTimeout } from './abort'

afterEach(() => vi.useRealTimers())

it('rejects an already cancelled operation even without a reason', async () => {
  const signal = { aborted: true } as AbortSignal
  expect(() => throwIfAborted(signal)).toThrow('aborted')
  const work = vi.fn()
  await expect(withAbortTimeout(signal, 15000, work)).rejects.toMatchObject({
    name: 'AbortError',
  })
  expect(work).not.toHaveBeenCalled()
})

it('cancels an in-flight request when its parent is cancelled', async () => {
  const parent = new AbortController()
  const reason = new Error('Session changed')
  const request = withAbortTimeout(
    parent.signal,
    15000,
    (signal) =>
      new Promise((_, reject) =>
        signal.addEventListener('abort', () => reject(signal.reason)),
      ),
  )
  const rejected = expect(request).rejects.toBe(reason)
  parent.abort(reason)
  await rejected
})

it('times out requests and clears timers and listeners after completion', async () => {
  vi.useFakeTimers()
  const parent = new AbortController()
  const remove = vi.spyOn(parent.signal, 'removeEventListener')
  const request = withAbortTimeout(
    parent.signal,
    15000,
    (signal) =>
      new Promise((_, reject) =>
        signal.addEventListener('abort', () => reject(signal.reason)),
      ),
  )
  const rejected = expect(request).rejects.toMatchObject({
    name: 'TimeoutError',
  })
  await vi.advanceTimersByTimeAsync(15000)
  await rejected
  expect(remove).toHaveBeenCalled()
  expect(await withAbortTimeout(parent.signal, 15000, async () => 'ok')).toBe(
    'ok',
  )
  expect(vi.getTimerCount()).toBe(0)
})
