function mailboxUrl() {
  try {
    const url = new URL(import.meta.env.VITE_LOCAL_MAILBOX_URL)
    return url.protocol === 'http:' &&
      ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) &&
      !url.username &&
      !url.password
      ? url.href
      : null
  } catch {
    return null
  }
}

export function LocalMailNotice() {
  const url = mailboxUrl()
  return url ? (
    <p className="notice">
      Entorno local: los correos de confirmación y recuperación se guardan en
      este ordenador.{' '}
      <a className="text-link" href={url} target="_blank" rel="noreferrer">
        Abrir correo local
      </a>
    </p>
  ) : null
}
