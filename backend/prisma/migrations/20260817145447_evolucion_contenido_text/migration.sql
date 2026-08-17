-- Evolucion.contenido pasa de VARCHAR(191) (default de Prisma sin @db.Text)
-- a TEXT. Una evolución de más de 191 caracteres hacía fallar el INSERT en
-- la base ("Data too long for column 'contenido'"), devuelto como 500
-- genérico sin loguear la excepción real. `contenidoHtml` ya usaba TEXT
-- desde que se agregó el formato rico; este es el mismo fix aplicado al
-- campo original. Aditiva/no destructiva: MODIFY amplía el tipo de columna
-- sin tocar filas existentes, ningún dato se trunca ni se pierde.
ALTER TABLE `Evolucion` MODIFY `contenido` TEXT NOT NULL;
