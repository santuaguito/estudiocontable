# Especificación funcional del producto

## 1. Visión

Aplicación web multiempresa para estudios contables argentinos. El sistema se desarrolla en dos etapas independientes pero integradas.

## 2. Roles y acceso

### MVP inicial
- Un usuario administrador por instalación/estudio.
- Login con email/usuario y contraseña.
- Sesión segura, cierre de sesión y recuperación de contraseña.
- Las rutas privadas deben exigir sesión válida.
- La contraseña nunca se almacena en texto plano.

### Evolución prevista
- Multiusuario con roles: administrador, contador, auxiliar y solo lectura.
- Permisos por empresa y módulo.

## 3. Etapa 1 — Empresas y recibos de sueldo

### 3.1 Inicio / dashboard
- Listado de empresas.
- Acciones: abrir, editar, archivar.
- Acceso a empleados y recibos.
- Filtros por empresa, período y estado.

### 3.2 Alta y edición de empresa
Campos:
- CUIT.
- Razón social.
- Domicilio fiscal.
- Tipo de servicio: `LIQUIDACION_SUELDOS`, `BALANCE` o `AMBOS`.
- Fecha de cierre de ejercicio, obligatoria si el tipo incluye balance.
- Estado activo/inactivo.

Validaciones:
- CUIT con formato y dígito verificador.
- Razón social requerida.
- Domicilio requerido.
- No duplicar CUIT dentro del estudio.
- No permitir eliminar definitivamente una empresa con períodos, empleados o comprobantes asociados; usar baja lógica.

### 3.3 Gestión de empleados
Por empresa:
- Nombre y apellido.
- CUIL.
- Categoría / calificación profesional.
- Fecha de ingreso.
- Sueldo básico.
- Porcentaje de sindicato.
- Porcentaje o importe de promoción social / cuota solidaria.
- Adicional de conectividad.
- Estado: activo o baja.
- Fecha de baja, si corresponde.

La ficha debe permitir editar datos históricos sin alterar recibos ya cerrados. Para ello, registrar vigencia de los cambios o guardar una instantánea de los datos utilizados en cada liquidación.

### 3.4 Liquidación mensual
- Selección de empresa.
- Mes y año de pago.
- Selección de empleados activos durante el período.
- Carga de novedades/conceptos: adicionales, conectividad, horas, descuentos y otros conceptos aprobados.
- Vista previa individual.
- Cálculo basado en reglas configurables y vigentes.
- Alertas por datos faltantes o reglas sin configurar.
- Estados: borrador, revisado, aprobado, emitido y anulado.
- Evitar duplicados por empleado, empresa y período, salvo que se cree una liquidación complementaria explícita.

### 3.5 Recibo PDF
- Generar recibo individual por empleado.
- Generar lote de recibos por empresa y período.
- PDF descargable, con identificación inequívoca del período.
- Mostrar remuneraciones, deducciones, aportes/contribuciones aplicables y neto.
- Para la normativa del artículo 140 LCT reglamentada por el Decreto 407/2026, usar cuatro secciones diferenciadas: (a) datos del empleador y trabajador; (b) contribuciones y conceptos abonados por el empleador; (c) remuneración bruta, su determinación y deducciones; (d) remuneración neta.
- Mostrar los conceptos a cargo del empleador antes de la determinación del bruto del trabajador. En el anverso, incluir el resumen de composición total del costo laboral y sus rubros mínimos: sindical, seguridad social, obra social, INSSJP, ART, cámaras o entidades empresariales y otros.
- Reproducir el formato y contenido del Anexo III oficial vigente. Si el modelo gráfico incluye gráfico circular, representarlo con los datos y proporciones del costo laboral correspondiente; no reemplazar los importes ni rubros exigidos por porcentajes visuales.
- Para cada concepto, mostrar base de cálculo, unidad de medida e importe resultante. Prorratear proporcionalmente los conceptos globales destinados al conjunto de trabajadores.
- Incluir los campos legales obligatorios vigentes, sujetos a revisión profesional.
- Plantilla visual configurable.
- Incorporar el formato Taval solo luego de recibir una muestra autorizada.
- Guardar registro de emisión y versión del documento.
- No afirmar firma electrónica, entrega fehaciente o integración ARCA si no están implementadas.

## 4. Etapa 2 — Contabilidad y balance

La etapa 2 se habilita para empresas con servicio `BALANCE` o `AMBOS`.

### Pantalla 1 — Extractos bancarios
- Alta de cuenta bancaria: banco, alias/nombre, moneda y cuenta contable asociada.
- Importación de extractos en CSV inicialmente; XLSX como mejora.
- Previsualización y validación de columnas.
- Identificar fecha, descripción, referencia, débito, crédito y saldo si el archivo los contiene.
- Detección de duplicados por hash de operación/archivo y datos de la transacción.
- Clasificación asistida de operaciones:
  - Pagos a proveedores: Debe Proveedores / Haber Banco.
  - Cobros de servicios: Debe Banco / Haber Deudores por servicios.
  - Gastos y comisiones bancarias: cuenta de gastos / Banco.
  - Retenciones y percepciones de IIBB.
  - Retenciones y percepciones de IVA.
  - Retenciones de Ganancias.
- El usuario debe confirmar la cuenta y el nombre del tercero.
- Permitir editar la descripción o nombre del tercero sin perder el texto original.
- Cada operación genera un asiento individual, balanceado y enlazado al movimiento bancario.
- Estados: importado, pendiente de clasificación, clasificado, contabilizado, conciliado, ignorado.
- No contabilizar automáticamente una clasificación tributaria incierta.

### Pantalla 2 — Sumas y saldos, plan de cuentas y mayores
- Traer asientos contabilizados de Pantalla 1.
- Carga manual de asientos contables.
- Plan de cuentas configurable:
  - Código.
  - Nombre.
  - Tipo: activo, pasivo, patrimonio neto, resultado positivo, resultado negativo.
  - Cuenta imputable o agrupadora.
  - Moneda, cuando aplique.
  - Indicador de ajuste por inflación.
  - Cuenta asociada para resultados por exposición/ajuste, configurable.
  - Estado activa/inactiva.
- Validar código único y jerarquía sin ciclos.
- Precarga de asientos fijos/plantillas mensuales.
- Plantilla de asiento con fecha/regla de generación, cuentas, importes o fórmulas configurables.
- Vista de sumas y saldos por período y acumulado.
- Mayor por cuenta, con movimientos, saldo inicial, debe, haber y saldo final.
- Período fiscal según fecha de cierre configurada en empresa.
- Permitir exportar a CSV/XLSX.

### Pantalla 3 — Índices de ajuste por inflación
- Carga mensual de índice.
- Fuente, fecha de publicación, valor, usuario y observación.
- No permitir duplicar mes + fuente + serie.
- Importación opcional desde fuente oficial/profesional verificada.
- Recalcular coeficientes de forma reproducible.
- Mostrar cuentas y partidas afectadas, método, coeficiente y cálculo.
- Ajuste por inflación separado de los movimientos originales.
- Requiere definición del contador sobre partidas monetarias/no monetarias, fechas de origen y metodología aplicable.

### Pantalla 4 — Sumas y saldos ajustados
- Mostrar sumas y saldos originales y ajustados.
- Comparación antes/después.
- Detalle de ajustes por cuenta y período.
- Verificación de igualdad Debe = Haber.
- Bloquear cierre si existen asientos descuadrados, operaciones pendientes o índices faltantes requeridos.
- Permitir volver a cálculo previo solo con registro de auditoría.

### Cierre — Balance PDF
- Generar un paquete PDF con:
  1. Carátula de empresa y ejercicio.
  2. Sumas y saldos originales.
  3. Asientos de ajuste.
  4. Sumas y saldos ajustados.
  5. Mayores por cuenta.
  6. Resumen de conciliación y alertas.
- El PDF debe indicar que es un reporte generado por el sistema y no un estado contable firmado/certificado.
- No generar estados financieros formales ni informe profesional sin plantillas y revisión del contador.
