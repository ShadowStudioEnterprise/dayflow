# Dayflow Android — observación prolongada de aviso prioritario

Registro fechado del APK debug experimental. La implementación prioritaria permanece local y no se incluye en esta publicación documental. Los apartados conservan el orden de las pruebas; los resultados posteriores actualizan los pendientes anteriores. [Guía del modo prioritario](../android-priority-alarms.md).

## Aviso prioritario prolongado — 29 de octubre de 2026

Se activó temporalmente el modo prioritario desde Configuración y se programó un aviso para las **23:51:00,000 Europe/Madrid**. La observación con pantalla apagada duró **955 segundos** hasta detectar la entrega, con **32 muestras** y sin interrupciones de ADB. Android publicó el aviso a las **23:51:00,132**, **132 ms** después del objetivo. El sistema y el plugin confirmaron **una única entrega**.

**Pasa la entrega puntual prolongada con pantalla apagada. No se certifica Doze profundo durante 15 minutos.** La orden de entrada devolvió `Unable to go deep idle; stopped at INACTIVE`; ninguna muestra acreditó IDLE profundo. Se observó reposo ligero (`mLightState=IDLE`) mientras el estado profundo seguía en INACTIVE. Se retiró enseguida la solicitud forzada al no confirmar la entrada y se continuó únicamente la observación de entrega.

El dispositivo declara `min_time_to_alarm=+30m0s0ms`. El [código público de Android](https://android.googlesource.com/platform/prebuilts/fullsdk/sources/android-30/+/refs/heads/main/com/android/server/DeviceIdleController.java) comprueba la proximidad de la siguiente alarma de despertar antes de avanzar a reposo profundo. Esto es compatible con el rechazo observado; no se ha demostrado que la implementación de este firmware coincida en todos sus detalles. No se alteraron constantes globales de Doze ni la política «Sin restricciones» para forzar un resultado positivo.

La confirmación perceptiva del usuario es: **Sí, con la pantalla apagada y sonido o vibración**. La hora anterior corresponde a la publicación medida por Android, no a una medición acústica.

Se restauró la preferencia prioritaria inicial **desactivada**, se retiró Doze forzado y se restableció la lectura normal de batería. La misma cuenta sigue autenticada; las dos tareas originales y la huella de las tres notas se mantienen; la cola está vacía. No se desinstaló ni borró información. Los recordatorios de prueba se conservan. El reinicio físico con el modo prioritario no se ha repetido.

Evidencia: `note11s-priority-prolonged-{doze,notification,observation,screen,ui,summary,final-integrity}.json`. El APK es el mismo debug ya instalado, SHA-256 `1D855897907DF101A9D2FF994CAEE41D6DEDF0422E29F37D566320A143B4BA2E`; no se cambió código de aplicación en esta continuación.

## Evidencia publicada

- [summary](evidence/2026-10-29-redmi-note11s/note11s-priority-prolonged-summary.json)
- [doze](evidence/2026-10-29-redmi-note11s/note11s-priority-prolonged-doze.json)
- [observation](evidence/2026-10-29-redmi-note11s/note11s-priority-prolonged-observation.json)
- [screen](evidence/2026-10-29-redmi-note11s/note11s-priority-prolonged-screen.json)
- [final-integrity](evidence/2026-10-29-redmi-note11s/note11s-priority-prolonged-final-integrity.json)

Los demás nombres de evidencia citados son referencias a los artefactos locales de la entrega, no enlaces a archivos incluidos en el repositorio.
