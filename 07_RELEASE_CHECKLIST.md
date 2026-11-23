# Checklist antes de producción

## Legal y profesional
- [ ] Contador responsable aprobó reglas de liquidación.
- [ ] Convenios y conceptos están actualizados y versionados.
- [ ] Plantilla Taval verificada contra muestra autorizada.
- [ ] Requisitos legales del recibo revisados contra normativa vigente.
- [ ] Plan de cuentas y asientos tributarios aprobados.
- [ ] Metodología de ajuste por inflación aprobada.
- [ ] Índices y fuente documentados.
- [ ] Reporte final no se presenta como certificado sin intervención profesional.

## Técnica
- [ ] Variables de entorno de producción configuradas en hosting.
- [ ] `.env*` ignorados en Git, salvo `.env.example`.
- [ ] Migraciones revisadas y aplicadas.
- [ ] Backups automáticos y prueba de restauración.
- [ ] TLS/HTTPS activo.
- [ ] Rate limit y recuperación de contraseña.
- [ ] Autorización tenant comprobada.
- [ ] Logs sin CUIT/CUIL, sueldos ni claves.
- [ ] Archivos privados con acceso firmado/temporal.
- [ ] Lint, typecheck, unit, integration, E2E y build pasan.
- [ ] Monitoring y alertas configurados.
- [ ] Política de retención y eliminación de datos documentada.

## Operación
- [ ] Manual breve para contador.
- [ ] Procedimiento para corregir recibos/asientos.
- [ ] Procedimiento para cierre y reapertura.
- [ ] Usuarios piloto capacitados.
- [ ] Prueba con datos ficticios y luego datos controlados.
