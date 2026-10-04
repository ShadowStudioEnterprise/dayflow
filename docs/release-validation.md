# Validación de publicación y dispositivos

Estado del 4 de octubre de 2026. Una compilación, una respuesta HTTP o un emulador no acreditan recepción de correo, entrega física de notificaciones ni consumo de batería.

Actualización de alojamiento: la dirección principal es ahora
[Dayflow en Vercel](https://dayflow-dun-seven.vercel.app), con despliegue `READY`,
Supabase configurado y comprobación de actualizaciones superada en Chromium.
Detalles en [publicación en Vercel](vercel.md). La evidencia de correo y avisos
de la tabla siguiente corresponde a las pruebas previas en Sites; todavía no
se ha repetido su recepción manual en el nuevo dominio. Los identificadores
de Sites y del APK se conservan como referencia de esas pruebas.

| Área                       | Estado                                                                                                            | Evidencia pendiente                                                                                           |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Web HTTPS                  | Publicada; acceso privado del propietario y visitante de prueba verificado por el usuario                         | Prueba en los demás navegadores de destino                                                                    |
| Retornos de Auth           | Confirmación y recuperación completadas en la prueba manual                                                       | Ninguna para este caso de prueba                                                                              |
| Confirmación de correo     | Superada: resultado manual del usuario y cuenta confirmada en Supabase                                            | Ninguna para este caso de prueba                                                                              |
| Recuperación de contraseña | Superada según comprobación manual del usuario                                                                    | Rechazo de la contraseña anterior no comunicado por separado                                                  |
| Web Push programado        | Recepción en Chrome verificada; al cerrar sus ventanas se detienen todos sus procesos y el aviso llega al reabrir | Entrega con navegador detenido no disponible en esta configuración; suspensión y otras plataformas pendientes |
| Android alojado            | APK debug compilado                                                                                               | Instalación y pruebas en teléfono físico                                                                      |
| iOS                        | Recursos y proyecto sincronizados                                                                                 | Compilación/firma en macOS y ejecución en iPhone/iPad                                                         |
| Safari y batería           | No verificados                                                                                                    | Safari real y mediciones en hardware                                                                          |

## Sitio y compilación de referencia

- URL: <https://dayflow-productividad.gptgonzaleznavarrete.chatgpt.site>.
- Acceso al alojamiento: privado para su propietario y un visitante de prueba añadido con autorización del usuario. La aplicación conserva su autenticación de Supabase.
- Sites project: `appgprj_6ac1b87387188191828d0f9da914d8c5`.
- Versión publicada: `appgprj_6ac1b87387188191828d0f9da914d8c5~appgver_9b40ce2c3ce0819187ab8f18cabbca63` (versión 3: cierre de sesión desde Mi espacio).
- Despliegue: `appgdep_6ac28b1d3cc48191be67d28d760ddaeb`, estado `succeeded`.
- Commit de la exportación: `b1b471dc26de879f0f927554941b4010e20802a2`.
- SHA-256 del build web: `d0581fed08ec6b38dc700142bd3d9840f97063472ba66cb484249fbaafd72c7d`, 70 archivos del build; el alojamiento conserva también assets con hash de versiones anteriores.
- APK: `android/app/build/outputs/apk/debug/app-debug.apk`, 5.099.726 bytes, paquete `com.dayflow.app`, versión `0.9.0`.
- SHA-256 APK: `4CDA054954749A3F013F70C5CB95EB80AB39B40ED5423564469561C517867C9A`.

El APK contiene el Supabase alojado. No necesita Docker ni un túnel USB para autenticarse/sincronizar. Es una compilación de desarrollo, no un paquete firmado para tienda. La variante `Dayflow Local` conserva su configuración separada.

La actualización del menú y perfil se publicó en la web; el APK de referencia anterior todavía no incorpora ese cambio. Pruebas y alcance en [verificación de Mi espacio](verification.md#mi-espacio-menú-y-perfil-con-estadísticas--4-de-octubre-de-2026).

## Correo real: prueba manual

Resultado del 4 de octubre de 2026: el usuario confirmó por separado que funcionan el registro/confirmación y la recuperación con cambio de contraseña e inicio de sesión. La consulta de sólo lectura tras el registro acreditó una cuenta, solicitud de confirmación, correo confirmado y primer inicio de sesión. La recuperación se acredita por el resultado manual comunicado, no por lectura del buzón ni de contraseñas. La consulta posterior devuelve `recovery_sent_at = null`: este campo no es un historial permanente, ya que Supabase lo limpia al actualizar la contraseña (véase [UpdatePassword en Supabase Auth](https://github.com/supabase/auth/blob/master/internal/models/user.go)). No se usó confirmación administrativa en este caso; no se registraron contraseñas, tokens ni enlaces de acceso. La hora de recepción, la carpeta del buzón y el rechazo de la contraseña anterior no se han recogido por separado.

No compartas la contraseña ni el contenido completo de enlaces que conceden acceso. El usuario decidió revisar el correo manualmente; Gmail no estaba conectado en este entorno. No se han enviado mensajes de prueba desde una cuenta administrativamente confirmada para presentarlos como validación real.

1. Abre `/auth/register` en la URL publicada. Crea la cuenta de prueba con el correo acordado y una contraseña propia de al menos 12 caracteres.
2. Comprueba que llega el mensaje de confirmación al buzón o a spam. Registra hora de solicitud y recepción, y carpeta; una pantalla de «correo enviado» no acredita recepción.
3. Abre el enlace en **el mismo navegador y perfil** donde solicitaste el registro. Debe volver a la URL HTTPS de Dayflow y completar el acceso. PKCE conserva el verificador en ese navegador; abrir desde otro puede impedir el canje.
4. Cierra sesión. Abre `/auth/reset-password`, solicita recuperación una sola vez y comprueba el segundo correo.
5. Abre ese enlace en el mismo navegador/perfil. Debe mostrar «Una nueva contraseña». Elige otra contraseña, guárdala y confirma que puedes iniciar sesión con ella. Comprueba que la anterior ya no permite iniciar una sesión nueva.
6. Informa del resultado de ambos flujos o del texto del error, sin enviar contraseñas ni códigos.

No hay SMTP propio configurado. El servicio predeterminado de Supabase limita los destinatarios a miembros del equipo del proyecto y, según su documentación consultada, dos mensajes por hora. Si aparece `Email address not authorized`, hace falta configurar un proveedor SMTP; repetir la solicitud no lo soluciona. Si hay un límite de envío, espera a que se restablezca. No se desactiva la confirmación de email para sortear estos controles.

## Web Push con la aplicación cerrada

Resultado del 4 de octubre de 2026: tras ajustar la hora del recordatorio, el usuario confirmó la recepción en Chrome. Supabase registra una entrega para las 12:32:00 Europe/Madrid, aceptada por el proveedor a las 12:32:00.576. Esa diferencia mide aceptación del proveedor, no llegada a la pantalla. La prueba solicitada consistía en cerrar las pestañas de Dayflow dejando Chrome abierto; el usuario confirmó la notificación, sin detallar por separado el estado de las ventanas. No acredita cierre completo del navegador, suspensión del sistema, Safari ni aplicaciones nativas.

Comprobación posterior: el usuario precisó que en **Windows, al cerrar todas las ventanas de Chrome, no recibe el aviso hasta volver a abrir Chrome**. Ese caso queda **fallido para entrega al vencimiento**, con recepción diferida confirmada. Los avisos de las 12:40 y 12:42 Europe/Madrid fueron aceptados por el proveedor a las 12:40:01.086 y 12:42:00.523, con un intento cada uno. No se ha inspeccionado si quedó un proceso Chrome activo ni su configuración de segundo plano. La hipótesis es que Chrome deja de ejecutarse al cerrar sus ventanas; debe comprobarse antes de atribuirlo definitivamente a una opción concreta.

El usuario indicó después que la opción de ejecución en segundo plano **ya estaba activada**. Por tanto, no se atribuye el fallo a una opción desactivada. La inspección local encontró Chrome 154.0.8037.93, 15 procesos y una ventana visible, sin un valor explícito de la política `BackgroundModeEnabled` en HKCU/HKLM. Esto describe el estado con Chrome abierto, no el estado durante el fallo; se solicitó cerrar las ventanas para comparar los procesos y confirmar que se prueba en este mismo ordenador.

Tras confirmar el usuario «cerrado», la consulta local devolvió **cero procesos Chrome y cero ventanas**. Queda comprobado que Chrome termina por completo en este equipo, aunque la opción de segundo plano figure activa según el usuario. La web no dispone de un proceso receptor en ese estado; mantener una ventana minimizada permite conservar el navegador en ejecución. La recepción independiente de Chrome requeriría otra integración con el sistema, que Dayflow no tiene implementada para Windows. No se han cambiado preferencias ni instalado componentes para forzar la persistencia del navegador.

Haz la prueba primero desde un navegador habitual que permita notificaciones, sin modo privado. En iPhone/iPad utiliza la PWA instalada. Registra el navegador, versión, sistema, si está instalada, permisos, modo de concentración, ahorro de energía y conectividad.

1. Inicia sesión, activa **Configuración → Activar avisos web** y confirma que el estado queda activo.
2. Crea un recordatorio a tres minutos vista con avisos activados; espera a «Sincronizado · 0 operaciones pendientes».
3. Cierra todas las pestañas/ventanas de Dayflow. Anota por separado si el navegador sigue ejecutándose, si se cerró por completo o si el sistema se suspendió. No son estados equivalentes.
4. Comprueba y registra hora efectiva del aviso, retraso respecto al instante previsto, ausencia de contenido privado y apertura del recordatorio al pulsarlo.
5. Repite con una recurrencia diaria; después modifica o elimina una ocurrencia futura y espera su sincronización antes de cerrar.
6. Desactiva los avisos y, en otra ronda, cierra sesión antes del vencimiento. No deben llegar avisos de esa suscripción; prueba también el cambio de cuenta.
7. Registra por separado desconexión breve, reconexión, suspensión del sistema y cierre completo del navegador. La ventana de recuperación del emisor es de cinco minutos; no se promete entrega indefinida ni exacta.

## Safari y aplicaciones nativas

Prueba Safari en un Mac real, Safari/PWA en iPhone o iPad, Android nativo en un teléfono y iOS nativo compilado con Xcode. No sustituyas esos resultados por WebKit automatizado, un user-agent de iPhone ni un emulador.

Para cada plataforma, comprueba registro/recuperación en el mismo dispositivo, restauración de sesión, tarea y relación sincronizadas con la web, Semana/Día en cambios de zona, edición offline y reconexión, ausencia de duplicados y aislamiento tras cerrar sesión. En nativo prueba el retorno `dayflow://auth/callback` desde el correo.

Para alarmas locales nativas: concede y deniega permisos desde los diálogos reales; en Android registra también el permiso de alarma exacta. Programa un aviso, pulsa Inicio, bloquea el teléfono y comprueba entrega y acción. Repite después de retirar la app de recientes, suspensión prolongada y reinicio. Registra por separado una detención forzada explícita desde ajustes. No equipares esas situaciones ni ocultes restricciones del sistema o del fabricante.

## Batería y evidencia

Usa el mismo teléfono, estado de red, brillo, configuración de ahorro y franja de uso. Haz una ronda de referencia y una ronda con Dayflow instalada, al menos ocho horas cada una, incluyendo un periodo de pantalla apagada. Registra batería inicial/final, tiempo de pantalla, carga durante la ronda, uso activo de Dayflow, número de avisos y consumo atribuido por el sistema. Sin condiciones comparables, la diferencia no puede atribuirse a Dayflow.

Para cada caso guarda: identificador, fecha/zona, modelo, SO/navegador/WebView, versión/SHA de la app, estado de la app/navegador, permisos, conexión, ahorro de batería, hora programada/recibida, resultado y evidencia. Estados admitidos: **pendiente**, **superado**, **fallido** o **no aplicable con motivo**. Los casos físicos permanecen pendientes al no haber hardware disponible.

## Volver a publicar

Compila el proyecto principal con `npm run build`. Ejecuta `node scripts/prepare-web-release.mjs D:/Projects/dayflow/deployment/web` y usa el flujo de Sites sobre ese checkout, conservando su identidad. Sólo se copia la exportación estática; las claves privadas no se incluyen. Se conservan los assets con hash de la versión anterior para las pestañas abiertas.

En Windows, el empaquetador de Sites necesita Git Bash en `PATH` y `TAR_OPTIONS=--force-local` para que la unidad `D:` no se interprete como un servidor remoto. Las credenciales temporales de Sites se pasan por stdin y no se guardan en archivos. Las rutas SPA, manifest y service worker están incluidos en la exportación.

## Referencias

- [Supabase: restricciones del correo predeterminado y configuración SMTP](https://supabase.com/docs/guides/auth/auth-smtp).
- [Supabase: destinos de confirmación y recuperación](https://supabase.com/docs/guides/auth/redirect-urls).
- [Capacitor: permisos y límites de las notificaciones locales](https://capacitorjs.com/docs/apis/local-notifications).
- [Android: Doze y App Standby](https://developer.android.com/training/monitoring-device-state/doze-standby).
