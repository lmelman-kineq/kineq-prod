-- Paciente.documento pasa de índice simple a único por consultorio.
-- MySQL no deduplica NULLs en un índice único, así que pacientes sin
-- documento (ahora el caso normal, ya que el campo es opcional) no chocan
-- entre sí; solo se rechaza un documento no nulo repetido dentro del mismo
-- consultorio. No hay backfill: no existían duplicados previos (verificado
-- antes de esta migración).
DROP INDEX `Paciente_consultorioId_documento_idx` ON `Paciente`;

CREATE UNIQUE INDEX `Paciente_consultorioId_documento_key` ON `Paciente`(`consultorioId`, `documento`);
