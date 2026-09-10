import 'dotenv/config'
import { PrismaMariaDb } from '@prisma/adapter-mariadb'
import { PrismaClient } from './generated/prisma/client'

// Toda la capa de persistencia trabaja con instantes UTC.
// El horario del consultorio se aplica solamente al convertir hacia/desde la UI.
process.env.TZ = 'UTC'

function getDatabaseConfig() {
  const databaseUrl = process.env.DATABASE_URL

  if (!databaseUrl) {
    throw new Error('DATABASE_URL no está definida en backend/.env')
  }

  const parsedUrl = new URL(databaseUrl)

  if (parsedUrl.protocol !== 'mysql:') {
    throw new Error('DATABASE_URL debe utilizar el protocolo mysql://')
  }

  const database = parsedUrl.pathname.replace(/^\//, '')

  if (!database) {
    throw new Error('DATABASE_URL debe incluir el nombre de la base de datos')
  }

  // Aiven (producción) exige TLS. Se activa con `?sslmode=require` (o
  // `?ssl=true`) en la DATABASE_URL; sin el parámetro no se toca la conexión,
  // así que el dev local sigue conectándose sin TLS.
  const sslmode = parsedUrl.searchParams.get('sslmode') || parsedUrl.searchParams.get('ssl')
  const useSsl = sslmode != null && !['', 'false', 'disable', 'disabled'].includes(sslmode.toLowerCase())

  return {
  host: parsedUrl.hostname,
  port: Number(parsedUrl.port || '3306'),
  user: decodeURIComponent(parsedUrl.username),
  password: decodeURIComponent(parsedUrl.password),
  database,
  connectionLimit: Number(process.env.DATABASE_CONNECTION_LIMIT || '5'),

  // MySQL 8 usa `caching_sha2_password`: sin TLS el driver necesita pedirle
  // la clave pública al server para poder autenticar. Necesario para el dev
  // local; en producción la conexión va por TLS y esto es inocuo.
  allowPublicKeyRetrieval: true,
  ...(useSsl ? { ssl: { rejectUnauthorized: false } } : {}),

  connectTimeout: Number(
    process.env.DATABASE_CONNECT_TIMEOUT || '10000'
  ),
  acquireTimeout: Number(
    process.env.DATABASE_ACQUIRE_TIMEOUT || '20000'
  ),

  // Guardamos y leemos todos los DateTime de Prisma como UTC.
  // Evita que el adapter MariaDB aplique dos veces el huso horario local.
  timezone: 'Z',
  } 
}

const adapter = new PrismaMariaDb(getDatabaseConfig())
const prisma = new PrismaClient({ adapter })

export default prisma
