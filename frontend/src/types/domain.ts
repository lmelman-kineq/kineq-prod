export type EstadoTurno =
  | 'ASIGNADO'
  | 'EN_ESPERA'
  | 'ATENDIENDO'
  | 'FINALIZADO'
  | 'AUSENTE'
  | 'CANCELADO'

export type RolUsuario = 'ADMINISTRADOR' | 'PROFESIONAL' | 'RECEPCION' | 'SUPERVISOR'

export interface Usuario {
  id: number
  nombre: string
  apellido: string
  email: string
  rol: RolUsuario
  consultorioId: number
  profesionalId: number | null
  activo?: boolean
  createdAt?: string
  profesional?: { id: number; nombre: string; apellido: string } | null
  // Ruta propia que sirve la foto (nunca la URL de Vercel Blob) — null si
  // todavía no cargó ninguna. Ver services/api.ts uploadUsuarioFoto().
  fotoUrl?: string | null
}

export interface Consultorio {
  id: number
  nombre: string
  slug: string
  email?: string | null
  telefono?: string | null
  direccion?: string | null
  ciudad?: string | null
  provincia?: string | null
  zonaHoraria: string
  activo: boolean
  createdAt: string
  updatedAt: string
}

export interface ObraSocial {
  id: number
  consultorioId: number | null
  esSistema: boolean
  oculta?: boolean
  nombre: string
  activo: boolean
  createdAt?: string
  updatedAt?: string
  _count?: { pacientes: number; turnos: number }
}

export interface Paciente {
  id: number
  consultorioId: number
  nombre: string
  apellido: string
  documento?: string | null
  fechaNacimiento?: string | null
  email?: string | null
  telefono?: string | null
  direccion?: string | null
  obraSocialId?: number | null
  numeroAfiliado?: string | null
  observaciones?: string | null
  activo: boolean
  obraSocial?: ObraSocial | null
  createdAt?: string
  updatedAt?: string
  // Ruta propia que sirve la foto (nunca la URL de Vercel Blob) — null si
  // todavía no cargó ninguna. Ver services/api.ts uploadPacienteFoto().
  fotoUrl?: string | null
}

export interface Especialidad {
  id: number
  consultorioId: number | null
  esSistema: boolean
  oculta?: boolean
  nombre: string
  color: string
  activo: boolean
  createdAt?: string
  updatedAt?: string
  _count?: { profesionales: number; turnos: number }
}

export interface Profesional {
  id: number
  consultorioId: number
  nombre: string
  apellido: string
  titulo?: string | null
  matricula?: string | null
  email?: string | null
  telefono?: string | null
  activo: boolean
  deletedAt?: string | null
  especialidades?: Array<{
    profesionalId: number
    especialidadId: number
    especialidad?: Especialidad
  }>
  usuario?: { id: number; nombre: string; apellido: string; email: string; activo: boolean } | null
  createdAt?: string
  updatedAt?: string
  _count?: { turnos: number; evoluciones: number }
}

export interface Turno {
  id: number
  consultorioId: number
  pacienteId: number
  profesionalId: number
  especialidadId: number
  obraSocialId?: number | null
  inicio: string
  duracionMinutos: number
  numeroSesion?: number | null
  esSesionConsulta?: boolean
  monto?: number | null
  notas?: string | null
  estado: EstadoTurno
  inicioAtencion?: string | null
  finAtencion?: string | null
  canceladoAt?: string | null
  grupoId?: number | null
  paciente: Paciente
  profesional: Profesional
  especialidad: Especialidad
  obraSocial?: ObraSocial | null
  grupo?: GrupoEvolucion | null
  createdAt?: string
  updatedAt?: string
}

export interface GrupoEvolucion {
  id: number
  consultorioId: number
  pacienteId: number
  nombre: string
  color: string
  // Sesiones totales previstas para este diagnóstico — opcional; con ella,
  // los turnos asociados muestran/calculan "Sesión X de Y" (ver
  // TurnoFormFields en FormFields.tsx). Sin ella, un grupo se comporta
  // exactamente igual que antes.
  cantidadSesionesPlanificadas?: number | null
  createdAt: string
  updatedAt: string
}

// Plantilla reutilizable de contenido para Evoluciones (V1) — de consultorio,
// nunca de un paciente/profesional en particular.
export interface PlantillaEvolucion {
  id: number
  consultorioId: number
  nombre: string
  contenido: string
  contenidoHtml?: string | null
  createdAt: string
  updatedAt: string
}

export interface EvolucionImagen {
  id: number
  evolucionId: number
  // Ruta propia del backend que sirve el contenido (nunca la URL de Vercel
  // Blob, que es privada) — ver services/api.ts uploadEvolucionImagenes().
  url: string
  nombreOriginal: string
  mimeType: string
  sizeBytes: number
  createdAt: string
}

export interface Evolucion {
  id: number
  consultorioId: number
  pacienteId: number
  profesionalId: number
  turnoId?: number | null
  grupoId?: number | null
  contenido: string
  /** Formato básico (negrita/cursiva/subrayado) ya sanitizado — null en evoluciones sin formato aplicado (incluidas todas las anteriores a esta función). */
  contenidoHtml?: string | null
  createdAt: string
  updatedAt: string
  paciente?: Paciente
  profesional?: Profesional
  turno?: Turno | null
  grupo?: GrupoEvolucion | null
  imagenes?: EvolucionImagen[]
}

export type EstadoFichaInicial = 'BORRADOR' | 'COMPLETA'
export type EstadoDatoClinico = 'SI' | 'NO' | 'NO_INFORMA'

export type CategoriaCatalogoClinico =
  | 'ANTECEDENTE_PERSONAL'
  | 'ANTECEDENTE_FAMILIAR'
  | 'PROCEDIMIENTO_QUIRURGICO'
  | 'ALERGIA'

export interface CatalogoClinicoItem {
  id: number
  categoria: CategoriaCatalogoClinico
  codigo: string
  nombre: string
  descripcion?: string | null
  activo: boolean
  esSistema: boolean
  consultorioId?: number | null
  orden: number
}

export interface FichaAntecedente {
  id: number
  consultorioId: number
  fichaInicialId: number
  catalogoItemId: number
  estado: 'SI' | 'NO'
  detalle?: string | null
  fechaAproximada?: string | null
  edadAproximada?: number | null
  parentesco?: string | null
  esAlertaClinica: boolean
  activo: boolean
  createdAt: string
  updatedAt: string
  catalogoItem: CatalogoClinicoItem
}

export type GravedadAlergia = 'LEVE' | 'MODERADA' | 'GRAVE'

export interface FichaAlergia {
  id: number
  consultorioId: number
  fichaInicialId: number
  catalogoItemId?: number | null
  nombreLibre?: string | null
  reaccion?: string | null
  gravedad?: GravedadAlergia | null
  observaciones?: string | null
  activa: boolean
  createdAt: string
  updatedAt: string
  catalogoItem?: CatalogoClinicoItem | null
}

export interface FichaMedicacion {
  id: number
  consultorioId: number
  fichaInicialId: number
  nombre: string
  dosis?: string | null
  unidad?: string | null
  frecuencia?: string | null
  via?: string | null
  motivo?: string | null
  observaciones?: string | null
  esAlertaClinica: boolean
  activa: boolean
  createdAt: string
  updatedAt: string
}

export interface FichaEstudioComplementario {
  id: number
  consultorioId: number
  fichaInicialId: number
  tipo: string
  fecha?: string | null
  resumen?: string | null
  observaciones?: string | null
  activo: boolean
  createdAt: string
  updatedAt: string
  // Archivo adjunto (PDF o imagen) — `archivoUrl` es la ruta propia que
  // sirve el contenido (nunca la URL de Vercel Blob), null si no hay
  // archivo cargado. Ver services/api.ts uploadEstudioArchivo().
  archivoUrl?: string | null
  archivoNombreOriginal?: string | null
  archivoMimeType?: string | null
  archivoSizeBytes?: number | null
}

export type SeccionFicha = 'MOTIVO' | 'ANTECEDENTES' | 'SEGURIDAD' | 'HABITOS' | 'DOLOR_FUNCION' | 'ESTUDIOS'
export type EstadoRevisionSeccion = 'PENDIENTE' | 'EN_PROGRESO' | 'REVISADA'

export interface FichaSeccionEstado {
  id: number
  consultorioId: number
  fichaInicialId: number
  seccion: SeccionFicha
  estado: EstadoRevisionSeccion
  updatedAt: string
}

// Alerta manual sobre un campo de texto libre de la Ficha Inicial (Motivo,
// Traumatismos, Tratamientos previos, Dolor y función, etc). La whitelist de
// campos elegibles (clave, sección, label) vive en utils/eligibleAlertFields.ts,
// espejo chico y deliberado del mismo whitelist del backend.
export interface FichaAlertaCampo {
  id: number
  consultorioId: number
  fichaInicialId: number
  campo: string
  createdAt: string
  // Contenido real del campo de origen al momento de renderizar — computado
  // en utils/clinicalAlerts.ts a partir de la FichaInicial, no persistido acá,
  // así que siempre refleja el valor actual del campo (ver ClinicalAlertsDetail.tsx).
  valor?: string | null
}

export interface FichaInicial {
  id: number
  consultorioId: number
  pacienteId: number
  profesionalResponsableId?: number | null
  motivoConsulta?: string | null
  fechaInicioProblema?: string | null
  diagnosticoDerivacion?: string | null
  objetivoPaciente?: string | null
  antecedentesPersonales?: string | null
  antecedentesFamiliares?: string | null
  cirugias?: string | null
  traumatismosAccidentes?: string | null
  tratamientosPrevios?: string | null
  alergiasEstado?: EstadoDatoClinico | null
  medicacionEstado?: EstadoDatoClinico | null
  enfermedadesActuales?: string | null
  actividadFisica?: string | null
  deportes?: string | null
  ocupacion?: string | null
  limitacionesFuncionales?: string | null
  estudiosComplementarios?: string | null
  dolorSintomas?: string | null
  hallazgosIniciales?: string | null
  observacionesClinicas?: string | null
  tabaquismoEstado?: EstadoDatoClinico | null
  aniosFumador?: number | null
  cigarrillosDiarios?: number | null
  alcoholEstado?: EstadoDatoClinico | null
  sedentarismoEstado?: EstadoDatoClinico | null
  ejercicioMinutosDia?: number | null
  menarcaEstado?: EstadoDatoClinico | null
  edadMenarca?: number | null
  menopausiaEstado?: EstadoDatoClinico | null
  edadMenopausia?: number | null
  gestas?: number | null
  partos?: number | null
  abortos?: number | null
  observacionesGineco?: string | null
  estado: EstadoFichaInicial
  createdAt: string
  updatedAt: string
  profesionalResponsable?: Profesional | null
  antecedentes?: FichaAntecedente[]
  alergias?: FichaAlergia[]
  medicaciones?: FichaMedicacion[]
  estudios?: FichaEstudioComplementario[]
  seccionesEstado?: FichaSeccionEstado[]
  alertasCampo?: FichaAlertaCampo[]
}

export type PacienteInput = Partial<
  Pick<
    Paciente,
    | 'nombre'
    | 'apellido'
    | 'documento'
    | 'fechaNacimiento'
    | 'direccion'
    | 'email'
    | 'telefono'
    | 'obraSocialId'
    | 'numeroAfiliado'
    | 'observaciones'
    | 'activo'
  >
>

export type FichaInicialInput = Partial<
  Omit<
    FichaInicial,
    | 'id'
    | 'consultorioId'
    | 'pacienteId'
    | 'createdAt'
    | 'updatedAt'
    | 'profesionalResponsable'
    | 'profesionalResponsableId'
    | 'antecedentes'
    | 'alergias'
    | 'medicaciones'
    | 'estudios'
    | 'seccionesEstado'
  >
>

export type FichaAntecedenteInput = {
  catalogoItemId: number
  estado: 'SI' | 'NO'
  detalle?: string
  fechaAproximada?: string
  edadAproximada?: number
  parentesco?: string
  esAlertaClinica?: boolean
}

export type FichaAlergiaInput = {
  catalogoItemId?: number
  nombreLibre?: string
  reaccion?: string
  gravedad?: GravedadAlergia
  observaciones?: string
}

export type FichaMedicacionInput = {
  nombre: string
  dosis?: string
  unidad?: string
  frecuencia?: string
  via?: string
  motivo?: string
  observaciones?: string
  esAlertaClinica?: boolean
}

export type FichaEstudioInput = {
  tipo: string
  fecha?: string
  resumen?: string
  observaciones?: string
}

export interface TurnoFilters {
  from?: string
  to?: string
  pacienteId?: number
  profesionalId?: number
  especialidadId?: number
  obraSocialId?: number
  estado?: EstadoTurno
}

export interface CreateTurnoInput {
  pacienteId: number
  profesionalId: number
  especialidadId: number
  obraSocialId?: number | null
  date: string
  time: string
  duracionMinutos: number
  numeroSesion?: number
  esSesionConsulta?: boolean
  monto?: number | null
  grupoId?: number | null
  notas?: string
  estado?: EstadoTurno
}

export type UpdateTurnoInput = Partial<CreateTurnoInput>

export interface UsuarioInput {
  nombre: string
  apellido: string
  email: string
  password: string
  rol: RolUsuario
  profesionalId?: number | null
}

export type UsuarioUpdateInput = Partial<Pick<UsuarioInput, 'nombre' | 'apellido' | 'rol' | 'profesionalId'>> & {
  activo?: boolean
}

export type ConsultorioInput = Partial<Pick<Consultorio, 'nombre' | 'email' | 'telefono' | 'direccion' | 'ciudad' | 'provincia' | 'zonaHoraria'>>

export type ProfesionalInput = Partial<Pick<Profesional, 'nombre' | 'apellido' | 'titulo' | 'matricula' | 'email' | 'telefono' | 'activo'>> & {
  especialidadIds?: number[]
  usuarioId?: number | null
}

export type EspecialidadInput = Partial<Pick<Especialidad, 'nombre' | 'color' | 'activo'>>

export type ObraSocialInput = Partial<Pick<ObraSocial, 'nombre' | 'activo'>>

export type GrupoEvolucionInput = { nombre: string; color: string; cantidadSesionesPlanificadas?: number | null }

export type PlantillaEvolucionInput = { nombre: string; contenido: string; contenidoHtml?: string | null }

// --- Estadísticas ---

export interface EstadisticasFiltros {
  desde: string
  hasta: string
  profesionalId?: number
  especialidadId?: number
}

export interface EstadisticasResumen {
  periodo: { desde: string; hasta: string; granularidad: 'dia' | 'semana' | 'mes' }
  kpis: {
    turnos: number
    sesionesRealizadas: number
    pacientesAtendidos: number
    ausentismo: { porcentaje: number | null; cantidad: number; denominador: number }
    cancelaciones: { porcentaje: number | null; cantidad: number }
    pacientesNuevos: number
    evolucionesRegistradas: number
    promedioSesionesPorPaciente: number | null
  }
  serieTemporal: Array<{ fecha: string; turnos: number; finalizados: number }>
  estados: Array<{ estado: EstadoTurno; cantidad: number }>
  porProfesional: Array<{ profesionalId: number; nombre: string; apellido: string; finalizados: number }>
  porEspecialidad: Array<{ especialidadId: number; nombre: string; color: string; finalizados: number }>
  resumenProfesionales: Array<{
    profesionalId: number
    nombre: string
    apellido: string
    turnos: number
    finalizados: number
    ausentes: number
    cancelados: number
    pacientesUnicos: number
  }>
}
