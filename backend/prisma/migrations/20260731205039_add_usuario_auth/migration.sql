-- CreateTable
CREATE TABLE `Usuario` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `consultorioId` INTEGER NOT NULL,
    `nombre` VARCHAR(191) NOT NULL,
    `apellido` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `passwordHash` VARCHAR(191) NOT NULL,
    `rol` ENUM('ADMINISTRADOR', 'PROFESIONAL', 'RECEPCION', 'SUPERVISOR') NOT NULL,
    `activo` BOOLEAN NOT NULL DEFAULT true,
    `profesionalId` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Usuario_profesionalId_key`(`profesionalId`),
    INDEX `Usuario_consultorioId_idx`(`consultorioId`),
    UNIQUE INDEX `Usuario_consultorioId_email_key`(`consultorioId`, `email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Usuario` ADD CONSTRAINT `Usuario_consultorioId_fkey` FOREIGN KEY (`consultorioId`) REFERENCES `Consultorio`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Usuario` ADD CONSTRAINT `Usuario_profesionalId_fkey` FOREIGN KEY (`profesionalId`) REFERENCES `Profesional`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
