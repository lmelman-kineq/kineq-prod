import multer from 'multer'
import type { Request, Response, NextFunction, RequestHandler } from 'express'

type UploadConfig = {
  allowedMimeTypes: string[]
  maxSizeBytes: number
  maxFiles: number
  formatosLabel: string // ej. "JPG, PNG o WEBP" — para el mensaje de error
}

// Factory compartida por las 4 rutas de upload (Evolución, Estudio, foto de
// Usuario, foto de Paciente): mismo `memoryStorage` (nunca se escribe a
// disco — el archivo pasa directo a Vercel Blob), mismo manejo de errores
// de multer traducido a mensajes en español. Evita 4 bloques
// `multer({...}).array(...)(req,res,(err)=>{...})` casi idénticos.
export function createUploadHandler(fieldName: string, config: UploadConfig): RequestHandler {
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: config.maxSizeBytes, files: config.maxFiles },
    fileFilter: (_req, file, cb) => {
      if (!config.allowedMimeTypes.includes(file.mimetype)) {
        cb(new Error(`Formato no permitido. Solo se aceptan ${config.formatosLabel}.`))
        return
      }
      cb(null, true)
    },
  })

  const middleware = config.maxFiles > 1 ? upload.array(fieldName, config.maxFiles) : upload.single(fieldName)

  return (req: Request, res: Response, next: NextFunction) => {
    middleware(req, res, (err: unknown) => {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ error: `El archivo debe pesar como máximo ${Math.round(config.maxSizeBytes / (1024 * 1024))}MB.` })
        }
        if (err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE') {
          return res.status(400).json({ error: `Como máximo se pueden subir ${config.maxFiles} archivo(s) por vez.` })
        }
        return res.status(400).json({ error: 'No se pudo procesar el archivo.' })
      }
      if (err) return res.status(400).json({ error: err instanceof Error ? err.message : 'No se pudo procesar el archivo.' })
      next()
    })
  }
}
