/* Imported by the production service worker. Contains no credentials or reminder text. */
const pushIdentity = (value) =>
  new Promise((resolve, reject) => {
    const open = indexedDB.open('dayflow-push', 1)
    open.onupgradeneeded = () => open.result.createObjectStore('identity')
    open.onerror = () => reject(open.error)
    open.onsuccess = () => {
      const db = open.result
      const tx = db.transaction(
        'identity',
        value === undefined ? 'readonly' : 'readwrite',
      )
      const store = tx.objectStore('identity')
      const result =
        value === undefined ? store.get('user') : store.put(value, 'user')
      tx.oncomplete = () => {
        resolve(result.result ?? null)
        db.close()
      }
      tx.onabort = () => {
        reject(tx.error)
        db.close()
      }
    }
  })
const pushUuid = (value) =>
  typeof value === 'string' &&
  /^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i.test(value)
let pushWork = Promise.resolve()
const serializePush = (work) => {
  const next = pushWork.catch(() => {}).then(work)
  pushWork = next
  return next
}
self.addEventListener('message', (event) => {
  if (
    !event.source?.url ||
    new URL(event.source.url).origin !== self.location.origin
  )
    return
  if (!['DAYFLOW_PUSH_GET', 'DAYFLOW_PUSH_SET'].includes(event.data?.type))
    return
  event.waitUntil(
    serializePush(async () => {
      try {
        if (event.data.type === 'DAYFLOW_PUSH_SET') {
          const user = event.data.userId
          if (user !== null && !pushUuid(user))
            throw new Error('Invalid identity')
          await pushIdentity(user)
          for (const notification of await self.registration.getNotifications())
            notification.close()
        }
        event.ports[0]?.postMessage({ userId: await pushIdentity() })
      } catch {
        event.ports[0]?.postMessage({ error: true })
      }
    }),
  )
})
self.addEventListener('push', (event) => {
  event.waitUntil(
    serializePush(async () => {
      let data
      try {
        data = event.data?.json()
      } catch {
        return
      }
      if (!data || !pushUuid(data.userId) || !pushUuid(data.reminderId)) return
      const at = Date.parse(data.at)
      if (
        !Number.isFinite(at) ||
        at > Date.now() + 60_000 ||
        at < Date.now() - 600_000
      )
        return
      if ((await pushIdentity()) !== data.userId) return
      await self.registration.showNotification('Dayflow · Recordatorio', {
        body: 'Tienes un recordatorio pendiente. Abre Dayflow para consultarlo.',
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-192.png',
        tag: `dayflow:${data.reminderId}:${data.at}`,
        renotify: false,
        data: { userId: data.userId, reminderId: data.reminderId },
      })
    }),
  )
})
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(
    serializePush(async () => {
      const data = event.notification.data
      if (!pushUuid(data?.reminderId) || (await pushIdentity()) !== data.userId)
        return
      // A new window preserves drafts in existing tabs; the destination is always local.
      await self.clients.openWindow(`/reminders?reminder=${data.reminderId}`)
    }),
  )
})
