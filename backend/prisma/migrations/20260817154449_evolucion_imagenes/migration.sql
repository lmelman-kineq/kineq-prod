-- CreateTable
CREATE TABLE `EvolucionImagen` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `consultorioId` INTEGER NOT NULL,
    `pacienteId` INTEGER NOT NULL,
    `evolucionId` INTEGER NOT NULL,
    `url` TEXT NOT NULL,
    `pathname` TEXT NOT NULL,
    `nombreOriginal` VARCHAR(191) NOT NULL,
    `mimeType` VARCHAR(191) NOT NULL,
    `sizeBytes` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `EvolucionImagen_consultorioId_evolucionId_idx`(`consultorioId`, `evolucionId`),
    INDEX `EvolucionImagen_pacienteId_idx`(`pacienteId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `EvolucionImagen` ADD CONSTRAINT `EvolucionImagen_evolucionId_fkey` FOREIGN KEY (`evolucionId`) REFERENCES `Evolucion`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
