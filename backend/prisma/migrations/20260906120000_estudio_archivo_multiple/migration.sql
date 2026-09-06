-- CreateTable
CREATE TABLE `EstudioArchivo` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `consultorioId` INTEGER NOT NULL,
    `estudioId` INTEGER NOT NULL,
    `pathname` TEXT NOT NULL,
    `nombreOriginal` VARCHAR(191) NOT NULL,
    `mimeType` VARCHAR(191) NOT NULL,
    `sizeBytes` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `EstudioArchivo_consultorioId_estudioId_idx`(`consultorioId`, `estudioId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `EstudioArchivo` ADD CONSTRAINT `EstudioArchivo_estudioId_fkey` FOREIGN KEY (`estudioId`) REFERENCES `FichaEstudioComplementario`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: los estudios existentes (uno-a-uno con su archivo, ver las 4
-- columnas `archivo*` de FichaEstudioComplementario) pasan a tener su
-- archivo también como una fila de EstudioArchivo, para que "un estudio
-- soporta N archivos" incluya sin excepción a los ya cargados antes de esta
-- migración. Las columnas viejas NO se borran (quedan deprecadas, ver
-- comentario en schema.prisma) — este INSERT no pierde nada, solo agrega.
INSERT INTO `EstudioArchivo` (`consultorioId`, `estudioId`, `pathname`, `nombreOriginal`, `mimeType`, `sizeBytes`, `createdAt`)
SELECT `consultorioId`, `id`, `archivoPathname`, COALESCE(`archivoNombreOriginal`, 'archivo'), COALESCE(`archivoMimeType`, 'application/octet-stream'), COALESCE(`archivoSizeBytes`, 0), `createdAt`
FROM `FichaEstudioComplementario`
WHERE `archivoPathname` IS NOT NULL;
