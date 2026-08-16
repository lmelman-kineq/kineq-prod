-- AlterTable
ALTER TABLE `evolucion` ADD COLUMN `grupoId` INTEGER NULL;

-- CreateTable
CREATE TABLE `GrupoEvolucion` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `consultorioId` INTEGER NOT NULL,
    `pacienteId` INTEGER NOT NULL,
    `nombre` VARCHAR(191) NOT NULL,
    `color` VARCHAR(191) NOT NULL,
    `archivedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `GrupoEvolucion_consultorioId_pacienteId_archivedAt_idx`(`consultorioId`, `pacienteId`, `archivedAt`),
    UNIQUE INDEX `GrupoEvolucion_pacienteId_nombre_key`(`pacienteId`, `nombre`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `FichaAlertaCampo` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `consultorioId` INTEGER NOT NULL,
    `fichaInicialId` INTEGER NOT NULL,
    `campo` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `FichaAlertaCampo_consultorioId_idx`(`consultorioId`),
    UNIQUE INDEX `FichaAlertaCampo_fichaInicialId_campo_key`(`fichaInicialId`, `campo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `Evolucion_grupoId_idx` ON `Evolucion`(`grupoId`);

-- AddForeignKey
ALTER TABLE `Evolucion` ADD CONSTRAINT `Evolucion_grupoId_fkey` FOREIGN KEY (`grupoId`) REFERENCES `GrupoEvolucion`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GrupoEvolucion` ADD CONSTRAINT `GrupoEvolucion_consultorioId_fkey` FOREIGN KEY (`consultorioId`) REFERENCES `Consultorio`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GrupoEvolucion` ADD CONSTRAINT `GrupoEvolucion_pacienteId_fkey` FOREIGN KEY (`pacienteId`) REFERENCES `Paciente`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FichaAlertaCampo` ADD CONSTRAINT `FichaAlertaCampo_consultorioId_fkey` FOREIGN KEY (`consultorioId`) REFERENCES `Consultorio`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FichaAlertaCampo` ADD CONSTRAINT `FichaAlertaCampo_fichaInicialId_fkey` FOREIGN KEY (`fichaInicialId`) REFERENCES `FichaInicial`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
