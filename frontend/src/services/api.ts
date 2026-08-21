import type {
  CatalogoClinicoItem,
  CategoriaCatalogoClinico,
  Consultorio,
  ConsultorioInput,
  CreateTurnoInput,
  Especialidad,
  EspecialidadInput,
  EstadisticasFiltros,
  EstadisticasResumen,
  Evolucion,
  EvolucionImagen,
  FichaAlergia,
  FichaAlergiaInput,
  FichaAlertaCampo,
  FichaAntecedente,
  FichaAntecedenteInput,
  FichaEstudioComplementario,
  FichaEstudioInput,
  FichaInicial,
  FichaInicialInput,
  FichaMedicacion,
  FichaMedicacionInput,
  GrupoEvolucion,
  GrupoEvolucionInput,
  ObraSocial,
  ObraSocialInput,
  Paciente,
  PacienteInput,
  Profesional,
  ProfesionalInput,
  Turno,
  TurnoFilters,
  UpdateTurnoInput,
  Usuario,
  UsuarioInput,
  UsuarioUpdateInput,
} from '../types/domain'
import { DEFAULT_TIMEZONE, zonedTimeToUtcIso } from '../utils/timezone'
import { put as blobPut } from '@vercel/blob/client'

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000'

// Zona horaria del consultorio activo, para interpretar la fecha/hora que
// se tipea en los formularios de turno — nunca la zona local del
// navegador. App.tsx la setea una vez apenas carga el consultorio de la
// sesión; hasta entonces se usa el default (Buenos Aires).
let consultorioTimeZone = DEFAULT_TIMEZONE

export function setConsultorioTimeZone(zone: string): void {
  consultorioTimeZone = zone
}

export function getConsultorioTimeZone(): string {
  return consultorioTimeZone
}

type ApiErrorBody = {
  error?: string
  message?: string
}

export class ApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      // FormData (subida de imágenes) necesita que el navegador arme el
      // Content-Type con el boundary del multipart — si lo forzamos acá a
      // application/json, el backend no puede parsear el body.
      ...(init?.body && !(init.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
  })

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as ApiErrorBody
    throw new ApiError(body.error ?? body.message ?? `Error HTTP ${response.status}`, response.status)
  }

  if (response.status === 204) return undefined as T

  return response.json() as Promise<T>
}

// Upload directo navegador → Vercel Blob, nunca a través de nuestra propia
// función Serverless (que en Vercel tiene un límite de body de ~4.5MB,
// bastante menor que los límites propios de la app — ver
// docs/architecture.md). Tres pasos: 1) pedirle un token de subida acotado
// a este archivo puntual al backend, 2) subir directo con ese token,
// 3) confirmar para que el backend guarde la referencia (nunca se confía
// en que el pathname que vuelve del cliente sea legítimo sin más — el
// backend revalida permisos y el prefijo esperado en /confirm).
// `access: 'private'` siempre hardcodeado acá, nunca expuesto como opción:
// es la única superficie donde se especifica el nivel de acceso del blob.
async function uploadFileViaClientToken<T>(
  uploadTokenUrl: string,
  confirmUrl: string,
  file: File,
): Promise<T> {
  const { token, pathname } = await request<{ token: string; pathname: string }>(uploadTokenUrl, {
    method: 'POST',
    body: JSON.stringify({ nombreOriginal: file.name, mimeType: file.type, sizeBytes: file.size }),
  })
  const uploaded = await blobPut(pathname, file, { access: 'private', token, contentType: file.type })
  return request<T>(confirmUrl, {
    method: 'POST',
    body: JSON.stringify({ pathname: uploaded.pathname, nombreOriginal: file.name, mimeType: file.type, sizeBytes: file.size }),
  })
}

// Único punto donde se hace fetch a un archivo servido por una ruta
// "/contenido" (imágenes de Evolución, archivo de Estudio, foto de Usuario/
// Paciente): todas viven detrás de Vercel Blob privado, así que nunca se
// linkea directo a una URL — siempre se pide con la misma sesión (cookies)
// que el resto de la app y se arma un object URL local. Usado tanto por
// <AuthorizedImg> (para mostrar la imagen) como por openAuthorizedFile
// (para "ver"/descargar un archivo que no es una imagen, ej. un PDF).
export async function fetchAuthorizedBlob(path: string): Promise<Blob> {
  const response = await fetch(`${BASE_URL}${path}`, { credentials: 'include' })
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as ApiErrorBody
    throw new ApiError(body.error ?? body.message ?? `Error HTTP ${response.status}`, response.status)
  }
  return response.blob()
}

export async function openAuthorizedFile(path: string): Promise<void> {
  const blob = await fetchAuthorizedBlob(path)
  const url = URL.createObjectURL(blob)
  window.open(url, '_blank', 'noopener')
  // Se revoca con demora (no de inmediato): la pestaña nueva todavía tiene
  // que terminar de cargar el object URL.
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

function normalizeDateBoundary(value: string, endOfDay: boolean): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return value

  const time = endOfDay ? '23:59:59.999' : '00:00:00.000'
  return new Date(`${value}T${time}`).toISOString()
}

function buildQuery(params?: TurnoFilters): string {
  if (!params) return ''

  const query = new URLSearchParams()

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return

    if ((key === 'from' || key === 'to') && typeof value === 'string') {
      query.set(key, normalizeDateBoundary(value, key === 'to'))
      return
    }

    query.set(key, String(value))
  })

  const result = query.toString()
  return result ? `?${result}` : ''
}

function toInicio(date: string, time: string): string {
  // La fecha/hora del turno se interpreta en la zona horaria del
  // consultorio, no en la del navegador de quien está cargando el turno.
  const localDate = new Date(`${date}T${time}:00`)
  if (Number.isNaN(localDate.getTime())) {
    throw new Error('La fecha o la hora del turno no son válidas.')
  }

  return zonedTimeToUtcIso(date, time, consultorioTimeZone)
}

// AUTENTICACIÓN

export function login(email: string, password: string): Promise<Usuario> {
  return request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) })
}

export function logout(): Promise<void> {
  return request('/auth/logout', { method: 'POST' })
}

export function getMe(): Promise<Usuario> {
  return request('/auth/me')
}

export function register(data: {
  nombreConsultorio: string
  nombre: string
  apellido: string
  email: string
  password: string
  confirmPassword: string
}): Promise<Usuario> {
  return request('/auth/register', { method: 'POST', body: JSON.stringify(data) })
}

// El consultorio activo lo determina la sesión del usuario autenticado
// (cookie httpOnly); ningún llamado necesita ni acepta un consultorioId.

export function getConsultorio(): Promise<Consultorio> {
  return request('/api/consultorio')
}

export function patchConsultorio(data: ConsultorioInput): Promise<Consultorio> {
  return request('/api/consultorio', {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}

export function getUsuarios(): Promise<Usuario[]> {
  return request('/api/usuarios')
}

export function createUsuario(data: UsuarioInput): Promise<Usuario> {
  return request('/api/usuarios', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export function patchUsuario(usuarioId: number, data: UsuarioUpdateInput): Promise<Usuario> {
  return request(`/api/usuarios/${usuarioId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}

// Foto de perfil: siempre "la propia" — no existe (ni existía antes) una
// ruta de autoedición de Usuario más allá de esto, ver
// backend/src/usuarioFotoRoutes.ts.
export function uploadUsuarioFoto(file: File): Promise<{ fotoUrl: string }> {
  return uploadFileViaClientToken('/api/usuarios/me/foto/upload-token', '/api/usuarios/me/foto/confirm', file)
}

export function deleteUsuarioFoto(): Promise<void> {
  return request('/api/usuarios/me/foto', { method: 'DELETE' })
}

export function getPacientes(): Promise<Paciente[]> {
  return request('/api/pacientes')
}

export function uploadPacienteFoto(pacienteId: number, file: File): Promise<{ fotoUrl: string }> {
  return uploadFileViaClientToken(`/api/pacientes/${pacienteId}/foto/upload-token`, `/api/pacientes/${pacienteId}/foto/confirm`, file)
}

export function deletePacienteFoto(pacienteId: number): Promise<void> {
  return request(`/api/pacientes/${pacienteId}/foto`, { method: 'DELETE' })
}

export function getPaciente(pacienteId: number): Promise<Paciente> {
  return request(`/api/pacientes/${pacienteId}`)
}

export function createPaciente(data: PacienteInput): Promise<Paciente> {
  return request('/api/pacientes', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export function patchPaciente(pacienteId: number, data: PacienteInput): Promise<Paciente> {
  return request(`/api/pacientes/${pacienteId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}

// `incluirInactivos` solo tiene efecto para un usuario ADMINISTRADOR (lo
// valida el backend); el resto de la app lo deja en false para no listar
// profesionales/especialidades/obras sociales dadas de baja.
export function getProfesionales(incluirInactivos = false): Promise<Profesional[]> {
  return request(`/api/profesionales${incluirInactivos ? '?estado=todos' : ''}`)
}

export function createProfesional(data: ProfesionalInput): Promise<Profesional> {
  return request('/api/profesionales', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export function patchProfesional(profesionalId: number, data: ProfesionalInput): Promise<Profesional> {
  return request(`/api/profesionales/${profesionalId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}

export function deleteProfesional(profesionalId: number): Promise<void> {
  return request(`/api/profesionales/${profesionalId}`, { method: 'DELETE' })
}

export function archivarProfesional(profesionalId: number): Promise<void> {
  return request(`/api/profesionales/${profesionalId}/archivar`, { method: 'POST' })
}

export function restaurarProfesional(profesionalId: number): Promise<void> {
  return request(`/api/profesionales/${profesionalId}/archivar`, { method: 'DELETE' })
}

export function getEspecialidades(incluirInactivos = false, incluirOcultas = false): Promise<Especialidad[]> {
  const params = new URLSearchParams()
  if (incluirInactivos) params.set('estado', 'todos')
  if (incluirOcultas) params.set('incluirOcultas', 'true')
  const query = params.toString()
  return request(`/api/especialidades${query ? `?${query}` : ''}`)
}

export function ocultarEspecialidad(especialidadId: number): Promise<void> {
  return request(`/api/especialidades/${especialidadId}/ocultar`, { method: 'POST' })
}

export function restaurarEspecialidad(especialidadId: number): Promise<void> {
  return request(`/api/especialidades/${especialidadId}/ocultar`, { method: 'DELETE' })
}

export function patchEspecialidad(especialidadId: number, data: EspecialidadInput): Promise<Especialidad> {
  return request(`/api/especialidades/${especialidadId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}

export function deleteEspecialidad(especialidadId: number): Promise<void> {
  return request(`/api/especialidades/${especialidadId}`, { method: 'DELETE' })
}

export function getObrasSociales(incluirInactivos = false, incluirOcultas = false): Promise<ObraSocial[]> {
  const params = new URLSearchParams()
  if (incluirInactivos) params.set('estado', 'todos')
  if (incluirOcultas) params.set('incluirOcultas', 'true')
  const query = params.toString()
  return request(`/api/obras-sociales${query ? `?${query}` : ''}`)
}

export function ocultarObraSocial(obraSocialId: number): Promise<void> {
  return request(`/api/obras-sociales/${obraSocialId}/ocultar`, { method: 'POST' })
}

export function restaurarObraSocial(obraSocialId: number): Promise<void> {
  return request(`/api/obras-sociales/${obraSocialId}/ocultar`, { method: 'DELETE' })
}

export function patchObraSocial(obraSocialId: number, data: ObraSocialInput): Promise<ObraSocial> {
  return request(`/api/obras-sociales/${obraSocialId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}

export function deleteObraSocial(obraSocialId: number): Promise<void> {
  return request(`/api/obras-sociales/${obraSocialId}`, { method: 'DELETE' })
}

export function getTurnos(params?: TurnoFilters): Promise<Turno[]> {
  return request(`/api/turnos${buildQuery(params)}`)
}

export function createEspecialidad(nombre: string, color: string): Promise<Especialidad> {
  return request('/api/especialidades', {
    method: 'POST',
    body: JSON.stringify({ nombre, color }),
  })
}

export function createObraSocial(nombre: string): Promise<ObraSocial> {
  return request('/api/obras-sociales', {
    method: 'POST',
    body: JSON.stringify({ nombre }),
  })
}

export function createTurno(data: CreateTurnoInput): Promise<Turno> {
  const { date, time, ...rest } = data

  return request('/api/turnos', {
    method: 'POST',
    body: JSON.stringify({
      ...rest,
      inicio: toInicio(date, time),
    }),
  })
}

export function patchTurno(turnoId: number, data: UpdateTurnoInput): Promise<Turno> {
  const { date, time, ...rest } = data
  const payload: Record<string, unknown> = { ...rest }

  if (date !== undefined || time !== undefined) {
    if (!date || !time) {
      throw new Error('Para cambiar el horario se necesitan la fecha y la hora.')
    }

    payload.inicio = toInicio(date, time)
  }

  return request(`/api/turnos/${turnoId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

// Baja lógica en el backend (Turno.eliminadoAt) — nunca DELETE físico.
export function deleteTurno(turnoId: number): Promise<void> {
  return request(`/api/turnos/${turnoId}`, { method: 'DELETE' })
}

export function getEvoluciones(pacienteId?: number): Promise<Evolucion[]> {
  const query = pacienteId ? `?pacienteId=${pacienteId}` : ''
  return request(`/api/evoluciones${query}`)
}

export function createEvolucion(payload: {
  pacienteId: number
  profesionalId?: number
  turnoId?: number
  grupoId?: number | null
  contenido: string
  contenidoHtml?: string | null
}): Promise<Evolucion> {
  return request('/api/evoluciones', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function patchEvolucion(evolucionId: number, data: { contenido?: string; contenidoHtml?: string | null; grupoId?: number | null }): Promise<Evolucion> {
  return request(`/api/evoluciones/${evolucionId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}

export function deleteEvolucion(evolucionId: number): Promise<void> {
  return request(`/api/evoluciones/${evolucionId}`, { method: 'DELETE' })
}

// Mismo patrón de 3 pasos que uploadFileViaClientToken, pero para varias
// imágenes en una sola operación de evolución — un solo /upload-tokens pide
// un token por archivo, cada uno se sube en paralelo directo a Blob, y un
// solo /confirm guarda todas las referencias juntas.
export async function uploadEvolucionImagenes(evolucionId: number, files: File[]): Promise<EvolucionImagen[]> {
  const { items: tokenItems } = await request<{ items: Array<{ token: string; pathname: string }> }>(
    `/api/evoluciones/${evolucionId}/imagenes/upload-tokens`,
    {
      method: 'POST',
      body: JSON.stringify({ files: files.map((file) => ({ nombreOriginal: file.name, mimeType: file.type, sizeBytes: file.size })) }),
    },
  )

  const confirmedItems = await Promise.all(files.map(async (file, index) => {
    const uploaded = await blobPut(tokenItems[index].pathname, file, { access: 'private', token: tokenItems[index].token, contentType: file.type })
    return { pathname: uploaded.pathname, nombreOriginal: file.name, mimeType: file.type, sizeBytes: file.size }
  }))

  return request(`/api/evoluciones/${evolucionId}/imagenes/confirm`, {
    method: 'POST',
    body: JSON.stringify({ items: confirmedItems }),
  })
}

export function deleteEvolucionImagen(evolucionId: number, imagenId: number): Promise<void> {
  return request(`/api/evoluciones/${evolucionId}/imagenes/${imagenId}`, { method: 'DELETE' })
}

export function getGruposEvolucion(pacienteId: number): Promise<GrupoEvolucion[]> {
  return request(`/api/pacientes/${pacienteId}/grupos-evolucion`)
}

export function createGrupoEvolucion(pacienteId: number, data: GrupoEvolucionInput): Promise<GrupoEvolucion> {
  return request(`/api/pacientes/${pacienteId}/grupos-evolucion`, {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export function patchGrupoEvolucion(id: number, data: Partial<GrupoEvolucionInput>): Promise<GrupoEvolucion> {
  return request(`/api/grupos-evolucion/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}

export function deleteGrupoEvolucion(id: number): Promise<void> {
  return request(`/api/grupos-evolucion/${id}`, { method: 'DELETE' })
}

export async function getProximaSesion(grupoId: number): Promise<number> {
  const result = await request<{ numeroSesion: number }>(`/api/grupos-evolucion/${grupoId}/proxima-sesion`)
  return result.numeroSesion
}

export function getFichaInicial(pacienteId: number): Promise<FichaInicial | null> {
  return request(`/api/pacientes/${pacienteId}/ficha-inicial`)
}

export function patchFichaInicial(pacienteId: number, data: FichaInicialInput): Promise<FichaInicial> {
  return request(`/api/pacientes/${pacienteId}/ficha-inicial`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}

export function getCatalogoClinico(categoria?: CategoriaCatalogoClinico, q?: string): Promise<CatalogoClinicoItem[]> {
  const params = new URLSearchParams()
  if (categoria) params.set('categoria', categoria)
  if (q) params.set('q', q)
  const query = params.toString()
  return request(`/api/catalogo-clinico${query ? `?${query}` : ''}`)
}

export function createCatalogoClinicoItem(categoria: CategoriaCatalogoClinico, nombre: string): Promise<CatalogoClinicoItem> {
  return request('/api/catalogo-clinico', {
    method: 'POST',
    body: JSON.stringify({ categoria, nombre }),
  })
}

export function updateCatalogoClinicoItem(id: number, nombre: string): Promise<CatalogoClinicoItem> {
  return request(`/api/catalogo-clinico/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ nombre }),
  })
}

export function deleteCatalogoClinicoItem(id: number): Promise<void> {
  return request(`/api/catalogo-clinico/${id}`, { method: 'DELETE' })
}

export function createFichaAntecedente(pacienteId: number, data: FichaAntecedenteInput): Promise<FichaAntecedente> {
  return request(`/api/pacientes/${pacienteId}/ficha-inicial/antecedentes`, {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export function patchFichaAntecedente(id: number, data: Partial<FichaAntecedenteInput>): Promise<FichaAntecedente> {
  return request(`/api/ficha-antecedentes/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}

export function deleteFichaAntecedente(id: number): Promise<void> {
  return request(`/api/ficha-antecedentes/${id}`, { method: 'DELETE' })
}

export function createFichaAlergia(pacienteId: number, data: FichaAlergiaInput): Promise<FichaAlergia> {
  return request(`/api/pacientes/${pacienteId}/ficha-inicial/alergias`, {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export function patchFichaAlergia(id: number, data: Partial<FichaAlergiaInput>): Promise<FichaAlergia> {
  return request(`/api/ficha-alergias/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}

export function deleteFichaAlergia(id: number): Promise<void> {
  return request(`/api/ficha-alergias/${id}`, { method: 'DELETE' })
}

export function createFichaMedicacion(pacienteId: number, data: FichaMedicacionInput): Promise<FichaMedicacion> {
  return request(`/api/pacientes/${pacienteId}/ficha-inicial/medicacion`, {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export function patchFichaMedicacion(id: number, data: Partial<FichaMedicacionInput>): Promise<FichaMedicacion> {
  return request(`/api/ficha-medicacion/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}

export function deleteFichaMedicacion(id: number): Promise<void> {
  return request(`/api/ficha-medicacion/${id}`, { method: 'DELETE' })
}

export function createFichaEstudio(pacienteId: number, data: FichaEstudioInput): Promise<FichaEstudioComplementario> {
  return request(`/api/pacientes/${pacienteId}/ficha-inicial/estudios`, {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export function patchFichaEstudio(id: number, data: Partial<FichaEstudioInput>): Promise<FichaEstudioComplementario> {
  return request(`/api/ficha-estudios/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}

export function deleteFichaEstudio(id: number): Promise<void> {
  return request(`/api/ficha-estudios/${id}`, { method: 'DELETE' })
}

export function uploadEstudioArchivo(estudioId: number, file: File): Promise<FichaEstudioComplementario> {
  return uploadFileViaClientToken(`/api/ficha-estudios/${estudioId}/archivo/upload-token`, `/api/ficha-estudios/${estudioId}/archivo/confirm`, file)
}

export function deleteEstudioArchivo(estudioId: number): Promise<void> {
  return request(`/api/ficha-estudios/${estudioId}/archivo`, { method: 'DELETE' })
}

export function putAlertaCampo(pacienteId: number, campo: string): Promise<FichaAlertaCampo> {
  return request(`/api/pacientes/${pacienteId}/ficha-inicial/alertas-campo/${campo}`, { method: 'PUT' })
}

export function deleteAlertaCampo(pacienteId: number, campo: string): Promise<void> {
  return request(`/api/pacientes/${pacienteId}/ficha-inicial/alertas-campo/${campo}`, { method: 'DELETE' })
}

export function getEstadisticasResumen(filtros: EstadisticasFiltros): Promise<EstadisticasResumen> {
  const query = new URLSearchParams()
  query.set('desde', normalizeDateBoundary(filtros.desde, false))
  query.set('hasta', normalizeDateBoundary(filtros.hasta, true))
  if (filtros.profesionalId) query.set('profesionalId', String(filtros.profesionalId))
  if (filtros.especialidadId) query.set('especialidadId', String(filtros.especialidadId))
  return request(`/api/estadisticas/resumen?${query.toString()}`)
}
