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