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

## Archivos: Vercel Blob, upload directo cliente → Blob (implementado)

Cuatro superficies suben archivos hoy: imágenes de Evolución, archivo adjunto de Estudio, foto de Usuario, foto de Paciente. Todas comparten la misma infraestructura, no hay implementaciones separadas.

**Por qué no pasan por la función Serverless del backend**: Vercel limita a ~4.5MB el body de un request a una Serverless Function — un límite de la *plataforma*, no de esta app. Los límites propios de Kineq son más grandes (10MB por imagen de Evolución, hasta 50MB en un `POST` con 5 imágenes; 15MB Estudio; 5MB foto) — con el archivo pasando por el backend (`multer` + `Buffer`, como funcionaba antes), cualquier archivo real por encima de ~4.5MB nunca llegaba ni a esta función, con o sin `BLOB_READ_WRITE_TOKEN` configurado. Encontrado auditando el flujo de punta a punta a pedido explícito ("no dar la tarea por cerrada solo porque compila") — no había ningún bug de código en las 4 superficies, era un límite de plataforma no documentado en ningún lado del proyecto hasta ahora.

**Solución implementada — upload directo navegador → Vercel Blob**, la que el propio Vercel documenta para este caso: el archivo nunca pasa por la función Serverless, así que el límite de 4.5MB no aplica. Tres pasos, iguales en las 4 superficies:

1. **`POST .../upload-token`** (o `.../upload-tokens`, plural, solo para imágenes de Evolución que pueden ser varias en una operación): el backend valida todo lo que antes validaba en el `POST` único (recurso existe, permisos/rol/vínculo profesional, formato MIME permitido, tamaño máximo, cupo de 5 imágenes por evolución) y, si todo está bien, emite un **token de cliente de un solo uso** (`generateClientTokenFromReadWriteToken`, `@vercel/blob/client`) acotado a un `pathname` exacto — nunca a "cualquier lugar del store".
2. El navegador sube el archivo **directo** a Vercel Blob con ese token (`put()`/`upload()` de `@vercel/blob/client`, `frontend/src/services/api.ts` → `uploadFileViaClientToken()`), sin pasar por el backend.
3. **`POST .../confirm`**: el backend vuelve a validar permisos (nunca confía en la validación del paso 1 sola) y en el pathname devuelto por el cliente empiece con el prefijo esperado para ese recurso (defensa en profundidad — el token en sí ya restringía dónde se pudo escribir, esto además evita que `/confirm` acepte metadata de un pathname ajeno) — recién ahí crea/actualiza la fila en MySQL con la referencia (`pathname` + metadata), igual que antes.

**Nota de seguridad importante, sin verificar contra Vercel real**: los tipos del SDK instalado (`@vercel/blob@2.8.0`) para `generateClientTokenFromReadWriteToken`/`handleUpload` **no incluyen ningún campo `access`** entre lo que el servidor puede restringir en el token — el nivel de acceso (`private`/`public`) solo se especifica del lado del navegador, en `put()`. El código siempre hardcodea `access: 'private'` en el único lugar donde se especifica (nunca expuesto como opción editable), y es razonable esperar que Vercel fuerce privado igual del lado del servidor para uploads con token de cliente — pero no se pudo confirmar de forma concluyente sin un `BLOB_READ_WRITE_TOKEN` real para probar contra la infraestructura real de Vercel. **Verificar apenas se configure el token real**: subir un archivo de prueba y confirmar que su URL de Blob no es accesible sin sesión (ver "Configurar `BLOB_READ_WRITE_TOKEN`" más abajo).

- **Storage**: [`@vercel/blob`](https://vercel.com/docs/storage/vercel-blob). Nunca binarios en MySQL — cada tabla/columna relacionada guarda solo `pathname` (clave dentro del blob store) + metadata (`nombreOriginal`, `mimeType`, `sizeBytes`).
- **Helpers compartidos** (`backend/src/blobStorage.ts`): `issueClientUploadToken()` (nuevo, emite el token de cliente), `deleteFromBlob()`, `streamBlobToResponse()` — usados por las 4 rutas, nunca se llama a `put`/`del`/`get`/`generateClientTokenFromReadWriteToken` de `@vercel/blob` directamente desde una ruta. `backend/src/uploadMiddleware.ts` (multipart vía `multer`) se eliminó — ya no hace falta, ningún archivo llega al backend como body de request. La dependencia `multer`/`@types/multer` se sacó de `backend/package.json` por quedar sin uso.
- **Nunca la URL cruda de Vercel Blob al frontend**: cada recurso sigue exponiendo su propia ruta `.../contenido` (`GET`) para *leer* — valida consultorio/paciente/dueño y recién ahí llama a `get()` con el token del servidor y hace streaming de la respuesta. Sin cambios acá, esto no se tocó. Ver `AuthorizedImg.tsx` (imágenes) y `openAuthorizedFile()` en `services/api.ts` (archivos no-imagen, ej. PDF de un Estudio).
- Detalle por superficie (modelo, endpoints, límites): `docs/modules/clinical-history.md` (Evolución y Estudio) y `docs/modules/users-and-roles.md`/`docs/modules/patients.md` (foto de Usuario/Paciente).

### Configurar `BLOB_READ_WRITE_TOKEN` (pendiente en todo ambiente)

Sigue sin configurarse un token real en ningún ambiente (local ni producción) — verificado, no se inventó/fabricó. Sin él, `issueClientUploadToken()` falla al pedir el token (mensaje amigable al cliente, error real logueado server-side). Pasos:

1. En [vercel.com](https://vercel.com), proyecto `kineq-api` → pestaña **Storage** → **Create Database** → **Blob** (si no existe ya un store).
2. Conectar el store al proyecto — Vercel agrega `BLOB_READ_WRITE_TOKEN` automáticamente a **Production** (y Preview/Development si corresponde).
3. Copiar el mismo valor a `backend/.env` (línea `BLOB_READ_WRITE_TOKEN=`) para desarrollo local.
4. Re-desplegar en Vercel — la variable no se inyecta en deploys ya hechos.

Los valores recibidos por separado (`BLOB_READ_WRITE_TOKEN_WEBHOOK_PUBLIC_KEY`, `BLOB_READ_WRITE_TOKEN_STORE_ID`) **no son equivalentes a un write token** y no se usaron como reemplazo — la Public Key es para verificar firmas de webhook (no usado acá, `/confirm` no depende del callback `onUploadCompleted` de Vercel — ver más abajo) y el Store ID solo tiene efecto junto con autenticación OIDC de Vercel, no con el token estático que usa este proyecto.

**Por qué no se usó el callback `onUploadCompleted`/webhook de Vercel para confirmar el upload**: `handleUpload` (la variante más "automática" del SDK) puede notificar al backend cuando termina un upload vía un callback HTTP que Vercel dispara hacia la función desplegada — pero ese callback nunca llega en desarrollo local (Vercel no puede alcanzar `localhost`), lo que hubiera dejado el flujo roto en dev. En su lugar, es el **propio cliente** el que llama a `/confirm` explícitamente después de que `put()` resuelve en el navegador — funciona igual en local y en producción, sin depender de que Vercel pueda alcanzar el backend por su cuenta.

## Título de la app

**Actualización (implementado)**: `frontend/index.html` tenía `<title>frontend</title>` (el default de Vite, nunca actualizado) — visible como el nombre de la pestaña del navegador en todo ambiente, dev y producción. Cambiado a `<title>Kineq</title>`. No hay ningún `document.title` dinámico en el resto del frontend que lo sobrescriba en tiempo de ejecución.