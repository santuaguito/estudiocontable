# Plan de implementación para VS Code

## Instrucción general para el agente

Trabajá en pequeñas entregas. Antes de editar:
1. Inspeccioná el repositorio y su stack real.
2. Compará con estos documentos.
3. No reemplaces arquitectura ni dependencias sin explicar el motivo.
4. Implementá una tarea, ejecutá tests, lint, typecheck y build.
5. Informá archivos cambiados, comandos ejecutados, resultados y pendientes.
6. No uses datos reales de clientes en fixtures.
7. Nunca agregues secretos a código, logs o commits.

## Fase 0 — Base
- Crear proyecto, configuración TypeScript estricta, lint, formato y tests.
- Configurar PostgreSQL y Prisma.
- Configurar autenticación y rutas privadas.
- Implementar tenant y auditoría.
- Tests de acceso no autenticado y aislamiento por tenant.

Prompt:
> Implementá la base técnica definida en 01_ARCHITECTURE.md y el modelo inicial de 02_DATA_MODEL.md. No avances a nómina. Creá migraciones, seed con datos ficticios y pruebas de autenticación/tenant. Ejecutá lint, typecheck, tests y build.

## Etapa 1 / Fase 1 — Empresas y empleados
- CRUD de empresas.
- Validación CUIT y cierre de ejercicio.
- CRUD empleados, bajas y datos con vigencia.
- Tests de validación y persistencia.

Prompt:
> Implementá empresas y empleados según 00_PRODUCT_SPEC.md. Respetá bajas lógicas, vigencias y snapshots. Agregá tests unitarios e integración. No implementes fórmulas salariales todavía.

## Etapa 1 / Fase 2 — Nómina y PDF
- Catálogo de conceptos y reglas.
- Liquidación borrador.
- Revisión/aprobación.
- Generación PDF y archivo de lote.
- Histórico inmutable y anulación.
- Validar requisitos de recibo con asesoría profesional.

Prompt:
> Implementá el módulo de liquidación con reglas configurables y versionadas. No inventes tasas legales ni convenio. Si un concepto carece de regla aprobada, bloquear cálculo y mostrar alerta. Generá PDF con plantilla configurable y tests de cálculos, snapshots, totales y seguridad.

## Etapa 2 / Fase 3 — Extractos bancarios
- Importación CSV.
- Mapping de columnas.
- Detección duplicados.
- Clasificación manual/asistida.
- Generación de asientos balanceados.
- Edición de tercero conservando original.

Prompt:
> Implementá importación bancaria con preview y confirmación. Cada operación debe quedar trazable y generar asiento balanceado solo tras aprobación. No clasifiques impuestos de manera definitiva si no hay regla explícita. Agregá fixtures CSV y pruebas de duplicados, formato y conciliación.

## Etapa 2 / Fase 4 — Plan de cuentas, asientos y mayores
- CRUD plan de cuentas.
- Asientos manuales y plantillas recurrentes.
- Sumas y saldos.
- Mayores mensuales y acumulados.
- Cierre/reapertura con auditoría.

Prompt:
> Implementá plan de cuentas, asientos, sumas y saldos y mayores. Usá transacciones de base de datos y decimal exacto. Bloqueá asientos descuadrados. Tests con asiento simple, compuesto, reversión y cierre fiscal no calendario.

## Etapa 2 / Fase 5 — Ajuste por inflación
- Carga/importación de índices.
- Clasificación de partidas.
- Cálculo versionado.
- Sumas y saldos ajustados.
- Comparativo original/ajustado.

Prompt:
> Implementá el módulo de ajuste como motor separado y reproducible. Antes de calcular, exigí reglas aprobadas para partidas, fechas de origen y metodología. No uses un coeficiente genérico sin base. Tests de coeficientes, no duplicación, recalculación y balance.

## Etapa 2 / Fase 6 — Reporte final
- Reporte PDF de balance de trabajo.
- Resumen, sumas y saldos, ajustes, mayores y alertas.
- Verificación final y descarga.

Prompt:
> Implementá exportación PDF del paquete de balance definido en 00_PRODUCT_SPEC.md. Incluí período, empresa, fecha de generación y estado de revisión. No presentar como balance certificado. Tests de contenido, paginación, importes y descarga autorizada.

## Definition of Done por módulo
- UI responsive y accesible.
- Validación frontend y backend.
- Autorización en servidor.
- Estados vacíos, error y loading.
- Logs sin datos personales.
- Tests unitarios e integración.
- Lint + typecheck + build exitosos.
- Documentación actualizada.
