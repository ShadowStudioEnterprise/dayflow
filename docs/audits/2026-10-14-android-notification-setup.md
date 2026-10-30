# Configuración inicial de avisos Android — 14 de octubre de 2026

Rama: `fix/android-notification-setup`. Petición del usuario: requerir sonido y autoinicio al instalar, tras las pruebas del Redmi 9A.

## Comportamiento

- Al primer arranque después de instalar o actualizar esta versión, Android muestra un asistente antes de acceder a Dayflow. Continuar requiere notificaciones activadas y sonido del canal Recordatorios disponible. La comprobación se repite en el plugin nativo al guardar, no sólo en el botón.
- Se crea el canal si no existe, con sonido predeterminado, importancia alta y vibración. Un canal existente conserva los ajustes elegidos por el usuario; no se elimina ni reemplaza para forzar sonido.
- «Configurar sonido» abre los ajustes del canal. Se vuelve a consultar el estado al regresar y mediante «Comprobar de nuevo». Android 7 usa ajustes de la aplicación y comprueba volumen/modo de timbre como alternativa a los canales de Android 8+.
- En Xiaomi/Redmi/POCO se requiere confirmar manualmente que se activó Autoinicio. La interfaz explica dónde hacerlo y abre la ficha de ajustes de Dayflow. La app no puede comprobar ni conceder ese ajuste: la confirmación no equivale a un permiso verificado.
- La configuración completada se conserva en preferencias nativas. No se exige el asistente de nuevo en cada arranque; los valores actuales y la confirmación manual se pueden revisar desde Configuración. Cambiar ajustes posteriormente requiere volver a revisarlos.
- No se bloquea la PWA ni se añade un flujo a iOS. No se desactivan Silencio/No molestar ni se modifica el volumen del sistema. Estos modos pueden impedir el sonido incluso con canal activo.

La solicitud ocurre al **primer arranque**, no dentro del instalador del sistema. Android mantiene al usuario como autoridad sobre los canales y Xiaomi indica que el usuario debe permitir el autoinicio en sus ajustes. [Canales Android](https://developer.android.com/develop/ui/compose/notifications/channels), [autoinicio Xiaomi](https://dev.mi.com/xiaomihyperos/documentation/detail?pId=1624).

## Validación

- TypeScript, lint y build web correctos.
- Diez pruebas unitarias correctas: seis del asistente y cuatro del adaptador. Cubren bloqueo sin sonido/confirmación, retorno desde Ajustes, fallo/reintento, persistencia, exclusión web, acceso a ajustes y programación nativa existente.
- Gradle debug correcto después de sincronizar los assets Android. Una compilación inicial se solapó con `cap sync` y falló en recursos generados; se repitió después de la sincronización, limpiando sólo el subproyecto generado de Cordova. Compilación final correcta en 27 s.
- Emulador `Medium_Phone_API_35`: plugin registrado y primer arranque comprobado con notificaciones desactivadas (Continuar bloqueado); canal con sonido/vibración; permiso concedido por diálogo, apertura de ajustes de Recordatorios, continuación a login y persistencia al recargar. Hubo una interrupción inicial del probe por faltar el driver Android de Playwright y un reintento por un diálogo anterior pendiente; los resultados posteriores no se presentan como una ejecución ininterrumpida.
- Captura del asistente revisada; se ajustó después el espacio entre controles. Artefactos locales ignorados: `.toolchains/notification-setup/`. La última variación de espaciado se incluye en el APK final, sin cambiar la lógica del plugin comprobado.
- Revisión React: hooks sin condiciones, listeners liberados, resultados asíncronos con protección de revisión/desmontaje, controles etiquetados y errores sin contenido externo.

## Límites

APK debug preparado: `.toolchains/redmi-9a/Dayflow-0.9.0-notification-setup.apk`, paquete `com.dayflow.app`, versión 0.9.0, **5.101.053 bytes**, SHA-256 `5930A7158F3E0B0B49BD96298F183803409985C19F2D571F947DDBFE3BD3D8F6`. Código compilado `f8c0b66178fbf4cb59f36efc2d07f88af49133e6`. Los 73 archivos de `dist/` se contrastaron con `assets/public/` del APK: cero diferencias SHA-256. Actualización del APK final en el emulador correcta, login visible y configuración completada conservada; no se reinstaló borrando datos.

El emulador no es MIUI y no certifica el ajuste de Autoinicio del Redmi ni la lectura del interruptor de sonido específico del fabricante. Falta actualizar el APK en el Redmi y comprobar primer arranque, retorno desde ajustes y persistencia. El resultado de las alarmas anteriores permanece asociado a la instalación usada durante esas pruebas; no se extrapola al nuevo APK. [Registro Redmi](2026-10-12-redmi-9a.md).
