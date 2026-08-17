"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createUploadHandler = createUploadHandler;
const multer_1 = __importDefault(require("multer"));
// Factory compartida por las 4 rutas de upload (Evolución, Estudio, foto de
// Usuario, foto de Paciente): mismo `memoryStorage` (nunca se escribe a
// disco — el archivo pasa directo a Vercel Blob), mismo manejo de errores
// de multer traducido a mensajes en español. Evita 4 bloques
// `multer({...}).array(...)(req,res,(err)=>{...})` casi idénticos.
function createUploadHandler(fieldName, config) {
    const upload = (0, multer_1.default)({
        storage: multer_1.default.memoryStorage(),
        limits: { fileSize: config.maxSizeBytes, files: config.maxFiles },
        fileFilter: (_req, file, cb) => {
            if (!config.allowedMimeTypes.includes(file.mimetype)) {
                cb(new Error(`Formato no permitido. Solo se aceptan ${config.formatosLabel}.`));
                return;
            }
            cb(null, true);
        },
    });
    const middleware = config.maxFiles > 1 ? upload.array(fieldName, config.maxFiles) : upload.single(fieldName);
    return (req, res, next) => {
        middleware(req, res, (err) => {
            if (err instanceof multer_1.default.MulterError) {
                if (err.code === 'LIMIT_FILE_SIZE') {
                    return res.status(400).json({ error: `El archivo debe pesar como máximo ${Math.round(config.maxSizeBytes / (1024 * 1024))}MB.` });
                }
                if (err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE') {
                    return res.status(400).json({ error: `Como máximo se pueden subir ${config.maxFiles} archivo(s) por vez.` });
                }
                return res.status(400).json({ error: 'No se pudo procesar el archivo.' });
            }
            if (err)
                return res.status(400).json({ error: err instanceof Error ? err.message : 'No se pudo procesar el archivo.' });
            next();
        });
    };
}
//# sourceMappingURL=uploadMiddleware.js.map