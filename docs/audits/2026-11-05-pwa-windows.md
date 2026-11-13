# Validación manual de Dayflow PWA en Windows

Pruebas del 5 de noviembre de 2026, zona Europe/Madrid. Se usó [Dayflow en producción](https://dayflow-by-shadowstudio.vercel.app/auth/login), con Chrome `156.0.8078.80` y Edge `156.0.4314.58`. Las versiones de navegador corresponden a los ejecutables observados en el equipo de prueba.

Vercel resolvió el dominio al [despliegue de producción](https://vercel.com/shadow-studio3/dayflow/dpl_GgsKxcEYagrhvZb7GfVTnU5ytTDo) del [commit `7a92da4` de `main`](https://github.com/ShadowStudioEnterprise/dayflow/commit/7a92da41aed88e1616ac208b7654c11bce26ec32). El [paquete de ese commit](https://github.com/ShadowStudioEnterprise/dayflow/blob/7a92da41aed88e1616ac208b7654c11bce26ec32/package.json#L4) declara la versión `0.9.0`. En Chrome se observó el recurso principal `/assets/index-D_NLwThX.js`.

| Caso                                 | Chrome                                                                                                                                                                                                                  | Edge                                                                                                                       |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Instalación y apertura independiente | Superado. Configuración indicó «Dayflow está instalada». La captura muestra una ventana sin pestañas ni barra de direcciones.                                                                                           | Superado. La captura muestra «Dayflow está instalada» en una ventana independiente y «Guardado local · Sin pendientes».    |
| Manifest                             | Superado. El manifest publicado declaró nombre Dayflow, inicio y ámbito `/`, modo `standalone` e iconos de 192 y 512 px, incluido el icono maskable.                                                                    | Superado en los campos observados. DevTools mostró nombre Dayflow, inicio `/`, modo `standalone` e iconos de 192 y 512 px. |
| Service worker                       | Superado. DevTools mostró `sw.js` activo y ejecutándose, con `/settings` como cliente. Identificador local `#112`.                                                                                                      | Superado. DevTools mostró `sw.js` activo y ejecutándose, con `/settings` como cliente. Identificador local `#4`.           |
| Reapertura sin red                   | Superado según confirmación del usuario. La aplicación cargó desde el acceso instalado con la sesión conservada. También se confirmó una recarga con Offline en DevTools y el retorno a «Sin pendientes» al reconectar. | Superado según confirmación del usuario. La aplicación cargó desde el acceso instalado con la sesión conservada.           |
| Comprobar actualizaciones            | Superado. La interfaz mostró «Comprobación realizada» y no apareció aviso de nueva versión.                                                                                                                             | Superado. La captura muestra «Comprobación realizada» y no aparece aviso de nueva versión.                                 |

Edge DevTools mostró dos avisos sobre el diálogo de instalación enriquecido. El manifest carece de capturas para escritorio y móvil. La instalación estándar se completó.

La evidencia combina observación del navegador, capturas aportadas por el usuario y confirmaciones manuales de reapertura. Los identificadores de DevTools pertenecen a cada navegador. Los casos de reapertura cubren la ventana instalada y una sesión vigente. Las pruebas se realizaron con los datos de la cuenta conservados y sin cambios de producción.

## Validación manual del 13 de noviembre de 2026

El usuario confirmó las pruebas de la PWA instalada en Windows 11 25H2, con Google Chrome `157.0.8103.79` y Microsoft Edge `157.0.4341.46` (compilaciones oficiales de 64 bits). La prueba de actualización partió de `7a92da4` y activó la compilación de Vercel [`322f123c8c7fe6e4de3031fd5f05029ad9ff4f73`](https://github.com/ShadowStudioEnterprise/dayflow/commit/322f123c8c7fe6e4de3031fd5f05029ad9ff4f73) en el dominio de producción. La prueba de conectividad se hizo sobre esa compilación.

### WIN-03 y WIN-04 · Actualización real

Los cuatro pasos del protocolo se superaron en Chrome y Edge. En la instalación previa apareció el aviso «Hay una nueva versión lista. Guarda tus cambios, cierra todas las ventanas de Dayflow y vuelve a abrirla para actualizar.» Con sesión activa y el borrador en «Guardado en este dispositivo», se cerraron todas las ventanas de Dayflow y se reabrió desde el acceso instalado. Se activó `322f123`, se conservaron la sesión, los datos y el borrador local, y la aplicación quedó en «Lista para abrir sin conexión».

### WIN-05 · Persistencia de la cola y reconexión

Superado en Chrome y Edge. Con sesión iniciada y la cola en «Sin pendientes», se cortó la red de Windows y se creó y editó una tarea y una nota. La nota mostró «Guardado en este dispositivo».

| Momento                                                           | Chrome         | Edge           |
| ----------------------------------------------------------------- | -------------- | -------------- |
| Después de guardar sin red                                        | 3 pendientes   | 3 pendientes   |
| Tras recargar sin red                                             | 3 pendientes   | 3 pendientes   |
| Tras cerrar todas las ventanas y reabrir la PWA instalada sin red | 3 pendientes   | 3 pendientes   |
| Tras reconectar y pulsar «Sincronizar ahora»                      | Sin pendientes | Sin pendientes |

La recarga y la reapertura conservaron la sesión y las ediciones finales. La hora de la última confirmación remota se mantuvo durante la interrupción y avanzó tras sincronizar. En cada pasada, el otro navegador recibió una sola tarea y una sola nota con su edición final.

La cobertura automática se verificó por separado en Windows, con Chromium de escritorio y móvil simulado, service worker real y RPC en PGlite. El caso comprueba la persistencia de la cola tras cerrar y reabrir sin red, el envío automático al reconectar y la convergencia sin duplicados. `npm run test:pwa` pasó 24/24 en el commit `c225101` de `codex/test-win05-pwa-sync`.

## Protocolo para repetir la actualización

1. Antes de que la nueva compilación esté disponible en el dominio de producción, abrir dos ventanas de Dayflow en cada navegador. Registrar la compilación de partida y comprobar en DevTools que ambas ventanas son clientes del worker activo. Mantenerlas abiertas durante la publicación.
2. Cuando la nueva compilación esté disponible en el mismo dominio, registrar su identificador y pulsar **Comprobar actualizaciones**. Verificar que el worker nuevo se descarga y queda en espera mientras el anterior controla las ventanas. Cerrar una y comprobar que la otra sigue con la compilación anterior sin recarga forzada.
3. Cerrar la última ventana de Dayflow del perfil y reabrir desde el acceso instalado. Verificar que el worker nuevo está activo y que la aplicación carga la nueva compilación.
4. Comprobar que la sesión y los datos de prueba siguen disponibles. Para verificar la protección de borradores, usar contenido de prueba acordado y registrar su estado antes y después.

El ciclo esperado y la prueba automatizada con dos compilaciones están descritos en la [guía de PWA](../pwa-native.md).
