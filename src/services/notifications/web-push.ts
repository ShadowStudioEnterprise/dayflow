import { requireSupabase } from '../supabase/client'

export const webPushConfigured = Boolean(
  import.meta.env.VITE_WEB_PUSH_PUBLIC_KEY,
)
export function webPushUnavailable() {
  if (!webPushConfigured) return 'Web Push todavía no está configurado.'
  if (!import.meta.env.PROD)
    return 'Abre la versión de producción para activar los avisos web.'
  if (
    !window.isSecureContext ||
    !('serviceWorker' in navigator) ||
    !('PushManager' in window) ||
    !('Notification' in window)
  )
    return 'Este navegador no ofrece Web Push. En iPhone o iPad, abre Dayflow instalada en la pantalla de inicio.'
  return ''
}
async function registration() {
  const registration = await navigator.serviceWorker.getRegistration('/')
  if (!registration?.active)
    throw new Error(
      'La aplicación aún no está lista. Espera a que termine de prepararse sin conexión.',
    )
  return registration
}
export function pushIdentity(
  registration: ServiceWorkerRegistration,
  userId?: string | null,
): Promise<string | null> {
  return new Promise((resolve, reject) => {
    const channel = new MessageChannel()
    const finish = () => {
      clearTimeout(timer)
      channel.port1.close()
    }
    const timer = setTimeout(() => {
      finish()
      reject(
        new Error(
          'Cierra las pestañas de Dayflow y vuelve a abrirla para actualizar las notificaciones.',
        ),
      )
    }, 4000)
    channel.port1.onmessage = ({ data }) => {
      finish()
      if (data.error)
        reject(new Error('No se pudo proteger la suscripción de esta cuenta.'))
      else resolve(data.userId)
    }
    registration.active!.postMessage(
      {
        type: userId === undefined ? 'DAYFLOW_PUSH_GET' : 'DAYFLOW_PUSH_SET',
        userId,
      },
      [channel.port2],
    )
  })
}
async function locked<T>(work: () => Promise<T>) {
  return navigator.locks
    ? navigator.locks.request('dayflow-web-push', work)
    : work()
}
async function subscribe(
  worker: ServiceWorkerRegistration,
  key: Uint8Array<ArrayBuffer>,
) {
  let expired = false
  let timer: ReturnType<typeof setTimeout>
  const pending = worker.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: key,
  })
  // subscribe() has no AbortSignal. A late result must not silently enable notifications.
  void pending.then(
    (sub) => {
      if (expired)
        void locked(async () => {
          // Do not undo a newer, successfully activated subscription from another tab.
          if ((await pushIdentity(worker)) === null) await sub.unsubscribe()
        }).catch(() => {})
    },
    () => {},
  )
  try {
    return await Promise.race([
      pending,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          expired = true
          reject(
            new Error(
              'El proveedor de notificaciones no responde. Revisa la conexión y vuelve a intentarlo.',
            ),
          )
        }, 30000)
      }),
    ])
  } finally {
    clearTimeout(timer!)
  }
}
export async function webPushActive(userId: string) {
  if (webPushUnavailable()) return false
  const worker = await registration()
  if (
    Notification.permission !== 'granted' ||
    (await pushIdentity(worker)) !== userId
  )
    return false
  const sub = await worker.pushManager.getSubscription()
  if (!sub) return false
  const { data, error } = await requireSupabase()
    .from('push_subscriptions')
    .select('id')
    .eq('endpoint', sub.endpoint)
    .maybeSingle()
  if (error)
    throw new Error('No se pudo comprobar la suscripción. Revisa tu conexión.')
  return Boolean(data)
}
export async function enableWebPush(userId: string) {
  const unavailable = webPushUnavailable()
  if (unavailable) throw new Error(unavailable)
  // Ask directly from the user gesture, before any unrelated asynchronous work.
  if ((await Notification.requestPermission()) !== 'granted')
    throw new Error(
      'Permiso no concedido. Revisa los permisos de este sitio en tu navegador.',
    )
  return locked(async () => {
    const worker = await registration()
    const owner = await pushIdentity(worker)
    let sub = await worker.pushManager.getSubscription()
    if (sub && owner !== userId) {
      await pushIdentity(worker, null)
      if (!(await sub.unsubscribe()))
        throw new Error('No se pudo cancelar la suscripción anterior.')
      sub = null
    }
    const key = Uint8Array.from(
      atob(
        import.meta.env.VITE_WEB_PUSH_PUBLIC_KEY.replace(/-/g, '+').replace(
          /_/g,
          '/',
        ),
      ),
      (char) => char.charCodeAt(0),
    )
    if (!sub) {
      await pushIdentity(worker, null)
      sub = await subscribe(worker, key)
    }
    const json = sub.toJSON()
    try {
      const { data: session } = await requireSupabase().auth.getSession()
      if (session.session?.user.id !== userId)
        throw new Error('La cuenta ha cambiado. Vuelve a intentarlo.')
      const { error } = await requireSupabase().rpc('dayflow_register_push', {
        p_endpoint: sub.endpoint,
        p_p256dh: json.keys?.p256dh,
        p_auth: json.keys?.auth,
      })
      if (error)
        throw new Error(
          'No se pudo registrar este navegador. Revisa la conexión y vuelve a intentarlo.',
        )
      await pushIdentity(worker, userId)
    } catch (error) {
      await pushIdentity(worker, null)
      await sub.unsubscribe()
      throw error
    }
  })
}
export async function disableWebPush() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return
  return locked(disableUnsafe)
}
async function disableUnsafe() {
  const worker = await navigator.serviceWorker.getRegistration('/')
  if (!worker?.active) return
  // Clear identity first: even offline or after an HTTP failure, no old-account alert is shown.
  await pushIdentity(worker, null)
  const sub = await worker.pushManager.getSubscription()
  if (!sub) return
  if (!(await sub.unsubscribe()))
    throw new Error(
      'No se pudo cancelar la suscripción del navegador. Vuelve a intentarlo.',
    )
  // Revocation at the push provider is enough offline; the sender also removes 404/410 endpoints.
  await requireSupabase()
    .from('push_subscriptions')
    .delete()
    .eq('endpoint', sub.endpoint)
    .abortSignal(AbortSignal.timeout(5000))
}
export async function reconcileWebPushIdentity(userId: string | null) {
  if (webPushUnavailable()) return
  return locked(async () => {
    const worker = await navigator.serviceWorker.getRegistration('/')
    if (!worker?.active) return
    const owner = await pushIdentity(worker)
    if (owner && owner !== userId) await disableUnsafe()
  })
}
