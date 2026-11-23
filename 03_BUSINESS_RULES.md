# Reglas de negocio y criterios profesionales

## 1. CUIT / CUIL
- Normalizar a dígitos y validar longitud/dígito verificador.
- Mostrar formato con guiones, almacenar forma normalizada.
- No asumir que la validación matemática confirma existencia o situación fiscal ante ARCA.

## 2. Liquidación de sueldos
- El borrador usa la escala FAECYS Acuerdo 10/2026, categoría de CCT 130/75, jornada semanal y antigüedad reconocida. Los importes y el perfil vigente quedan congelados en el recibo.
- La escala disponible cubre noviembre de 2026 a mayo de 2027. No se extrapolan períodos fuera de esa vigencia.
- Antigüedad: 1% por año sobre remuneraciones y sumas no remunerativas recurrentes, excluida la suma única de octubre 2026. Presentismo: 1/12 de los importes remunerativos y no remunerativos alcanzados, excluida la suma única; su elegibilidad se informa para el período y requiere revisión de asistencia.
- Suma no remunerativa recurrente y suma única se aplican según tabla FAECYS vigente y se prorratean por jornada en los casos soportados.
- Los aportes sindicales y solidarios se calculan sobre la base configurada con las tasas de legajo. La tasa predeterminada sindical refleja el artículo 100 del CCT y puede verificarse/modificarse antes de calcular.
- Aportes personales, contribuciones patronales, FAL, ART y obra social se muestran como estimaciones parametrizadas. Para la empresa se configura ARCA (18% o 20,4%), FAL y la alícuota contractual de ART; el perfil individual puede marcar RIFL solo tras confirmar elegibilidad en ARCA. La regla RIFL se limita a fechas de ingreso entre 01/05/2026 y 30/04/2027 y a los primeros 48 meses, pero no comprueba todas las condiciones legales del beneficio.
- La contribución general ARCA se conserva agregada en “Seguridad social” porque la tasa configurable no permite reconstruir por sí sola el detalle de subsistemas del F.931. En RIFL se muestran separadas las tasas programadas de 2% y 3% INSSJP. Bases imponibles, topes, ART fijo, regímenes, licencias, ausencias, diferencias zonales y demás excepciones requieren validación profesional; el borrador no sustituye F.931 ni recibo legal.
- Los conceptos se definen mediante catálogo y reglas con vigencia.
- Sindicato y cuota solidaria/promoción social se configuran como tasas de deducción; no se admite ingresar importes arbitrarios desde la pantalla del recibo.
- Un miembro con rol `accountant` o `owner` puede aprobar recibos individuales; se congela la edición y se registra el usuario y fecha de aprobación. El período pasa a finalizado al aprobarse todos los recibos.
- Cada concepto debe especificar: naturaleza, base, porcentaje/importe, límites, vigencia, convenio/categoría, redondeo y quién lo aprobó.
- Los cambios de sueldo/categoría deben tener vigencia y no modificar recibos históricos.
- El sistema requiere selección explícita del CCT/categoría y configuración de alícuotas patronales antes de crear el borrador; no deduce convenio desde el puesto ni completa tasas legales faltantes.
- El contador revisa y aprueba la liquidación antes de emitir.
- Las reglas legales se deben revisar con normativa vigente y asesoramiento profesional.

## 3. Recibo
- Conforme al artículo 5 del Anexo I del Decreto 407/2026, estructurar el recibo en cuatro secciones diferenciadas: (a) datos del empleador y trabajador; (b) contribuciones y conceptos abonados por el empleador por disposición legal o convencional; (c) remuneración bruta, determinación y deducciones; (d) remuneración neta.
- Incluir en los datos del anverso CUIT, CUIL, fecha de ingreso, antigüedad, categoría, y fecha y lugar de pago de las cargas sociales, además de los campos exigidos por el artículo 140 LCT.
- Los conceptos deben identificar base de cálculo, unidad de medida e importe. Prorratear de forma proporcional las sumas globales destinadas al conjunto de trabajadores.
- Consignar la suma total de los conceptos abonados por el empleador antes de determinar el bruto a percibir por el trabajador.
- Incluir en el anverso el resumen del costo laboral total, discriminado al menos en: sindical, seguridad social, obra social, INSSJP, ART, cámaras o entidades empresariales y otros rubros.
- Ajustar el diseño y contenido al modelo oficial del Anexo III del Decreto 407/2026. El artículo 5 del Anexo I no exige por sí mismo un gráfico circular; si el modelo oficial vigente lo incluye, incorporarlo como representación complementaria del resumen, sin omitir rubros ni importes.
- Las contribuciones, bases y alícuotas dependen de reglas legales, convencionales y del caso concreto: parametrizarlas con vigencia, fuente y aprobación profesional. No inferir tasas definitivas.
- Se debe actualizar la plantilla ante cambios normativos.
- El formato Taval es una plantilla externa; requiere ejemplo proporcionado por el usuario y permiso para utilizarlo.

## 4. Extractos y asientos
- Importación nunca debe contabilizarse sin vista previa y confirmación.
- Mantener descripción original y descripción editada separadas.
- Cada operación clasificada debe producir asiento balanceado:
  - Pago proveedor: Debe Proveedores / Haber Banco.
  - Cobro cliente/deudor: Debe Banco / Haber Deudores por servicios.
  - Comisión bancaria: Debe Gastos bancarios / Haber Banco.
  - Retención/percepción: cuenta específica definida en plan de cuentas / contrapartida Banco según naturaleza y criterio del contador.
- Los nombres “retención de IIBB a banco”, “percepción de IVA a banco”, etc. deben convertirse a cuentas y contrapartidas aprobadas; no hardcodear una única contrapartida.
- Diferenciar retención sufrida, percepción, impuesto propio, pago y saldo a favor según tratamiento contable/tributario.
- Un extracto puede contener operaciones que no sean proveedores, ingresos o tributos; dejar en “por revisar”.
- Detectar duplicados, importes invertidos, moneda y saldo inconsistente.

## 5. Sumas y saldos / mayores
- Saldo de cuenta según naturaleza y política contable.
- Mostrar Debe, Haber, saldo deudor y saldo acreedor claramente.
- Mayor mensual y acumulado del ejercicio.
- Reabrir período cerrado solo con permiso y evento de auditoría.
- Todos los asientos contabilizados son inmutables; corrección mediante reversión y nuevo asiento.

## 6. Ajuste por inflación
- El ajuste requiere método aprobado y fecha de origen de cada partida.
- El indicador “ajusta por inflación” no es suficiente para determinar el tratamiento contable: requiere configuración de clasificación y metodología.
- Índices deben tener fuente, serie, mes, valor y control de publicación.
- Coeficiente, base, origen y cálculo deben quedar reproducibles.
- No ajustar dos veces una partida.
- El sistema debe distinguir saldos monetarios y no monetarios y aplicar tratamiento profesional según normativa aplicable.
- La versión normativa y el método se guardan en cada corrida.

## 7. Cierre de ejercicio
- Fecha de cierre configurada en la empresa.
- Períodos incluidos se calculan desde el ejercicio fiscal, no asumir enero-diciembre.
- Validar que no haya asientos en borrador, importaciones sin revisar, descuadres o ajustes sin aprobar.
- El reporte final se identifica como borrador de trabajo hasta la revisión y firma profesional.
