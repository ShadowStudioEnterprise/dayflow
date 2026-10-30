export function throwIfAborted(signal: AbortSignal) {
  if (signal.aborted)
    throw (
      signal.reason ??
      new DOMException('The operation was aborted.', 'AbortError')
    )
}

/** Scope a request timeout to its lifetime, preserving parent cancellation. */
export async function withAbortTimeout<T>(
  parent: AbortSignal,
  milliseconds: number,
  work: (signal: AbortSignal) => PromiseLike<T>,
): Promise<T> {
  throwIfAborted(parent)
  const controller = new AbortController()
  const cancel = () => controller.abort(parent.reason)
  parent.addEventListener('abort', cancel, { once: true })
  const timer = setTimeout(
    () =>
      controller.abort(
        new DOMException('The operation timed out.', 'TimeoutError'),
      ),
    milliseconds,
  )
  try {
    return await work(controller.signal)
  } finally {
    clearTimeout(timer)
    parent.removeEventListener('abort', cancel)
  }
}
