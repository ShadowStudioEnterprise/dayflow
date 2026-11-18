# AuditorÃ­as

La web principal estÃ¡ publicada en Vercel. Consulta la [matriz de publicaciÃ³n y dispositivos](../release-validation.md#evidencia-por-versiÃ³n-y-entorno) para identificar la versiÃ³n, el entorno y el alcance de cada resultado. Los registros de Sites corresponden al alojamiento anterior.

- [PWA en iPhone 11 Â· 18/11/2026](2026-11-18-pwa-ios.md): ocho IDs superados por confirmaciÃ³n manual en iOS 27.2.1 declarada. IOS-06 conserva pendiente la actualizaciÃ³n real A â B; sÃ³lo se comprobÃ³ el control. Safari en pestaÃ±a y otros modelos sin verificar.

- [Safari y PWA en macOS Â· 16/11/2026](2026-11-16-pwa-macos.md): sesiÃ³n, persistencia offline, envÃ­o automÃ¡tico y convergencia sin duplicados; Web Push recibido y abierto, revocaciÃ³n y recuperaciÃ³n. PWA del Dock conserva nota guardada con/sin red. RelaciÃ³n persistida y revisiÃ³n de ocho pantallas a 320 px en iframe de Safari. El 18/11 se confirmÃ³ manualmente el ciclo de actualizaciÃ³n, con sesiÃ³n y nota conservadas al reabrir a las 09:00 CET; SHA de los workers sin identificar.

- InstalaciÃ³n y reapertura sin red verificadas el 5/11/2026 sobre Vercel `7a92da4`. El 13/11/2026, en Windows 11 25H2 con Chrome `157.0.8103.79` y Edge `157.0.4341.46`, se verificaron la actualizaciÃ³n a `322f123` con sesiÃ³n, datos y borrador conservados y el envÃ­o de la cola tras reabrir sin red. [AuditorÃ­a de la PWA en Windows](2026-11-05-pwa-windows.md)

- [Redmi Note 11S Â· 29/10/2026](2026-10-29-redmi-note11s.md): instalaciÃ³n conservando datos, autenticaciÃ³n, offline, sincronizaciÃ³n y recuperaciÃ³n de sesiÃ³n; registro cronolÃ³gico de avisos y lÃ­mites.
- APK integrada en Redmi Note 11S Â· 14â15/11/2026. InstalaciÃ³n y arranque de `dd4ac54`, aviso tras reinicio y desbloqueo, recepciÃ³n despuÃ©s de salir de Doze profundo y recuperaciÃ³n del permiso de notificaciones. QA-04 verificÃ³ tambiÃ©n la apertura del recordatorio desde el aviso y la persistencia offline con sincronizaciÃ³n bidireccional. [Informe del Redmi Note 11S](2026-10-29-redmi-note11s.md#apk-integrada-del-14-y-15-de-noviembre-de-2026).
- [AlineaciÃ³n de alarmas Android Â· 29/10/2026](2026-10-29-android-alarm-alignment.md): causa aislada en firmware y modo prioritario experimental. El cÃ³digo se integrÃ³ despuÃ©s en `main` mediante el PR #11 (`b023b1f`, merge `086ed94`).
- [Aviso prioritario prolongado Â· 29/10/2026](2026-10-29-priority-prolonged.md): entrega Ãºnica a las 23:51:00.132 con recepciÃ³n confirmada; Doze profundo no certificado.

- [Alarmas Android: casos restantes del 14 de octubre](2026-10-14-android-alarms-remaining.md): ronda de Doze, inactividad, permisos, cancelaciÃ³n y variantes de reinicio; identificaciÃ³n del APK nuevo y lÃ­mite de permisos exactos en Android 11. EjecuciÃ³n pendiente de actualizaciÃ³n/conexiÃ³n del Redmi.

- [ConfiguraciÃ³n inicial de avisos Android del 14 de octubre](2026-10-14-android-notification-setup.md): asistente de primer arranque con comprobaciÃ³n de sonido/notificaciones y confirmaciÃ³n manual de Autoinicio en Xiaomi/Redmi; pruebas unitarias y emulador API 35 correctos. ValidaciÃ³n fÃ­sica del nuevo APK pendiente.

- [Responsive mÃ³vil del 13 de octubre de 2026](2026-10-13-mobile-responsive.md): diÃ¡logos adaptados al teclado, estado de notas visible, menÃº/cabecera y controles mÃ³viles; layout y recorridos funcionales comprobados. RevisiÃ³n del nuevo APK en Redmi pendiente.

- [Nota offline tras reinicio del Redmi](2026-10-12-redmi-note-offline-restart.md): pÃ©rdida de ediciÃ³n reportada pese al estado Guardado, sin recuperaciÃ³n al reconectar; 20 unitarias y 10 E2E correctos no reproducen el reinicio fÃ­sico. InvestigaciÃ³n abierta.

- [Compatibilidad WebView 97](2026-10-12-webview97-compat.md): correcciÃ³n de zonas horarias y cancelaciÃ³n/timeout de Sync tras el error en Redmi 9A. Pruebas automatizadas correctas; creaciÃ³n y sincronizaciÃ³n bidireccional confirmadas manualmente tras actualizar.

- [ValidaciÃ³n fÃ­sica del Redmi 9A](2026-10-12-redmi-9a.md): instalaciÃ³n, acceso, confirmaciÃ³n y retorno PKCE con correo nuevo, recuperaciÃ³n de contraseÃ±a, aislamiento visible entre cuentas, sincronizaciÃ³n bidireccional, creaciÃ³n/ediciÃ³n offline, controles de reinicio y recuperaciÃ³n de sesiÃ³n/sincronizaciÃ³n confirmados manualmente. Fallos iniciales conservados; renovaciÃ³n tras caducidad pendiente.

- [VerificaciÃ³n del diagnÃ³stico de notificaciones del 12 de octubre](2026-10-12-notification-diagnostics.md): mecanismo, permisos, pendientes y renovaciÃ³n en ConfiguraciÃ³n; alcance de las pruebas separado de recepciÃ³n fÃ­sica.

- [Calendario mÃ³vil: repeticiÃ³n del 12 de octubre de 2026](2026-10-12-calendar-mobile.md): 130/130 correctos, cuatro y un worker, cero reintentos y fuentes inmutables. InvestigaciÃ³n cerrada por evidencia; fallo no reproducido.

- PWA mÃ³vil. Protocolo y cobertura automatizada del 12/10/2026. El 15/11/2026 se confirmaron en Chrome Android instalado la instalaciÃ³n, el guion de arranque offline y persistencia, y la reanudaciÃ³n tras una hora. TambiÃ©n se verificÃ³ la actualizaciÃ³n de `5e5107ff` a `dd0ec83` con sesiÃ³n, datos locales y borrador conservados. La ronda del iPhone 11 del 18/11 se registra por separado; actualizaciÃ³n real y Safari en pestaÃ±a siguen pendientes. [Informe de PWA mÃ³vil](2026-10-12-pwa-mobile.md).

- [Protocolo de alarmas Android del 12 de octubre de 2026](2026-10-12-android-alarms.md): matriz de permisos, bloqueo, Doze, baterÃ­a y reinicio; mediciÃ³n de recepciÃ³n y retrasos. EjecuciÃ³n fÃ­sica pendiente por falta de telÃ©fono.

- [Protocolo de Android fÃ­sico del 12 de octubre de 2026](2026-10-12-android-physical.md): APK y SHA identificados; matriz de instalaciÃ³n, Auth/PKCE, offline, sincronizaciÃ³n y recuperaciÃ³n de sesiÃ³n. EjecuciÃ³n fÃ­sica pendiente por falta de telÃ©fono.

- [Estado de CI y producciÃ³n del 12 de octubre de 2026](2026-10-12-ci-deployment.md): SHA comÃºn de CI y Vercel, tres jobs correctos, producciÃ³n READY, fechas e instantÃ¡neas de evidencia. ActualizaciÃ³n documental cerrada; alcance separado de Auth/Push manual y cambios posteriores en dev.

- [Versiones, fechas cliente, invocaciÃ³n y SQL](2026-10-12-sql-hardening.md): decisiones SQL-01/02/03/04/06 y migraciÃ³n aditiva con validaciÃ³n local. El 13/11/2026 se verificÃ³ su aplicaciÃ³n en Supabase alojado con 74/74 comprobaciones de historial y catÃ¡logo.

- [Capacidad y recuperaciÃ³n de notificaciones](../notification-capacity.md): 26 pruebas, 78 perfiles de emisor y recuperaciÃ³n medida en dos versiones. Cupo de 60, fronteras de cinco minutos, DST, fallos parciales y lÃ­mite blando de 45 segundos documentados con datos.
- [AutenticaciÃ³n y Web Push en Vercel](2026-10-12-vercel-auth-web-push.md): cuatro criterios de cierre superados. Auth comprobado por el usuario; aviso de las 02:16 recibido y abierto en Vercel, con aceptaciÃ³n del proveedor registrada en un intento. Conserva el intento fallido previo sin suscripciÃ³n y la correcciÃ³n del cierre prematuro.
- [CorrecciÃ³n del arranque de Sync](2026-10-10-e2e-sync-fix.md): disponibilidad del motor observada por la interfaz; 60 E2E funcionales y 10 ensayos de carga retenida correctos sin reintentos.
- [Intermitencia E2E de Sync y calendario mÃ³vil](2026-10-10-e2e-intermittency.md): causa de arranque de Sync reproducida 10/10 veces; calendario mÃ³vil 130/130 correcto sin reintentos. DiagnÃ³stico previo a la correcciÃ³n.
- [Pruebas adversariales del 10 de octubre de 2026](2026-10-10-supabase-adversarial.md): nueva ejecuciÃ³n con dos cuentas, 460 comprobaciones correctas y 40 verificaciones de limpieza.
- [AuditorÃ­a estÃ¡tica del 9 de octubre de 2026](2026-10-09.md): pasos 1â5, commit de referencia, hallazgos y validaciones pendientes.
- [CatÃ¡logo real de Supabase del 9 de octubre de 2026](2026-10-09-supabase-rls-rpc.md): RLS, permisos efectivos de los tres roles, 51 comprobaciones SQL y evidencia reproducible.
- [Cierre con JWT reales del 9 de octubre de 2026](2026-10-09-supabase-closure.md): 460 comprobaciones HTTP, correcciÃ³n de permisos desplegada y limpieza verificada.

Este registro conserva el estado de la revisiÃ³n original. Los resultados posteriores se incorporan a [verificaciÃ³n](../verification.md), sin reescribir evidencia histÃ³rica. La [polÃ­tica de notificaciones](../notifications-policy.md) reÃºne el contrato de funcionamiento.
