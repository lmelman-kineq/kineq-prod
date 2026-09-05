# Architecture

Kineq is organized as a monorepo with two main applications:

- Backend API
- Frontend web app

The backend owns:
- Authentication
- Authorization
- Database access
- Business rules
- Integrations
- Notifications

The frontend owns:
- User interface
- Forms
- Calendars
- Dashboards
- Patient views
- Clinical record views

## Archivos: Vercel Blob, upload directo cliente → Blob con OIDC (implementado)

Cuatro superficies suben archivos hoy: imágenes de Evolución, archivo adjunto de Estudio, foto de Usuario, foto de Paciente. Todas comparten la misma infraestructura, no hay implementaciones separadas.

**Por qué no pasan por la función Serverless del backend**: Vercel limita a ~4.5MB el body de un request a una Serverless Function — un límite de la *plataforma*, no de esta app. Los límites propios de Kineq son más grandes (10MB por imagen de Evolución, hasta 50MB en un `POST` con 5 imágenes; 15MB Estudio; 5MB foto) — con el archivo pasando por el backend (`multer` + `Buffer`, como funcionaba antes), cualquier archivo real por encima de ~4.5MB nunca llegaba ni a esta función, con o sin token configurado.

**Solución — upload directo navegador → Vercel Blob**: el archivo nunca pasa por la función Serverless, así que el límite de 4.5MB no aplica. Tres pasos, iguales en las 4 superficies:

1. **`POST .../upload-token`** (o `.../upload-tokens`, plural, solo para imágenes de Evolución que pueden ser varias en una operación): el backend valida todo lo que antes validaba en el `POST` único (recurso existe, permisos/rol/vínculo profesional, formato MIME permitido, tamaño máximo, cupo de 5 imágenes por evolución), arma un `pathname` único (`withUniqueSuffix()`, `blobStorage.ts` — un `crypto.randomUUID()` antes del nombre original) y emite una **URL de subida (`PUT`) firmada y de un solo uso** (`issueSignedToken()` + `presignUrl()`, `@vercel/blob`) acotada a ese `pathname` exacto — nunca a "cualquier lugar del store".
2. El navegador sube el archivo **directo** a Vercel Blob con un `fetch(presignedUrl, { method: 'PUT', body: file, headers: {...} })` crudo (`frontend/src/services/api.ts` → `uploadFileViaClientToken()`/`putToPresignedUrl()`), sin pasar por el backend. El frontend no depende de ningún paquete de Vercel Blob — la única lógica del lado del cliente es un `fetch` PUT plano.
3. **`POST .../confirm`**: el backend vuelve a validar permisos (nunca confía en la validación del paso 1 sola) y en que el pathname devuelto por el cliente empiece con el prefijo esperado para ese recurso (defensa en profundidad) — recién ahí crea/actualiza la fila en MySQL con la referencia (`pathname` + metadata), igual que antes.

**Autenticación — OIDC del deployment, no un token estático**: el store conectado a `kineq-api` provee `BLOB_READ_WRITE_TOKEN_STORE_ID` (el store id) — corriendo dentro de Vercel, cada invocación de Function ya trae `VERCEL_OIDC_TOKEN` inyectado automáticamente por la plataforma, sin ninguna configuración manual. El SDK (`@vercel/blob@2.8.0`) usa OIDC en cuanto se le pasa `storeId` explícitamente a cualquier llamada (`del`, `get`, `issueSignedToken`) — nunca de forma implícita. `getBlobStoreId()` (`blobStorage.ts`) centraliza la lectura de esa variable y falla con un error claro si no está seteada. **`BLOB_READ_WRITE_TOKEN` ya no se lee en ningún lado del código** (confirmado: cero referencias a `process.env.BLOB_READ_WRITE_TOKEN` fuera de esta nota) — no hace falta generarlo, rotarlo ni configurarlo en ningún ambiente.

**Causa real de que los uploads fallaran aunque el store ya estuviera conectado al proyecto**: la implementación anterior (`generateClientTokenFromReadWriteToken`, `@vercel/blob/client`) nunca pasaba `storeId` a ninguna llamada del SDK — dependía enteramente del fallback por default a `process.env.BLOB_READ_WRITE_TOKEN`, que **nunca estuvo configurado en ningún ambiente** (ver historial de este archivo). Conectar un store a un proyecto en Vercel agrega `BLOB_READ_WRITE_TOKEN_STORE_ID`/`BLOB_READ_WRITE_TOKEN_WEBHOOK_PUBLIC_KEY` automáticamente, pero **ninguna de las dos es por sí sola una credencial utilizable** sin pasar explícitamente `storeId` al SDK (para OIDC) — de ahí que el store apareciera "conectado" y los uploads siguieran fallando. No fue un bug de código en las 4 superficies, fue una capa de autenticación (OIDC) nunca activada explícitamente.

**Nota de seguridad — resuelta (antes sin verificar)**: la implementación anterior no podía confirmar que `access: 'private'` quedara forzado del lado del servidor (el tipo de `generateClientTokenFromReadWriteToken` no exponía ningún campo `access`, ver commits previos). Con `presignUrl()`, `access` es un parámetro **explícito y obligatorio** de la llamada que arma la URL firmada — el nivel de acceso queda codificado en la firma misma, verificable por el propio tipo del SDK, ya no es una expectativa sin confirmar.

- **Storage**: [`@vercel/blob`](https://vercel.com/docs/storage/vercel-blob) `2.8.0` (backend únicamente — ya no es dependencia del frontend). Nunca binarios en MySQL — cada tabla/columna relacionada guarda solo `pathname` (clave dentro del blob store) + metadata (`nombreOriginal`, `mimeType`, `sizeBytes`).
- **Helpers compartidos** (`backend/src/blobStorage.ts`): `issuePresignedUploadUrl()` (URL de `PUT` firmada, reemplaza a `issueClientUploadToken()`), `withUniqueSuffix()`, `deleteFromBlob()`, `streamBlobToResponse()`, `getBlobStoreId()` (interno) — usados por las 4 rutas, nunca se llama a `del`/`get`/`issueSignedToken`/`presignUrl` de `@vercel/blob` directamente desde una ruta. `uploadToBlob()` (`put()` server-side directo) se eliminó por quedar sin ningún uso real — las 4 superficies ya subían todas vía client-direct-upload. `backend/src/uploadMiddleware.ts` (multipart vía `multer`) ya estaba eliminado de una ronda anterior.
- **Nunca la URL cruda de Vercel Blob al frontend**: cada recurso sigue exponiendo su propia ruta `.../contenido` (`GET`) para *leer* — valida consultorio/paciente/dueño y recién ahí llama a `get()` (con `storeId`, vía OIDC) y hace streaming de la respuesta. Sin cambios acá. Ver `AuthorizedImg.tsx` (imágenes) y `openAuthorizedFile()` en `services/api.ts` (archivos no-imagen, ej. PDF de un Estudio).
- **Logging técnico**: cada `catch` de `/upload-token(s)` loguea `[blob] issue upload url failed` con `resource`/el id del recurso/`errorCode`/`message` — nunca el token/URL firmada ni ninguna credencial. El cliente solo ve "No se pudo subir el archivo. Volvé a intentar."
- Detalle por superficie (modelo, endpoints, límites): `docs/modules/clinical-history.md` (Evolución y Estudio) y `docs/modules/users-and-roles.md`/`docs/modules/patients.md` (foto de Usuario/Paciente).

### Environment Variables

Solo una variable propia de Blob, y **Vercel la agrega sola** al conectar el store al proyecto — nunca hace falta copiarla a mano ni generarla:

- `BLOB_READ_WRITE_TOKEN_STORE_ID` — el store id. Junto con `VERCEL_OIDC_TOKEN` (inyectado por la plataforma en cada invocación dentro de Vercel, nunca configurable a mano) alcanza para autenticar todas las operaciones del SDK.
- `BLOB_READ_WRITE_TOKEN_WEBHOOK_PUBLIC_KEY` — no se usa en este proyecto (ver "Por qué no se usó el callback `onUploadCompleted`" más abajo); no es un secreto de escritura, nunca sirve como reemplazo de nada de lo anterior.
- `BLOB_READ_WRITE_TOKEN` (el token estático viejo) — **ya no se lee en ningún lado del código**. No hace falta configurarlo. Si existe una variable con este nombre agregada a mano en algún ambiente y no corresponde a una credencial real del store conectado, no se usa para nada — es seguro dejarla o borrarla.

**Local development** (no es el objetivo principal — la app funciona igual sin Blob configurado en local, la subida solo falla con un mensaje amigable): no hay `VERCEL_OIDC_TOKEN` corriendo `npm run dev` fuera de Vercel. Para probar Blob en local, preferir `vercel link` + `vercel env pull` (trae las variables reales del proyecto a un `.env.local`) en vez de copiar valores de Production al repo a mano. `backend/.env` documenta esto en el bloque de `BLOB_READ_WRITE_TOKEN_STORE_ID`.

**Por qué no se usó el callback `onUploadCompleted`/webhook de Vercel para confirmar el upload**: Vercel puede notificar al backend cuando termina un upload vía un callback HTTP que dispara hacia la función desplegada — pero ese callback nunca llega en desarrollo local (Vercel no puede alcanzar `localhost`), lo que hubiera dejado el flujo roto en dev. En su lugar, es el **propio cliente** el que llama a `/confirm` explícitamente después de que el `fetch` PUT resuelve en el navegador — funciona igual en local y en producción, sin depender de que Vercel pueda alcanzar el backend por su cuenta.

### Producción — pasos manuales pendientes

- El store `kineq-files` ya está conectado (Private) a `kineq-api` — no hace falta reconectarlo ni migrarlo, la conexión ya provee `BLOB_READ_WRITE_TOKEN_STORE_ID` automáticamente.
- **Redeploy requerido**: como con cualquier cambio de código, hay que desplegar esta versión de `kineq-api` para que el flujo OIDC quede activo — `VERCEL_OIDC_TOKEN` ya se inyecta solo en cada invocación una vez desplegado, no hace falta ninguna variable de entorno nueva a mano.
- No hace falta tocar Environment Variables en el dashboard de Vercel para este cambio — `BLOB_READ_WRITE_TOKEN_STORE_ID` ya está ahí desde que se conectó el store.
- **Prueba real pendiente en el deployment de Vercel** (no se pudo verificar contra la infraestructura real desde este entorno de desarrollo): subir una imagen de Evolución, un archivo de Estudio, una foto de Paciente y una foto de Usuario; confirmar que cada uno aparece en el Blob Store, que la fila en MySQL tiene el `pathname` correcto, que la miniatura/preview carga en la UI, y que eliminar hace desaparecer el archivo del store.

## PDFs generados en cliente (implementado)

Distinto del punto anterior: un PDF generado *on demand* (nunca persistido, nunca pasa por Vercel Blob) se arma **enteramente en el navegador** con `jspdf` (única dependencia agregada, sin plugin de tablas). Primer y único caso hoy: "Exportar plan de sesiones" del paciente (ver `docs/modules/patients.md`) — toma datos ya cargados/scopeados por endpoints existentes (`GET /api/turnos`, `GET /api/pacientes/:id`, `GET /api/consultorio`), nunca requiere un endpoint nuevo ni backend adicional. Si una futura funcionalidad necesita un PDF con datos que el cliente no tiene ya cargados de forma segura, evaluar en ese momento si conviene generarlo en el backend en cambio — este patrón (cliente) asume que todos los datos ya pasaron por endpoints scopeados por `consultorioId`.

## Título de la app

**Actualización (implementado)**: `frontend/index.html` tenía `<title>frontend</title>` (el default de Vite, nunca actualizado) — visible como el nombre de la pestaña del navegador en todo ambiente, dev y producción. Cambiado a `<title>Kineq</title>`. No hay ningún `document.title` dinámico en el resto del frontend que lo sobrescriba en tiempo de ejecución.