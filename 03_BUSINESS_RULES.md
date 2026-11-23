# Reglas de negocio y criterios profesionales

## 1. CUIT / CUIL
- Normalizar a dígitos y validar longitud/dígito verificador.
- Mostrar formato con guiones, almacenar forma normalizada.
- No asumir que la validación matemática confirma existencia o situación fiscal ante ARCA.

## 2. Liquidación de sueldos
- Los conceptos se definen mediante catálogo y reglas con vigencia.
- Sindicato, cuota solidaria/promoción social y conectividad son conceptos configurables: no asumir si son remunerativos, no remunerativos, imponibles o deducibles.
- Cada concepto debe especificar: naturaleza, base, porcentaje/importe, límites, vigencia, convenio/categoría, redondeo y quién lo aprobó.
- Los cambios de sueldo/categoría deben tener vigencia y no modificar recibos históricos.
- El sistema no debe inferir automáticamente convenio colectivo, escala salarial o porcentajes legales.
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
