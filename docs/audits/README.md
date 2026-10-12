# Auditorías

- [Estado de CI y producción del 12 de octubre de 2026](2026-10-12-ci-deployment.md): SHA común de CI y Vercel, tres jobs correctos, producción READY, fechas e instantáneas de evidencia. Actualización documental cerrada; alcance separado de Auth/Push manual y cambios posteriores en dev.

- [Versiones, fechas cliente, invocación y SQL](2026-10-12-sql-hardening.md): decisiones SQL-01/02/03/04/06 y migración aditiva con validación local.

- [Capacidad y recuperación de notificaciones](../notification-capacity.md): 26 pruebas, 78 perfiles de emisor y recuperación medida en dos versiones. Cupo de 60, fronteras de cinco minutos, DST, fallos parciales y límite blando de 45 segundos documentados con datos.
- [Autenticación y Web Push en Vercel](2026-10-12-vercel-auth-web-push.md): cuatro criterios de cierre superados. Auth comprobado por el usuario; aviso de las 02:16 recibido y abierto en Vercel, con aceptación del proveedor registrada en un intento. Conserva el intento fallido previo sin suscripción y la corrección del cierre prematuro.
- [Corrección del arranque de Sync](2026-10-10-e2e-sync-fix.md): disponibilidad del motor observada por la interfaz; 60 E2E funcionales y 10 ensayos de carga retenida correctos sin reintentos.
- [Intermitencia E2E de Sync y calendario móvil](2026-10-10-e2e-intermittency.md): causa de arranque de Sync reproducida 10/10 veces; calendario móvil 130/130 correcto sin reintentos. Diagnóstico previo a la corrección.
- [Pruebas adversariales del 10 de octubre de 2026](2026-10-10-supabase-adversarial.md): nueva ejecución con dos cuentas, 460 comprobaciones correctas y 40 verificaciones de limpieza.
- [Auditoría estática del 9 de octubre de 2026](2026-10-09.md): pasos 1–5, commit de referencia, hallazgos y validaciones pendientes.
- [Catálogo real de Supabase del 9 de octubre de 2026](2026-10-09-supabase-rls-rpc.md): RLS, permisos efectivos de los tres roles, 51 comprobaciones SQL y evidencia reproducible.
- [Cierre con JWT reales del 9 de octubre de 2026](2026-10-09-supabase-closure.md): 460 comprobaciones HTTP, corrección de permisos desplegada y limpieza verificada.

Este registro conserva el estado de la revisión original. Los resultados posteriores se incorporan a [verificación](../verification.md), sin reescribir evidencia histórica. La [política de notificaciones](../notifications-policy.md) reúne el contrato de funcionamiento.
