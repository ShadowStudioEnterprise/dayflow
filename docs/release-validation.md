# ValidaciÃ³n de publicaciÃ³n y dispositivos

La validaciÃ³n manual de la PWA en Windows cubriÃ³ la instalaciÃ³n y la reapertura sin red el 5 de noviembre. El 13 de noviembre se superaron en Chrome y Edge la actualizaciÃ³n real con sesiÃ³n, datos y borrador conservados y la sincronizaciÃ³n de una cola pendiente tras una interrupciÃ³n. [AuditorÃ­a de Windows](audits/2026-11-05-pwa-windows.md)

## Evidencia por versiÃ³n y entorno

| Entorno                                  | Referencia                                                                                              | Resultado y lÃ­mite                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Windows, PWA instalada Â· 05/11           | Vercel `7a92da4`, Chrome `156.0.8078.80` y Edge `156.0.4314.58`                                         | InstalaciÃ³n, reapertura sin red y bÃºsqueda de actualizaciones verificadas.                                                                                                                                                                                                                                                                                                                                                                                                                |
| Windows 11 25H2, PWA instalada Â· 13/11   | Vercel `322f123`, Chrome `157.0.8103.79` y Edge `157.0.4341.46`                                         | WIN-03 a WIN-05 superadas manualmente en ambos navegadores. ActualizaciÃ³n desde `7a92da4` con sesiÃ³n, datos y borrador conservados. Tres operaciones por navegador persistieron sin red y se enviaron al reconectar, sin duplicados. [AuditorÃ­a](audits/2026-11-05-pwa-windows.md#validaciÃ³n-manual-del-13-de-noviembre-de-2026)                                                                                                                                                          |
| Vercel Â· 12/10                           | Base de revisiÃ³n `39593d2`, recursos publicados identificados por huella                                | ConfirmaciÃ³n, recuperaciÃ³n, rechazo de la contraseÃ±a anterior y recepciÃ³n y apertura del aviso comprobados. Queda la validaciÃ³n con SMTP propio y destinatario externo.                                                                                                                                                                                                                                                                                                                   |
| Redmi 9A Â· 12â13/10                      | APK corregido para WebView 97, cÃ³digo `beeca6a`                                                         | CreaciÃ³n offline y sincronizaciÃ³n bidireccional confirmadas por el usuario. En la prueba posterior de Auth se confirmÃ³ acceso y recuperaciÃ³n sin una nueva huella del APK instalado. [AuditorÃ­a](audits/2026-10-12-redmi-9a.md)                                                                                                                                                                                                                                                           |
| Redmi Note 11S, Android 13 Â· 29/10       | APK debug inicial SHA-256 `5930A7158F3E0B0B49BD96298F183803409985C19F2D571F947DDBFE3BD3D8F6`            | Se verificaron instalaciÃ³n conservando datos, sesiÃ³n, offline, sincronizaciÃ³n y recuperaciÃ³n de un aviso bÃ¡sico tras reinicio. El ensayo en Doze prolongado registrÃ³ entrega diferida. [AuditorÃ­a](audits/2026-10-29-redmi-note11s.md)                                                                                                                                                                                                                                                    |
| Redmi Note 11S, Android 13 Â· 29/10       | APK prioritario experimental SHA-256 `1D855897907DF101A9D2FF994CAEE41D6DEDF0422E29F37D566320A143B4BA2E` | Aviso de las 23:51 emitido una vez y recibido con pantalla apagada en reposo ligero. [AuditorÃ­a](audits/2026-10-29-priority-prolonged.md)                                                                                                                                                                                                                                                                                                                                                 |
| Redmi Note 11S, Android 13 Â· 14â15/11    | APK debug 0.9.0 (cÃ³digo 1), `dd4ac54`                                                                   | AND-02 a AND-05. InstalaciÃ³n y arranque, prioridad desactivada por defecto, recepciÃ³n tras reinicio y primer desbloqueo, y revocaciÃ³n y recuperaciÃ³n del permiso de notificaciones. En Doze, se recibiÃ³ el aviso tras salir de `IDLE`. QA-04 confirmÃ³ apertura del recordatorio al tocar el aviso, arranque offline con la cola conservada y sincronizaciÃ³n bidireccional con producciÃ³n. [AuditorÃ­a](audits/2026-10-29-redmi-note11s.md#apk-integrada-del-14-y-15-de-noviembre-de-2026). |
| Redmi Note 11S, PWA instalada Â· 15/11    | Android 13, Chrome `154.0.8037.126`, Vercel `5e5107ff` â `dd0ec83`                                      | AND-06, AND-07 y AND-09 confirmadas manualmente. InstalaciÃ³n, guion de arranque offline y persistencia, y reanudaciÃ³n de 20:35 a 21:35 CET con cambios conservados. AND-08 verificada. La actualizaciÃ³n se activÃ³ al cerrar y reabrir desde el icono y conservÃ³ sesiÃ³n, datos locales y borrador. [AuditorÃ­a](audits/2026-10-12-pwa-mobile.md#chrome-android-en-el-redmi-note-11s--15-de-noviembre-de-2026).                                                                              |
| macOS Â· Safari y PWA del Dock Â· 16â18/11 | MacBookPro15,4, macOS 15.7.9 (24G830), Safari 18.6 (20621.3.11.11.3); alias Vercel en 65535e6           | Recorrido, relaciÃ³n persistida y ocho pantallas a 320 px en iframe de Safari; sesiÃ³n, cola offline/reconexiÃ³n y Web Push comprobados. PWA instalada conserva sesiÃ³n, datos y nota guardada con/sin red. El 18/11 el usuario confirmÃ³ actualizaciÃ³n detectada y reapertura a las 09:00 CET con sesiÃ³n y nota conservadas, preparaciÃ³n offline y sin nueva actualizaciÃ³n ofrecida; SHA de los workers sin identificar. [AuditorÃ­a](audits/2026-11-16-pwa-macos.md).                         |
| iPhone 11, PWA instalada Â· 18/11 | iOS 27.2.1 declarada; servidor de referencia `d15c5397` | Ocho IDs superados manualmente: instalaciÃ³n, sesiÃ³n, offline, sincronizaciÃ³n con Chrome del Mac, aislamiento, suspensiÃ³n de 64 minutos y recepciÃ³n/apertura Push. IOS-06: control comprobado; actualizaciÃ³n real pendiente. Safari en pestaÃ±a sin verificar. [AuditorÃ­a y lÃ­mites](audits/2026-11-18-pwa-ios.md). |

Alcance actualizado el 12 de octubre de 2026: el usuario descarta la app nativa iOS y sus notificaciones locales. Esas dos tareas salen del plan; los resultados histÃ³ricos se conservan. ContinÃºa la [validaciÃ³n independiente de la PWA en Android y Safari/iOS](audits/2026-10-12-pwa-mobile.md).

Alarmas Android, preparaciÃ³n del 12 de octubre de 2026: [protocolo de recepciÃ³n y retrasos en hardware](audits/2026-10-12-android-alarms.md). Los resultados fÃ­sicos posteriores y el estado de la versiÃ³n integrada figuran en la matriz.

PreparaciÃ³n del 12 de octubre de 2026: [protocolo y matriz de Android fÃ­sico](audits/2026-10-12-android-physical.md), con SHA del cÃ³digo y huella del APK actual. La ejecuciÃ³n dependÃ­a de disponer de hardware. Las rondas posteriores figuran en la matriz.

Estado del 4 de octubre de 2026. Una compilaciÃ³n, una respuesta HTTP o un emulador no acreditan recepciÃ³n de correo, entrega fÃ­sica de notificaciones ni consumo de baterÃ­a.

AmpliaciÃ³n de beta â 18 de noviembre de 2026: el propietario confirmÃ³ recepciÃ³n y uso de los cÃ³digos de alta y recuperaciÃ³n con un buzÃ³n externo, mediante [SMTP de Brevo](auth-smtp.md) en Vercel `7ea033c`.

ActualizaciÃ³n de alojamiento: la direcciÃ³n principal es ahora
[Dayflow en Vercel](https://dayflow-by-shadowstudio.vercel.app/auth/login), con despliegue `READY`,
Supabase configurado y comprobaciÃ³n de actualizaciones superada en Chromium.
Detalles en [publicaciÃ³n en Vercel](vercel.md). La evidencia de correo y avisos
de la tabla siguiente corresponde a las pruebas previas en Sites; durante la
publicaciÃ³n inicial no se repitiÃ³ su recepciÃ³n en Vercel. Los identificadores
de Sites y del APK se conservan como referencia de esas pruebas.

RevisiÃ³n del 12 de octubre: [registro de Auth y Web Push en el dominio final](audits/2026-10-12-vercel-auth-web-push.md).
Las comprobaciones pÃºblicas se repiten con `npm run test:vercel` y estÃ¡n superadas.
La confirmaciÃ³n nueva estÃ¡ superada en Vercel: correo recibido y regreso con
acceso confirmados por el usuario, junto con una cuenta nueva confirmada en
Supabase. El usuario confirmÃ³ tambiÃ©n recuperaciÃ³n y rechazo de contraseÃ±a
anterior. Tras activar la suscripciÃ³n, el aviso de las 02:16 fue recibido y abriÃ³
el recordatorio en Vercel segÃºn confirmaciÃ³n explÃ­cita del usuario. Supabase
registra aceptaciÃ³n del proveedor a las 02:16:00.642 en un intento. Los cuatro
criterios de cierre estÃ¡n superados; el registro conserva el intento previo
sin suscripciÃ³n y detalla el alcance de la evidencia. La tabla siguiente
conserva Ãºnicamente la evidencia histÃ³rica del alojamiento anterior.

| Ãrea                       | Estado                                                                                                            | Evidencia pendiente                                                                                           |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Web HTTPS                  | Publicada; acceso privado del propietario y visitante de prueba verificado por el usuario                         | Prueba en los demÃ¡s navegadores de destino                                                                    |
| Retornos de Auth           | ConfirmaciÃ³n y recuperaciÃ³n completadas en la prueba manual                                                       | Ninguna para este caso de prueba                                                                              |
| ConfirmaciÃ³n de correo     | Superada: resultado manual del usuario y cuenta confirmada en Supabase                                            | Ninguna para este caso de prueba                                                                              |
| RecuperaciÃ³n de contraseÃ±a | Superada segÃºn comprobaciÃ³n manual del usuario                                                                    | Rechazo de la contraseÃ±a anterior no comunicado por separado                                                  |
| Web Push programado        | RecepciÃ³n en Chrome verificada; al cerrar sus ventanas se detienen todos sus procesos y el aviso llega al reabrir | Entrega con navegador detenido no disponible en esta configuraciÃ³n; suspensiÃ³n y otras plataformas pendientes |
| Android alojado            | APK debug compilado                                                                                               | InstalaciÃ³n y pruebas en telÃ©fono fÃ­sico                                                                      |
| iOS nativo                 | Descartado por decisiÃ³n del usuario el 12 de octubre de 2026; recursos histÃ³ricos conservados                     | Fuera del plan actual                                                                                         |
| Safari y baterÃ­a           | No verificados                                                                                                    | Safari real y mediciones en hardware                                                                          |

## Alojamiento anterior y compilaciÃ³n de referencia

- URL: <https://dayflow-productividad.gptgonzaleznavarrete.chatgpt.site>.
- Acceso al alojamiento: privado para su propietario y un visitante de prueba aÃ±adido con autorizaciÃ³n del usuario. La aplicaciÃ³n conserva su autenticaciÃ³n de Supabase.
- Sites project: `appgprj_6ac1b87387188191828d0f9da914d8c5`.
- VersiÃ³n publicada: `appgprj_6ac1b87387188191828d0f9da914d8c5~appgver_9b40ce2c3ce0819187ab8f18cabbca63` (versiÃ³n 3: cierre de sesiÃ³n desde Mi espacio).
- Despliegue: `appgdep_6ac28b1d3cc48191be67d28d760ddaeb`, estado `succeeded`.
- Commit de la exportaciÃ³n: `b1b471dc26de879f0f927554941b4010e20802a2`.
- SHA-256 del build web: `d0581fed08ec6b38dc700142bd3d9840f97063472ba66cb484249fbaafd72c7d`, 70 archivos del build; el alojamiento conserva tambiÃ©n assets con hash de versiones anteriores.
- APK: `android/app/build/outputs/apk/debug/app-debug.apk`, 5.099.726 bytes, paquete `com.dayflow.app`, versiÃ³n `0.9.0`.
- SHA-256 APK: `4CDA054954749A3F013F70C5CB95EB80AB39B40ED5423564469561C517867C9A`.

El APK contiene el Supabase alojado. No necesita Docker ni un tÃºnel USB para autenticarse/sincronizar. Es una compilaciÃ³n de desarrollo, no un paquete firmado para tienda. La variante `Dayflow Local` conserva su configuraciÃ³n separada.

La actualizaciÃ³n del menÃº y perfil se publicÃ³ en la web; el APK de referencia anterior todavÃ­a no incorpora ese cambio. Pruebas y alcance en [verificaciÃ³n de Mi espacio](verification.md#mi-espacio-menÃº-y-perfil-con-estadÃ­sticas--4-de-octubre-de-2026).

## Correo real: prueba manual

El 18 de noviembre de 2026, el propietario confirmÃ³ en la [web de Vercel](https://dayflow-by-shadowstudio.vercel.app/) sobre `7ea033c` la recepciÃ³n de ambos cÃ³digos en un buzÃ³n externo, el acceso tras confirmar el alta y, en la recuperaciÃ³n, el rechazo de la contraseÃ±a anterior y el acceso con la nueva. Esta ronda cubre BE-04 a BE-07 en web. El resultado compartido desde Gmail mostrÃ³ SPF PASS (IP `77.32.148.23`), DKIM PASS para `dayflowbyshadowstudio.dpdns.org` y DMARC PASS. Quedan sin documentar las horas y el navegador concreto. En una segunda ronda con Outlook, el propietario confirmÃ³ recepciÃ³n en No deseado, alta y cambio de contraseÃ±a. Quedaron sin detallar la carpeta de cada correo por separado, las cabeceras de Outlook y la comprobaciÃ³n de acceso con la contraseÃ±a antigua y la nueva.

Para la beta externa con Brevo, seguir el [guion con cÃ³digos](auth-smtp.md#cambiar-a-cÃ³digos-con-brevo). En BE-05 comprobar el acceso tras introducir el cÃ³digo de alta y en BE-07 verificar el cambio de contraseÃ±a, el rechazo de la anterior y el acceso con la nueva. Registrar el SHA, la plataforma y la recepciÃ³n de ambos mensajes en un buzÃ³n externo, sin copiar los cÃ³digos. El guion siguiente conserva la referencia de la prueba histÃ³rica por enlace.

El 17 de noviembre de 2026, en Windows y Chromium de Playwright, `npm run test:local` pasÃ³ 3/3 con Supabase local en Docker y Mailpit sobre la rama `codex/auth-codigo-correo` (base `65535e6`, cambios de Auth sin commit). Se verificaron el alta y la recuperaciÃ³n por enlace y por cÃ³digo. El caso por cÃ³digo comprobÃ³ el rechazo de la contraseÃ±a anterior, el acceso con la nueva y que ni otra pestaÃ±a ni una recarga durante la recuperaciÃ³n abren una sesiÃ³n privada. La entrega por Brevo a destinatarios externos quedÃ³ pendiente.

Resultado del 4 de octubre de 2026: el usuario confirmÃ³ por separado que funcionan el registro/confirmaciÃ³n y la recuperaciÃ³n con cambio de contraseÃ±a e inicio de sesiÃ³n. La consulta de sÃ³lo lectura tras el registro acreditÃ³ una cuenta, solicitud de confirmaciÃ³n, correo confirmado y primer inicio de sesiÃ³n. La recuperaciÃ³n se acredita por el resultado manual comunicado, no por lectura del buzÃ³n ni de contraseÃ±as. La consulta posterior devuelve `recovery_sent_at = null`: este campo no es un historial permanente, ya que Supabase lo limpia al actualizar la contraseÃ±a (vÃ©ase [UpdatePassword en Supabase Auth](https://github.com/supabase/auth/blob/master/internal/models/user.go)). No se usÃ³ confirmaciÃ³n administrativa en este caso; no se registraron contraseÃ±as, tokens ni enlaces de acceso. La hora de recepciÃ³n, la carpeta del buzÃ³n y el rechazo de la contraseÃ±a anterior no se han recogido por separado.

No compartas la contraseÃ±a ni el contenido completo de enlaces que conceden acceso. El usuario decidiÃ³ revisar el correo manualmente; Gmail no estaba conectado en este entorno. No se han enviado mensajes de prueba desde una cuenta administrativamente confirmada para presentarlos como validaciÃ³n real.

1. Abre `/auth/register` en la URL publicada. Crea la cuenta de prueba con el correo acordado y una contraseÃ±a propia de al menos 12 caracteres.
2. Comprueba que llega el mensaje de confirmaciÃ³n al buzÃ³n o a spam. Registra hora de solicitud y recepciÃ³n, y carpeta; una pantalla de Â«correo enviadoÂ» no acredita recepciÃ³n.
3. Abre el enlace en **el mismo navegador y perfil** donde solicitaste el registro. Debe volver a la URL HTTPS de Dayflow y completar el acceso. PKCE conserva el verificador en ese navegador; abrir desde otro puede impedir el canje.
4. Cierra sesiÃ³n. Abre `/auth/reset-password`, solicita recuperaciÃ³n una sola vez y comprueba el segundo correo.
5. Abre ese enlace en el mismo navegador/perfil. Debe mostrar Â«Una nueva contraseÃ±aÂ». Elige otra contraseÃ±a, guÃ¡rdala y confirma que puedes iniciar sesiÃ³n con ella. Comprueba que la anterior ya no permite iniciar una sesiÃ³n nueva.
6. Informa del resultado de ambos flujos o del texto del error, sin enviar contraseÃ±as ni cÃ³digos.

En la prueba histÃ³rica aÃºn se usaba el servicio predeterminado de Supabase, que limita los destinatarios a miembros del equipo del proyecto. El entorno actual usa el [SMTP propio de Brevo](auth-smtp.md). Si hay un lÃ­mite de envÃ­o, espera a que se restablezca. MantÃ©n la confirmaciÃ³n por email activada.

## Web Push con la aplicaciÃ³n cerrada

Resultado del 4 de octubre de 2026: tras ajustar la hora del recordatorio, el usuario confirmÃ³ la recepciÃ³n en Chrome. Supabase registra una entrega para las 12:32:00 Europe/Madrid, aceptada por el proveedor a las 12:32:00.576. Esa diferencia mide aceptaciÃ³n del proveedor, no llegada a la pantalla. La prueba solicitada consistÃ­a en cerrar las pestaÃ±as de Dayflow dejando Chrome abierto; el usuario confirmÃ³ la notificaciÃ³n, sin detallar por separado el estado de las ventanas. No acredita cierre completo del navegador, suspensiÃ³n del sistema, Safari ni aplicaciones nativas.

ComprobaciÃ³n posterior: el usuario precisÃ³ que en **Windows, al cerrar todas las ventanas de Chrome, no recibe el aviso hasta volver a abrir Chrome**. Ese caso queda **fallido para entrega al vencimiento**, con recepciÃ³n diferida confirmada. Los avisos de las 12:40 y 12:42 Europe/Madrid fueron aceptados por el proveedor a las 12:40:01.086 y 12:42:00.523, con un intento cada uno. No se ha inspeccionado si quedÃ³ un proceso Chrome activo ni su configuraciÃ³n de segundo plano. La hipÃ³tesis es que Chrome deja de ejecutarse al cerrar sus ventanas; debe comprobarse antes de atribuirlo definitivamente a una opciÃ³n concreta.

El usuario indicÃ³ despuÃ©s que la opciÃ³n de ejecuciÃ³n en segundo plano **ya estaba activada**. Por tanto, no se atribuye el fallo a una opciÃ³n desactivada. La inspecciÃ³n local encontrÃ³ Chrome 154.0.8037.93, 15 procesos y una ventana visible, sin un valor explÃ­cito de la polÃ­tica `BackgroundModeEnabled` en HKCU/HKLM. Esto describe el estado con Chrome abierto, no el estado durante el fallo; se solicitÃ³ cerrar las ventanas para comparar los procesos y confirmar que se prueba en este mismo ordenador.

Tras confirmar el usuario Â«cerradoÂ», la consulta local devolviÃ³ **cero procesos Chrome y cero ventanas**. Queda comprobado que Chrome termina por completo en este equipo, aunque la opciÃ³n de segundo plano figure activa segÃºn el usuario. La web no dispone de un proceso receptor en ese estado; mantener una ventana minimizada permite conservar el navegador en ejecuciÃ³n. La recepciÃ³n independiente de Chrome requerirÃ­a otra integraciÃ³n con el sistema, que Dayflow no tiene implementada para Windows. No se han cambiado preferencias ni instalado componentes para forzar la persistencia del navegador.

Haz la prueba primero desde un navegador habitual que permita notificaciones, sin modo privado. En iPhone/iPad utiliza la PWA instalada. Registra el navegador, versiÃ³n, sistema, si estÃ¡ instalada, permisos, modo de concentraciÃ³n, ahorro de energÃ­a y conectividad.

1. Inicia sesiÃ³n, activa **ConfiguraciÃ³n â Activar avisos web** y confirma que el estado queda activo.
2. Crea un recordatorio a tres minutos vista con avisos activados; espera a Â«Sincronizado Â· 0 operaciones pendientesÂ».
3. Cierra todas las pestaÃ±as/ventanas de Dayflow. Anota por separado si el navegador sigue ejecutÃ¡ndose, si se cerrÃ³ por completo o si el sistema se suspendiÃ³. No son estados equivalentes.
4. Comprueba y registra hora efectiva del aviso, retraso respecto al instante previsto, ausencia de contenido privado y apertura del recordatorio al pulsarlo.
5. Repite con una recurrencia diaria; despuÃ©s modifica o elimina una ocurrencia futura y espera su sincronizaciÃ³n antes de cerrar.
6. Desactiva los avisos y, en otra ronda, cierra sesiÃ³n antes del vencimiento. No deben llegar avisos de esa suscripciÃ³n; prueba tambiÃ©n el cambio de cuenta.
7. Registra por separado desconexiÃ³n breve, reconexiÃ³n, suspensiÃ³n del sistema y cierre completo del navegador. La ventana de recuperaciÃ³n del emisor es de cinco minutos; no se promete entrega indefinida ni exacta.

## Safari y aplicaciones nativas

Prueba Safari en un Mac real, Safari/PWA en iPhone o iPad y Android nativo en un telÃ©fono. iOS nativo queda fuera del plan actual. No sustituyas esos resultados por WebKit automatizado, un user-agent de iPhone ni un emulador.

Para cada plataforma, comprueba registro/recuperaciÃ³n en el mismo dispositivo, restauraciÃ³n de sesiÃ³n, tarea y relaciÃ³n sincronizadas con la web, Semana/DÃ­a en cambios de zona, ediciÃ³n offline y reconexiÃ³n, ausencia de duplicados y aislamiento tras cerrar sesiÃ³n. En nativo prueba el retorno `dayflow://auth/callback` desde el correo.

Para alarmas locales nativas: concede y deniega permisos desde los diÃ¡logos reales; en Android registra tambiÃ©n el permiso de alarma exacta. Programa un aviso, pulsa Inicio, bloquea el telÃ©fono y comprueba entrega y acciÃ³n. Repite despuÃ©s de retirar la app de recientes, suspensiÃ³n prolongada y reinicio. Registra por separado una detenciÃ³n forzada explÃ­cita desde ajustes. No equipares esas situaciones ni ocultes restricciones del sistema o del fabricante.

## BaterÃ­a y evidencia

Usa el mismo telÃ©fono, estado de red, brillo, configuraciÃ³n de ahorro y franja de uso. Haz una ronda de referencia y una ronda con Dayflow instalada, al menos ocho horas cada una, incluyendo un periodo de pantalla apagada. Registra baterÃ­a inicial/final, tiempo de pantalla, carga durante la ronda, uso activo de Dayflow, nÃºmero de avisos y consumo atribuido por el sistema. Sin condiciones comparables, la diferencia no puede atribuirse a Dayflow.

Para cada caso guarda: identificador, fecha/zona, modelo, SO/navegador/WebView, versiÃ³n/SHA de la app, estado de la app/navegador, permisos, conexiÃ³n, ahorro de baterÃ­a, hora programada/recibida, resultado y evidencia. Estados admitidos: **pendiente**, **superado**, **fallido** o **no aplicable con motivo**. La matriz indica los casos fÃ­sicos ejecutados y los pendientes por versiÃ³n.

## Volver a publicar

Sigue la [guÃ­a de publicaciÃ³n en Vercel](vercel.md). Registra el SHA que sirve el dominio principal y comprueba el ciclo de actualizaciÃ³n en Chrome y Edge segÃºn la [auditorÃ­a de Windows](audits/2026-11-05-pwa-windows.md).

## Referencias

- [Supabase: restricciones del correo predeterminado y configuraciÃ³n SMTP](https://supabase.com/docs/guides/auth/auth-smtp).
- [Supabase: destinos de confirmaciÃ³n y recuperaciÃ³n](https://supabase.com/docs/guides/auth/redirect-urls).
- [Capacitor: permisos y lÃ­mites de las notificaciones locales](https://capacitorjs.com/docs/apis/local-notifications).
- [Android: Doze y App Standby](https://developer.android.com/training/monitoring-device-state/doze-standby).
