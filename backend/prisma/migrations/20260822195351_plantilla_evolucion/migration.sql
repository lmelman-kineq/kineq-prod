-- CreateTable
CREATE TABLE `PlantillaEvolucion` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `consultorioId` INTEGER NOT NULL,
    `nombre` VARCHAR(191) NOT NULL,
    `contenido` TEXT NOT NULL,
    `contenidoHtml` TEXT NULL,
    `activo` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `PlantillaEvolucion_consultorioId_activo_idx`(`consultorioId`, `activo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `PlantillaEvolucion` ADD CONSTRAINT `PlantillaEvolucion_consultorioId_fkey` FOREIGN KEY (`consultorioId`) REFERENCES `Consultorio`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
