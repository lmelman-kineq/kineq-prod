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

## Archivos: Vercel Blob (implementado)

Cuatro superficies suben archivos hoy: imágenes de Evolución, archivo adjunto de Estudio, foto de Usuario, foto de Paciente. Todas comparten la misma infraestructura, no hay implementaciones separadas:

- **Storage**: [`@vercel/blob`](https://vercel.com/docs/storage/vercel-blob), siempre con `access: 'private'`. Nunca binarios en MySQL — cada tabla/columna relacionada guarda solo `pathname` (clave dentro del blob store) + metadata (`nombreOriginal`, `mimeType`, `sizeBytes`).
- **Helpers compartidos** (`backend/src/blobStorage.ts`): `uploadToBlob()`, `deleteFromBlob()`, `streamBlobToResponse()` — usados por las 4 rutas, nunca se llama a `put`/`del`/`get` de `@vercel/blob` directamente desde una ruta. `backend/src/uploadMiddleware.ts` (`createUploadHandler()`) hace lo mismo para la configuración de `multer` (memoria, nunca disco) y sus mensajes de error.
- **Nunca la URL cruda de Vercel Blob al frontend**: cada recurso expone su propia ruta `.../contenido` (`GET`), que valida consultorio/paciente/dueño con las mismas reglas que el resto de la app y recién ahí llama a `get()` con el token del servidor y hace streaming de la respuesta. El frontend pide esa ruta con `fetch(credentials:'include')` (mismo mecanismo de sesión que el resto de `services/api.ts`) y arma un object URL local — ver `AuthorizedImg.tsx` (imágenes) y `openAuthorizedFile()` en `services/api.ts` (archivos no-imagen, ej. PDF de un Estudio).
- **Variable de entorno**: `BLOB_READ_WRITE_TOKEN`, requerida en todo ambiente que suba/lea archivos (local y producción). Sin ella, la subida falla con un mensaje amigable — el resto de la app sigue funcionando.
- Detalle por superficie (modelo, endpoints, límites): `docs/modules/clinical-history.md` (Evolución y Estudio) y `docs/modules/users-and-roles.md`/`docs/modules/patients.md` (foto de Usuario/Paciente).

**Actualización — sigue faltando `BLOB_READ_WRITE_TOKEN` real (verificado, no se inventó/fabricó)**: `backend/.env` no tiene esta variable configurada en ningún ambiente todavía (se agregó como placeholder vacío, comentado, con instrucciones — nunca un valor real). Se recibieron por separado un valor de `BLOB_READ_WRITE_TOKEN_WEBHOOK_PUBLIC_KEY` y uno de `BLOB_READ_WRITE_TOKEN_STORE_ID` — **no son equivalentes a un write token** y no se usaron como reemplazo: la Public Key es para verificar webhooks/firmar uploads client-side (una función de Vercel Blob que este proyecto no usa — todo upload pasa por el backend, nunca directo del navegador a Blob) y el Store ID solo tiene efecto junto con autenticación OIDC de Vercel (`VERCEL_OIDC_TOKEN`), no con un token estático como el que usa `blobStorage.ts`. Los tipos del SDK instalado (`@vercel/blob@2.8.0`) no mencionan ningún webhook en absoluto — confirmado por inspección directa de `node_modules/@vercel/blob/dist/index.d.ts`, no asumido. Mientras no exista un `BLOB_READ_WRITE_TOKEN` real, las 4 superficies de archivos siguen con su UI/backend completos pero la subida real falla (con el mensaje amigable esperado) en cualquier ambiente.

## Título de la app

**Actualización (implementado)**: `frontend/index.html` tenía `<title>frontend</title>` (el default de Vite, nunca actualizado) — visible como el nombre de la pestaña del navegador en todo ambiente, dev y producción. Cambiado a `<title>Kineq</title>`. No hay ningún `document.title` dinámico en el resto del frontend que lo sobrescriba en tiempo de ejecución.