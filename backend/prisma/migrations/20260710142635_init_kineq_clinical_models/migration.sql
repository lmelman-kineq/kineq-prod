/*
  Warnings:

  - You are about to drop the `patient` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
DROP TABLE `patient`;

-- CreateTable
CREATE TABLE `Consultorio` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NULL,
    `telefono` VARCHAR(191) NULL,
    `direccion` VARCHAR(191) NULL,
    `ciudad` VARCHAR(191) NULL,
    `provincia` VARCHAR(191) NULL,
    `zonaHoraria` VARCHAR(191) NOT NULL DEFAULT 'America/Argentina/Buenos_Aires',
    `activo` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Consultorio_slug_key`(`slug`),
    INDEX `Consultorio_activo_idx`(`activo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Paciente` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `consultorioId` INTEGER NOT NULL,
    `nombre` VARCHAR(191) NOT NULL,
    `apellido` VARCHAR(191) NOT NULL,
    `documento` VARCHAR(191) NULL,
    `fechaNacimiento` DATETIME(3) NULL,
    `email` VARCHAR(191) NULL,
    `telefono` VARCHAR(191) NULL,
    `direccion` VARCHAR(191) NULL,
    `obraSocialId` INTEGER NULL,
    `numeroAfiliado` VARCHAR(191) NULL,
    `observaciones` VARCHAR(191) NULL,
    `activo` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Paciente_consultorioId_activo_idx`(`consultorioId`, `activo`),
    INDEX `Paciente_consultorioId_apellido_nombre_idx`(`consultorioId`, `apellido`, `nombre`),
    INDEX `Paciente_consultorioId_documento_idx`(`consultorioId`, `documento`),
    INDEX `Paciente_obraSocialId_idx`(`obraSocialId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Profesional` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `consultorioId` INTEGER NOT NULL,
    `nombre` VARCHAR(191) NOT NULL,
    `apellido` VARCHAR(191) NOT NULL,
    `titulo` VARCHAR(191) NULL,
    `matricula` VARCHAR(191) NULL,
    `email` VARCHAR(191) NULL,
    `telefono` VARCHAR(191) NULL,
    `activo` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Profesional_consultorioId_activo_idx`(`consultorioId`, `activo`),
    INDEX `Profesional_consultorioId_apellido_nombre_idx`(`consultorioId`, `apellido`, `nombre`),
    INDEX `Profesional_consultorioId_matricula_idx`(`consultorioId`, `matricula`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Especialidad` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `consultorioId` INTEGER NOT NULL,
    `nombre` VARCHAR(191) NOT NULL,
    `color` VARCHAR(191) NOT NULL,
    `activo` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Especialidad_consultorioId_activo_idx`(`consultorioId`, `activo`),
    UNIQUE INDEX `Especialidad_consultorioId_nombre_key`(`consultorioId`, `nombre`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProfesionalEspecialidad` (
    `consultorioId` INTEGER NOT NULL,
    `profesionalId` INTEGER NOT NULL,
    `especialidadId` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ProfesionalEspecialidad_consultorioId_idx`(`consultorioId`),
    INDEX `ProfesionalEspecialidad_especialidadId_idx`(`especialidadId`),
    PRIMARY KEY (`profesionalId`, `especialidadId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ObraSocial` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `consultorioId` INTEGER NOT NULL,
    `nombre` VARCHAR(191) NOT NULL,
    `activo` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ObraSocial_consultorioId_activo_idx`(`consultorioId`, `activo`),
    UNIQUE INDEX `ObraSocial_consultorioId_nombre_key`(`consultorioId`, `nombre`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Turno` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `consultorioId` INTEGER NOT NULL,
    `pacienteId` INTEGER NOT NULL,
    `profesionalId` INTEGER NOT NULL,
    `especialidadId` INTEGER NOT NULL,
    `obraSocialId` INTEGER NULL,
    `inicio` DATETIME(3) NOT NULL,
    `duracionMinutos` INTEGER NOT NULL DEFAULT 60,
    `numeroSesion` INTEGER NULL,
    `notas` VARCHAR(191) NULL,
    `estado` ENUM('ASIGNADO', 'EN_ESPERA', 'ATENDIENDO', 'FINALIZADO', 'AUSENTE', 'CANCELADO') NOT NULL DEFAULT 'ASIGNADO',
    `inicioAtencion` DATETIME(3) NULL,
    `finAtencion` DATETIME(3) NULL,
    `canceladoAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Turno_consultorioId_inicio_idx`(`consultorioId`, `inicio`),
    INDEX `Turno_consultorioId_profesionalId_inicio_idx`(`consultorioId`, `profesionalId`, `inicio`),
    INDEX `Turno_consultorioId_pacienteId_inicio_idx`(`consultorioId`, `pacienteId`, `inicio`),
    INDEX `Turno_consultorioId_estado_inicio_idx`(`consultorioId`, `estado`, `inicio`),
    INDEX `Turno_especialidadId_idx`(`especialidadId`),
    INDEX `Turno_obraSocialId_idx`(`obraSocialId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Evolucion` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `consultorioId` INTEGER NOT NULL,
    `pacienteId` INTEGER NOT NULL,
    `profesionalId` INTEGER NOT NULL,
    `turnoId` INTEGER NULL,
    `contenido` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Evolucion_consultorioId_pacienteId_createdAt_idx`(`consultorioId`, `pacienteId`, `createdAt`),
    INDEX `Evolucion_consultorioId_profesionalId_createdAt_idx`(`consultorioId`, `profesionalId`, `createdAt`),
    INDEX `Evolucion_turnoId_idx`(`turnoId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Paciente` ADD CONSTRAINT `Paciente_consultorioId_fkey` FOREIGN KEY (`consultorioId`) REFERENCES `Consultorio`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Paciente` ADD CONSTRAINT `Paciente_obraSocialId_fkey` FOREIGN KEY (`obraSocialId`) REFERENCES `ObraSocial`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Profesional` ADD CONSTRAINT `Profesional_consultorioId_fkey` FOREIGN KEY (`consultorioId`) REFERENCES `Consultorio`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Especialidad` ADD CONSTRAINT `Especialidad_consultorioId_fkey` FOREIGN KEY (`consultorioId`) REFERENCES `Consultorio`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProfesionalEspecialidad` ADD CONSTRAINT `ProfesionalEspecialidad_consultorioId_fkey` FOREIGN KEY (`consultorioId`) REFERENCES `Consultorio`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProfesionalEspecialidad` ADD CONSTRAINT `ProfesionalEspecialidad_profesionalId_fkey` FOREIGN KEY (`profesionalId`) REFERENCES `Profesional`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProfesionalEspecialidad` ADD CONSTRAINT `ProfesionalEspecialidad_especialidadId_fkey` FOREIGN KEY (`especialidadId`) REFERENCES `Especialidad`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ObraSocial` ADD CONSTRAINT `ObraSocial_consultorioId_fkey` FOREIGN KEY (`consultorioId`) REFERENCES `Consultorio`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Turno` ADD CONSTRAINT `Turno_consultorioId_fkey` FOREIGN KEY (`consultorioId`) REFERENCES `Consultorio`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Turno` ADD CONSTRAINT `Turno_pacienteId_fkey` FOREIGN KEY (`pacienteId`) REFERENCES `Paciente`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Turno` ADD CONSTRAINT `Turno_profesionalId_fkey` FOREIGN KEY (`profesionalId`) REFERENCES `Profesional`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Turno` ADD CONSTRAINT `Turno_especialidadId_fkey` FOREIGN KEY (`especialidadId`) REFERENCES `Especialidad`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Turno` ADD CONSTRAINT `Turno_obraSocialId_fkey` FOREIGN KEY (`obraSocialId`) REFERENCES `ObraSocial`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Evolucion` ADD CONSTRAINT `Evolucion_consultorioId_fkey` FOREIGN KEY (`consultorioId`) REFERENCES `Consultorio`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Evolucion` ADD CONSTRAINT `Evolucion_pacienteId_fkey` FOREIGN KEY (`pacienteId`) REFERENCES `Paciente`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Evolucion` ADD CONSTRAINT `Evolucion_profesionalId_fkey` FOREIGN KEY (`profesionalId`) REFERENCES `Profesional`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Evolucion` ADD CONSTRAINT `Evolucion_turnoId_fkey` FOREIGN KEY (`turnoId`) REFERENCES `Turno`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
