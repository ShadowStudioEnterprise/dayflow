# Validación manual de Dayflow PWA en Windows

Pruebas del 5 de noviembre de 2026, zona Europe/Madrid. Se usó [Dayflow en producción](https://dayflow-by-shadowstudio.vercel.app/auth/login), con Chrome `156.0.8078.80` y Edge `156.0.4314.58`. Las versiones de navegador corresponden a los ejecutables observados en el equipo de prueba.

Vercel resolvió el dominio al [despliegue de producción](https://vercel.com/shadow-studio3/dayflow/dpl_GgsKxcEYagrhvZb7GfVTnU5ytTDo) del [commit `7a92da4` de `main`](https://github.com/ShadowStudioEnterprise/dayflow/commit/7a92da41aed88e1616ac208b7654c11bce26ec32). El [paquete de ese commit](https://github.com/ShadowStudioEnterprise/dayflow/blob/7a92da41aed88e1616ac208b7654c11bce26ec32/package.json#L4) declara la versión `0.9.0`. En Chrome se observó el recurso principal `/assets/index-D_NLwThX.js`.

| Caso | Chrome | Edge |
| --- | --- | --- |
| Instalación y apertura independiente | Superado. Configuración indicó «Dayflow está instalada». La captura muestra una ventana sin pestañas ni barra de direcciones. | Superado. La captura muestra «Dayflow está instalada» en una ventana independiente y «Guardado local · Sin pendientes». |
| Manifest | Superado. El manifest publicado declaró nombre Dayflow, inicio y ámbito `/`, modo `standalone` e iconos de 192 y 512 px, incluido el icono maskable. | Superado en los campos observados. DevTools mostró nombre Dayflow, inicio `/`, modo `standalone` e iconos de 192 y 512 px. |
| Service worker | Superado. DevTools mostró `sw.js` activo y ejecutándose, con `/settings` como cliente. Identificador local `#112`. | Superado. DevTools mostró `sw.js` activo y ejecutándose, con `/settings` como cliente. Identificador local `#4`. |
| Reapertura sin red | Superado según confirmación del usuario. La aplicación cargó desde el acceso instalado con la sesión conservada. También se confirmó una recarga con Offline en DevTools y el retorno a «Sin pendientes» al reconectar. | Superado según confirmación del usuario. La aplicación cargó desde el acceso instalado con la sesión conservada. |
| Comprobar actualizaciones | Superado. La interfaz mostró «Comprobación realizada» y no apareció aviso de nueva versión. | Superado. La captura muestra «Comprobación realizada» y no aparece aviso de nueva versión. |
| Descarga y activación de una actualización real | Pendiente. | Pendiente. |

Edge DevTools mostró dos avisos sobre el diálogo de instalación enriquecido. El manifest carece de capturas para escritorio y móvil. La instalación estándar se completó.

La evidencia combina observación del navegador, capturas aportadas por el usuario y confirmaciones manuales de reapertura. Los identificadores de DevTools pertenecen a cada navegador. Los casos de reapertura cubren la ventana instalada y una sesión vigente. Las pruebas se realizaron con los datos de la cuenta conservados y sin cambios de producción.

## Caso pendiente tras la próxima publicación

1. Registrar la compilación anterior y la nueva publicación en el mismo dominio. Abrir dos ventanas de Dayflow en cada navegador.
2. Pulsar **Comprobar actualizaciones** y verificar que el worker nuevo se descarga y queda en espera mientras una ventana anterior permanece abierta. Comprobar que no hay recarga forzada.
3. Cerrar todas las ventanas de Dayflow de ese perfil y reabrir desde el acceso instalado. Verificar el worker activo y la nueva compilación.
4. Comprobar que la sesión y los datos de prueba siguen disponibles. Para verificar la protección de borradores, usar contenido de prueba acordado y registrar su estado antes y después.

El ciclo esperado y la prueba automatizada con dos compilaciones están descritos en la [guía de PWA](../pwa-native.md).
