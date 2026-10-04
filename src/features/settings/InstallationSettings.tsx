import {
  checkPwaUpdate,
  installPwa,
  usePwa,
} from '../../services/pwa/pwa-service'

export function InstallationSettings() {
  const state = usePwa()
  return (
    <section className="settings-section" aria-labelledby="installation-title">
      <h2 id="installation-title">Instalación y actualizaciones</h2>
      {state.mode === 'native' ? (
        <p className="muted">
          Dayflow está instalada en este dispositivo. Las actualizaciones se
          distribuyen con una nueva versión de la aplicación.
        </p>
      ) : state.mode === 'development' ? (
        <p className="muted">
          La instalación y el arranque sin conexión están disponibles en la
          versión compilada.
        </p>
      ) : state.mode === 'unsupported' ? (
        <p className="muted">
          Este navegador o conexión no permite preparar Dayflow para abrirla sin
          red. Usa un navegador compatible y una conexión HTTPS.
        </p>
      ) : (
        <>
          <p role="status">
            {state.ready
              ? 'Lista para abrir sin conexión.'
              : state.error
                ? 'Arranque sin conexión pendiente.'
                : 'Preparando el arranque sin conexión…'}
          </p>
          <p className="muted">
            Para acceder sin red, inicia sesión antes en este dispositivo. Los
            datos guardados aquí seguirán disponibles mientras se conserve tu
            sesión.
          </p>
          {state.installed ? (
            <p>Dayflow está instalada.</p>
          ) : state.installable ? (
            <button
              className="button primary"
              disabled={state.busy}
              onClick={() => void installPwa()}
            >
              Instalar Dayflow
            </button>
          ) : (
            <p className="muted">
              Para instalar, busca «Instalar aplicación» en el menú del
              navegador. En iPhone o iPad, abre Dayflow en Safari y elige
              Compartir → Añadir a la pantalla de inicio.
            </p>
          )}
          {state.updateAvailable && (
            <p className="notice" role="status">
              Hay una nueva versión lista. Guarda tus cambios, cierra todas las
              ventanas de Dayflow y vuelve a abrirla para actualizar.
            </p>
          )}
          <button
            className="button secondary"
            disabled={state.busy}
            onClick={() => void checkPwaUpdate()}
          >
            {state.busy ? 'Comprobando…' : 'Comprobar actualizaciones'}
          </button>
          {state.checked && !state.updateAvailable && (
            <p className="muted small" role="status">
              Comprobación realizada. Si hay una nueva versión, aparecerá aquí
              cuando termine de descargarse.
            </p>
          )}
        </>
      )}
      {state.error && (
        <p className="field-error" role="alert">
          {state.error}
        </p>
      )}
    </section>
  )
}
