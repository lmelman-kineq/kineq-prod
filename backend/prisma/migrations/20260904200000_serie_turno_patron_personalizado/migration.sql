-- AlterTable
ALTER TABLE `SerieTurno` ADD COLUMN `diasSemanaPersonalizado` VARCHAR(191) NULL,
    ADD COLUMN `intervaloPersonalizado` INTEGER NULL,
    ADD COLUMN `unidadPersonalizada` ENUM('DIA', 'SEMANA', 'MES', 'ANIO') NULL,
    MODIFY `patron` ENUM('SEMANAL', 'MENSUAL_ORDINAL', 'PERSONALIZADO') NOT NULL DEFAULT 'SEMANAL';
