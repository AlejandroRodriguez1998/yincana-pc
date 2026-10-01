# Yincana PC

Aplicación web (Angular 21 + Firebase) para gestionar una yincana de montaje de ordenadores:
registro rápido de tiempos desde el móvil, ranking en directo y pantalla final para proyector.
Gana el grupo que completa todas las pruebas en menos tiempo.

- **Jueces**: gestionan grupos, participantes, pruebas y accesos, cronometran cada prueba y consultan el historial.
- **Grupos**: ven su zona privada: sus tiempos por prueba, su tiempo total y las pruebas pendientes.
  Su **posición y el ranking general permanecen ocultos hasta que un juez los revela**.
- **Pantalla final** (`/resultados`): podio y tabla grupo × prueba en tiempo real. Es el ranking de los jueces
  (solo jueces). Los grupos tienen una única página, que incluye un ranking compacto con posición,
  pruebas y tiempo total.

## Puesta en marcha

### 1. Firebase Console (una sola vez)

1. **Authentication → Método de inicio de sesión**: habilita **Correo electrónico/contraseña**.
2. **Firestore Database**: crea la base de datos en modo producción.
3. **Publica las reglas y los índices** (`firestore.rules`, `firestore.indexes.json`):

   ```bash
   npx firebase-tools login
   npm run deploy:rules
   ```

   También puedes pegar `firestore.rules` en *Firestore → Reglas* y crear el índice a mano
   (`auditLogs`: `groupId` ascendente + `at` descendente).
4. **Crea el primer juez** (solo este paso es manual):
   1. *Authentication → Usuarios → Añadir usuario*, con un email y una contraseña (por ejemplo `profe@tu-centro.es`). Copia su **UID**.
   2. *Firestore → Iniciar colección* `users` → documento con ID = **ese UID** y estos campos:

      | campo         | tipo      | valor                     |
      |---------------|-----------|---------------------------|
      | `role`        | string    | `judge`                   |
      | `groupId`     | null      | `null`                    |
      | `displayName` | string    | `Nombre del profesor`     |
      | `username`    | string    | `profe` (solo informativo)|
      | `createdAt`   | timestamp | fecha actual              |

   3. Entra en la app con el email completo y la contraseña.

A partir de ahí, todo se hace desde la app: el resto de jueces (*Más → Jueces*) y los accesos
de cada grupo (*Grupos → grupo → Crear acceso*).

### 2. Desarrollo local

```bash
npm install
npm start          # http://localhost:4200
npm test           # tests unitarios (ranking y cálculo de tiempos)
npm run build      # build de producción en dist/yincana-pc/browser
```

Requiere Node ≥ 22.12.

### 3. Despliegue en Firebase Hosting

```bash
npx firebase-tools login      # una sola vez
npm run deploy:hosting        # build + publicar la app
npm run deploy:all            # build + app + reglas + índices
```

- La app queda en `https://yincana-pc.web.app` (y `yincana-pc.firebaseapp.com`). Estos dominios ya vienen
  autorizados en Authentication.
- `firebase.json` publica `dist/yincana-pc/browser` y reescribe cualquier ruta a `index.html`.
- Cabeceras: seguridad en todo, caché de un año para los ficheros con hash y `no-cache` para `index.html`,
  el manifest y el service worker, para que las actualizaciones de la PWA lleguen siempre.

### Otros hostings (alternativa)

#### Cloudflare (Workers)

En Cloudflare: *Workers & Pages → Create → Import a repository*, elige el repositorio y deja:

| Ajuste          | Valor                |
|-----------------|----------------------|
| Project name    | `yincana-pc`         |
| Build command   | `npm run build`      |
| Deploy command  | `npx wrangler deploy` |

- `wrangler.jsonc` publica `dist/yincana-pc/browser` como recursos estáticos, y con
  `not_found_handling: "single-page-application"` cualquier ruta (`/juez`, `/ranking`…) devuelve `index.html`.
- **Node**: el fichero `.node-version` fija Node 22, que es lo que necesita Angular 21.
- **Cabeceras**: `public/_headers` añade las cabeceras de seguridad y cachea un año los ficheros con hash.
  El resto (index, manifest, service worker) se revalida siempre.
- Si usas **Cloudflare Pages** en lugar de Workers, la salida es `dist/yincana-pc/browser` y funciona igual:
  Pages ya devuelve `index.html` en rutas desconocidas porque el build no incluye `404.html`.
- Después del primer despliegue, añade el dominio (`*.workers.dev`, `*.pages.dev` o el tuyo) en
  *Firebase → Authentication → Configuración → Dominios autorizados*.

`vercel.json` contiene la configuración equivalente por si algún día se despliega en Vercel.

## PWA (app instalable)

- **Instalación**: en Android, Chrome o Edge aparece el botón "Instalar la app" (en el login, en el menú
  *Más* del juez y en la cabecera del grupo). En iPhone o iPad: *Compartir → Añadir a pantalla de inicio*.
- **Sin conexión**: el service worker de Angular (`ngsw-config.json`) guarda la app y las fuentes, así que
  arranca al instante aunque la red falle. Los datos los cachea Firestore. Registrar un tiempo sí necesita
  conexión: si no la hay, la app lo avisa y no guarda nada.
- **Actualizaciones**: tras un despliegue aparece el aviso "Nueva versión disponible → Recargar". Nunca
  recarga sola, para no interrumpir un cronómetro.
- **Caché en el hosting**: `ngsw-worker.js`, `ngsw.json`, `manifest.webmanifest` e `index.html` se revalidan
  siempre, y el JS y CSS con hash en el nombre se cachean un año (`public/_headers` en Cloudflare Pages,
  `vercel.json` en Vercel).
- El service worker solo funciona en el build de producción: `npm start` no lo activa. Para probarlo en local,
  haz `npm run build` y sirve `dist/yincana-pc/browser` con un servidor estático que devuelva `index.html`
  para cualquier ruta.
- Iconos: las fuentes SVG están en `design/icons/`. Los PNG de `public/icons/` se generan a partir de ellas.

## Decisiones de diseño

### Cuentas y seguridad

- **Rol en Firestore, no en el cliente.** El rol vive en `users/{uid}` y **solo los jueces pueden escribirlo**,
  así que nadie puede cambiarse el rol manipulando el frontend. Una cuenta sin ese documento no tiene ningún permiso.
- **Creación de cuentas desde la app.** El SDK cliente no puede crear usuarios para terceros y
  el Admin SDK necesita Cloud Functions, que no está disponible en el plan gratuito (Spark). La app usa
  una **segunda instancia de Firebase con persistencia en memoria** para crear la cuenta sin cerrar
  la sesión del juez, y después el juez escribe el perfil. No hay claves privadas ni Admin SDK en el frontend.
- **Limitaciones** (se resolverían con Cloud Functions en el plan Blaze):
  - Cambiar una contraseña o borrar definitivamente una cuenta de Authentication se hace en Firebase Console.
    "Retirar acceso" borra el perfil, y con eso la cuenta pierde todos los permisos al instante.
  - Con Email/Password habilitado, cualquiera con la clave pública podría registrarse vía API, pero
    esa cuenta no tendría perfil y, por tanto, ningún acceso.
- **Usuarios de grupo.** El usuario `grupo-1` se convierte internamente en
  `grupo-1@cuentas.yincana-pc.firebaseapp.com` (`environment.accountEmailDomain`). Nunca se envían emails.
- **Las reglas de Firestore son la barrera real** (los guards de Angular solo mejoran la navegación):
  - Los grupos nunca escriben. Solo leen su perfil, su grupo, **sus** resultados, las pruebas, los ajustes y,
    **solo si el ranking está revelado**, los totales públicos (`standings/public`). No pueden leer los tiempos
    por prueba de otros grupos.
  - `auditLogs` solo lo leen los jueces y es inmutable.
  - Cada resultado valida: un único documento por grupo/prueba, que grupo y prueba estén activos,
    tiempos en ms enteros (máx. 24 h), `timeMs > 0`, `totalMs = timeMs + penaltyMs` y `judgeId = auth.uid`.
    Además, exige que su entrada de auditoría se escriba **en la misma transacción**.

### Modelo de Firestore

| Documento                    | Contenido                                                                           |
|------------------------------|-------------------------------------------------------------------------------------|
| `users/{uid}`                | `role`, `groupId`, `displayName`, `username`, `createdAt`                           |
| `groups/{groupId}`           | `name`, `participants[{id,name}]`, `active`, `createdAt`, `updatedAt`               |
| `tests/{testId}`             | `name`, `description`, `order`, `active`, fechas                                    |
| `scores/{groupId}__{testId}` | `timeMs`, `penaltyMs`, `totalMs`, `judgeId`, `judgeName`, `auditId`, fechas          |
| `auditLogs/{id}`             | `entityType`, `entityId`, `action`, grupo/prueba (id y nombre), `before`, `after`, `note`, `actorId`, `actorName`, `at` |
| `standings/current`          | `groups.{groupId} = { name, active, results.{testId} = { totalMs, penaltyMs } }` (solo jueces) |
| `standings/public`           | `groups.{groupId} = { name, active, totalMs, completed }` (jueces; grupos solo si está revelado) |
| `settings/competition`       | `rankingRevealed`, `revealedAt`, `updatedBy`, `updatedAt` (lo escriben los jueces)   |

- **Sin duplicados.** El ID `groupId__testId` impide dos resultados para la misma combinación.
- **Resúmenes `standings/current` y `standings/public`.** Se actualizan en la misma transacción que cada
  resultado, y con ellos el ranking y la pantalla final cuestan **1 lectura por actualización** en vez de
  leer todos los resultados.
  - `current` guarda el desglose por prueba y los totales se calculan en el cliente.
  - `public` guarda solo los totales, para que los grupos no vean tiempos por prueba ajenos. Se recalcula
    entero cuando se activa, desactiva o borra una prueba.
  - Si alguna vez se desincronizan, *Recalcular clasificación* (en el panel del juez) reconstruye los dos
    desde `scores`.
- **Auditoría ampliable.** `entityType` admite ya `score`, `group` y `test`, y hoy se registran las altas,
  modificaciones y bajas de resultados y los borrados de grupos y pruebas.

### Reglas de la competición

- **Todas las pruebas se cronometran.** El juez registra el tiempo de cada grupo en cada prueba
  con el cronómetro de la app, o escribiéndolo a mano.
- **Tiempo final de una prueba** = tiempo cronometrado + penalización (en segundos, que se suman).
- **Tiempo total del grupo** = suma de los tiempos finales de sus pruebas activas completadas.
- **Ranking**: 1) más pruebas completadas, 2) menor tiempo total. Si sigue el empate, los grupos
  comparten posición (1, 1, 3…). No hay más criterios.
- **Ranking oculto**: por defecto los grupos no ven su posición ni el ranking general. Un juez lo revela
  (u oculta) desde el panel o con el botón "Revelar" de `/ranking` y `/resultados`, y el cambio llega al instante.
  Mientras está oculto, el podio muestra "?" y la tabla aparece en orden alfabético y sin tiempo total ni
  posición. Al revelarlo, el podio se desvela con una animación (3º → 2º → suspense → ganador con confeti)
  y después aparecen las columnas de tiempo total y posición. Los grupos no ven su posición ni el ranking
  hasta 12 s después de pulsar "Revelar", cuando ha terminado la animación (lo imponen las reglas con
  `settings/competition.revealedAt`).
- **Ganador**: la pantalla final muestra "Va en cabeza" mientras falten pruebas por registrar y
  "Equipo ganador" cuando todos los grupos activos han completado todas las pruebas activas.
- **Activo/inactivo**: una prueba o grupo inactivo queda fuera de la competición. No se puede registrar,
  no aparece en el ranking ni en la pantalla final y no suma tiempo. Sus resultados se conservan por si se reactiva.
- **Cronómetro**: su estado (`startedAt` y el tiempo acumulado) se guarda en `localStorage` de cada móvil,
  así que sobrevive a recargas, bloqueos de pantalla y cambios de página. El intervalo solo repinta la pantalla.

### Coste de Firestore (plan gratuito)

| Pantalla            | Listeners                                          | Lecturas al entrar       |
|---------------------|----------------------------------------------------|--------------------------|
| Zona del juez       | grupos + pruebas + resumen (compartidos por todas sus páginas) | N + M + 1     |
| Zona del grupo      | su grupo + sus resultados + pruebas + totales públicos | 1 + ≤M + M + 1        |
| Pantalla final      | pruebas + resumen                                   | M + 1                    |
| Historial           | sin listener: páginas de 20 bajo demanda            | 20 por página            |
| Accesos / jueces    | sin listener: consulta puntual                      | nº de cuentas            |

Los listeners se crean en el contenedor de cada zona y se cancelan al salir de ella.
La caché persistente de Firestore reduce las lecturas facturadas al recargar.

## Estructura

```text
src/app/
  core/
    auth/        AuthService, creación de cuentas, email interno
    data/        servicios de Firestore, mappers tipados, CompetitionFeed
    firebase/    providers, listeners → signals, mensajes de error
    guards/      guards por autenticación y rol
    models/      interfaces de dominio
    ranking/     cálculo del ranking (+ tests)
    ui/          toasts, confirmaciones, tema claro/oscuro
  shared/        componentes (icono, hoja modal, estados vacíos, ranking…) y pipes
  features/
    auth/login
    judge/       dashboard, scoring (+ cronómetro), groups, tests, history, judges
    group/       página única del grupo (resumen, pruebas y ranking)
    final-results/ podio + tabla (ranking del juez y pantalla final)
```
