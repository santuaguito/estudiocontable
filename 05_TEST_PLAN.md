# Plan de pruebas

## Herramientas
- Vitest: lógica de dominio y utilidades.
- Testing Library: componentes.
- Playwright: flujos end-to-end.
- Base de datos de test aislada y reiniciable.
- Fixtures sintéticos; nunca CUIT/CUIL reales.

## A. Login y seguridad
- [ ] Login válido crea sesión.
- [ ] Password incorrecta no revela si el usuario existe.
- [ ] Usuario inactivo no ingresa.
- [ ] Logout invalida sesión.
- [ ] Rate limit de intentos.
- [ ] Rutas privadas redirigen al login.
- [ ] Usuario de tenant A no lee ni modifica tenant B.
- [ ] Validación backend evita confiar en IDs enviados desde UI.
- [ ] Secretos no aparecen en bundle cliente ni logs.
- [ ] El alta en Supabase crea estudio y membresía owner para la cuenta.
- [ ] RLS deniega lectura y escritura anónima.
- [ ] RLS impide leer o modificar empresas y empleados de otro estudio.
- [ ] Alta, edición y archivo crean eventos de auditoría.
- [ ] Recargar la app conserva clientes y personas guardados en Supabase.

## B. Empresa
- [ ] Alta con datos válidos.
- [ ] CUIT inválido bloqueado.
- [ ] CUIT duplicado en tenant bloqueado.
- [ ] Empresa balance requiere fecha de cierre.
- [ ] Empresa solo nómina no requiere cierre.
- [ ] Baja lógica conserva histórico.
- [ ] Edición registra auditoría.

## C. Empleados
- [ ] CUIL válido e inválido.
- [ ] CUIL duplicado controlado.
- [ ] Fecha de ingreso futura genera advertencia o bloqueo según regla.
- [ ] Baja excluye períodos posteriores a fecha de baja.
- [ ] Cambio salarial no altera recibo emitido.
- [ ] Porcentajes fuera de rango bloqueados según regla configurable.

## D. Liquidación
- [ ] Con perfil completo CCT 130/75, crear un borrador de noviembre 2026 y contrastar categoría, básico, antigüedad, presentismo, suma periódica y suma única contra la escala FAECYS Acuerdo 10/2026.
- [ ] Verificar que la suma única no reciba antigüedad ni presentismo, que las sumas no remunerativas recurrentes sí reciban ambos cuando corresponda y que jornada parcial se prorratee.
- [ ] Comprobar tasas sindicales/solidarias configurables, deducciones personales, alícuotas ARCA/FAL/ART y snapshot inmutable al editar el legajo posteriormente.
- [ ] Confirmar FAL en cero antes del período 12/2026 y según alícuota configurada desde ese período.
- [ ] Verificar RIFL solo con confirmación individual, fecha de ingreso dentro de 01/05/2026–30/04/2027 y ventana menor a 48 meses; confirmar que su desglose patronal no reduce la tasa FAL.
- [ ] Eliminar un recibo individual de un período borrador con más de una persona; confirmar que los demás recibos permanecen y que la acción se audita.
- [ ] Eliminar el período borrador completo; confirmar que se borran sus conceptos y recibos, que la acción se audita y que un período en revisión no puede eliminarse.
- [ ] Verificar que contador/propietario pueda aceptar un recibo en borrador o revisión, que se registren usuario y fecha, y que el recibo quede bloqueado.
- [ ] Confirmar que el período solo figure finalizado cuando todos sus recibos estén aprobados y que el PDF aprobado se descargue como final.
- [ ] Confirmar que un miembro sin rol contador/propietario no pueda aprobar aunque llame directamente al RPC.
- [ ] Bloquear períodos fuera de noviembre 2026–mayo 2027 o legajos sin categoría aplicable.
- [ ] Revisar bases imponibles, topes, excepciones y totales del recibo con un contador matriculado antes de cualquier uso legal.
- [ ] Cambiar categoría o tasas del legajo no altera los conceptos ni snapshot de borradores existentes.
- [ ] Período con servicio de sueldos crea recibos borrador para personas activas.
- [ ] Período duplicado o empresa sin personal activo se rechaza.
- [ ] El recibo no admite agregar importes arbitrarios; solo se editan tasas de sindicato y solidaridad en el perfil.
- [ ] Solicitar revisión bloquea recibos y sus conceptos.
- [ ] Impresión conserva la marca de borrador y advertencia de no emisión.
- [ ] Gráfico informativo representa proporciones de los costos patronales estimados con parámetros empresariales.
- [ ] Período obligatorio y único.
- [ ] Conceptos con base/porcentaje calculan según regla versionada.
- [ ] Redondeo consistente.
- [ ] Totales bruto, deducciones y neto concilian.
- [ ] Regla faltante bloquea aprobación.
- [ ] Recibo aprobado conserva snapshot.
- [ ] Anulación registra motivo y auditoría.
- [ ] Lote no incluye empleados inactivos sin período trabajado.

## E. PDF recibo
- [ ] PDF abre y no está vacío.
- [ ] CUIT, CUIL, período, categoría y fecha ingreso se muestran.
- [ ] Conceptos y bases se representan sin truncamiento.
- [ ] El anverso muestra las cuatro secciones en el orden y formato del Anexo III oficial vigente.
- [ ] El detalle y total de conceptos a cargo del empleador aparecen antes del bruto del trabajador.
- [ ] El resumen del costo laboral incluye los siete rubros mínimos: sindical, seguridad social, obra social, INSSJP, ART, cámaras/entidades empresariales y otros.
- [ ] Si el modelo oficial vigente incluye gráfico circular, sus proporciones concuerdan con los importes del resumen y no reemplazan los valores ni rubros.
- [ ] Las sumas globales se prorratean y los conceptos muestran base de cálculo, unidad e importe.
- [ ] Neto numérico y en letras, si requerido por normativa vigente.
- [ ] PDF de otro tenant no es accesible.
- [ ] Plantilla soporta el modelo validado por el contador.

## F. Extractos bancarios
- [ ] CSV válido importa.
- [ ] CSV con columnas desconocidas permite mapping.
- [ ] Archivo vacío o corrupto se rechaza con mensaje.
- [ ] Operación duplicada se detecta.
- [ ] Débito/crédito y signo se interpretan correctamente.
- [ ] Original y descripción editada se conservan.
- [ ] Clasificación pendiente no se contabiliza.
- [ ] Asiento generado Debe = Haber.
- [ ] Reimportación no duplica asientos.

## G. Contabilidad
- [ ] Código de cuenta duplicado bloqueado.
- [ ] Cuenta agrupadora no recibe imputación directa.
- [ ] Asiento descuadrado no se contabiliza.
- [ ] Asiento contabilizado no se edita destructivamente.
- [ ] Reversión crea asiento opuesto.
- [ ] Sumas y saldos agregan movimientos por cuenta.
- [ ] Mayor concilia con sumas y saldos.
- [ ] Período fiscal se determina por fecha de cierre de empresa.
- [ ] Plantilla recurrente no duplica generación.

## H. Ajuste por inflación
- [ ] Mes/serie duplicado bloqueado.
- [ ] Índice faltante impide cálculo si es necesario.
- [ ] Coeficiente se puede reconstruir desde datos guardados.
- [ ] Partida no ajustable queda excluida.
- [ ] Partida no monetaria requiere origen/metodología.
- [ ] Segunda ejecución no duplica ajustes.
- [ ] Original + ajuste = saldo ajustado.
- [ ] Sumas y saldos ajustados mantienen Debe = Haber.

## I. Reporte final
- [ ] Incluye empresa y período correcto.
- [ ] Incluye originales y ajustes separados.
- [ ] Incluye mayores y alertas.
- [ ] Fecha de generación y estado visible.
- [ ] PDF generado sin contenido de otras empresas.
- [ ] Reporte se etiqueta como borrador/no certificado.

## Casos E2E mínimos
1. Login → crear empresa → crear empleado → liquidar → aprobar → descargar recibo.
2. Crear empresa balance → importar extracto → clasificar pagos/cobros → generar asiento → revisar sumas y saldos.
3. Cargar plan de cuentas → asiento fijo → consultar mayor.
4. Cargar índices → ejecutar ajuste → comparar sumas y saldos → exportar reporte.
