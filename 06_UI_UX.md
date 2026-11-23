# Diseño de pantallas y experiencia

## Layout general
- Sidebar: Inicio, Empresas, Sueldos, Contabilidad, Reportes, Configuración.
- Barra superior: empresa activa, período, usuario y cerrar sesión.
- Desktop-first para tareas contables, responsive para consulta y acciones simples.
- Diseño profesional, sobrio, con tablas densas pero legibles.
- Accesibilidad: navegación teclado, labels, foco visible y contraste.

## Ficha por empresa

- La cartera abre una ficha individual por empresa.
- La ficha presenta sus datos, personal, configuración de servicios y módulos habilitados.
- Sueldos aparece para empresas con nómina habilitada; contabilidad y reportes aparecen para empresas con balance habilitado.
- El alta de personal se realiza dentro de la ficha de la empresa.
- Empresas archivadas muestran su estado y acción de reactivación; sus módulos quedan deshabilitados.

## Etapa 1
### Empresas
Tabla: razón social, CUIT, tipo de servicio, cierre, estado, acciones.
Formulario con validación inline.

### Empresa / ficha
Tabs: Datos fiscales, Empleados, Liquidaciones, Documentos.
Mostrar período actual y alertas.

### Empleados
Tabla: nombre, CUIL, categoría, ingreso, básico, estado.
Acciones: alta, editar, dar de baja, ver historial.

### Liquidación
Estado actual: creación de período y recibos en borrador, conceptos calculados por reglas configuradas y solicitud de revisión profesional. Un miembro con rol contador o propietario puede aceptar cada recibo; la cuenta y fecha se registran, el recibo queda bloqueado y el período se finaliza al aprobar todos. No asigna un revisor ni envía notificaciones externas.
Flujo futuro sujeto a aprobación profesional: empresa/período → novedades y conceptos → revisión de empleados y totales → aprobación y emisión, únicamente después de validar las reglas y los requisitos oficiales.

### Vista previa del recibo
- Descarga directa de un PDF individual de borrador o aprobado con cuatro secciones; no usa la impresión del navegador.
- El PDF aprobado documenta la aceptación del contador en el sistema, pero no registra firma ni pago y requiere validar el orden, contenido y formato del Anexo III oficial antes de uso legal.
- Sección de conceptos del empleador y suma total del costo laboral antes de la remuneración bruta del trabajador.
- En el anverso, resumen de costo laboral agrupado como mínimo en los siete rubros normativos. Si el Anexo III oficial incluye gráfico circular, mostrarlo como resumen visual ligado a esos importes.
- Detallar base, unidad e importe por concepto; asegurar que el gráfico no sustituya los valores ni la discriminación requerida.
- No emitir como definitivo cuando falten datos, reglas vigentes o aprobación profesional.

## Etapa 2
### Importación bancaria
- Wizard: seleccionar cuenta → subir archivo → mapear columnas → revisar operaciones → clasificar → confirmar asientos.
- Colores/etiquetas por estado.
- Edición rápida del tercero con historial.
- Mostrar débito/crédito, fecha, concepto original y concepto normalizado.

### Sumas y saldos
- Filtros ejercicio/período.
- Tabla código, cuenta, saldo inicial, debe, haber, saldo deudor, saldo acreedor.
- Acceso a mayor desde cada fila.
- Mostrar alerta de descuadre.

### Plan de cuentas
- Árbol jerárquico y tabla.
- Flag “Ajustable” más configuración de tratamiento.
- No sugerir que el checkbox por sí solo define la metodología.

### Índices
- Tabla por mes, fuente y valor.
- Importación y carga manual.
- Mostrar meses faltantes y fecha de actualización.

### Balance final
- Preview del documento.
- Secciones incluidas.
- Validación de pendientes antes de exportar.

## Estados globales
Todas las pantallas deben contemplar:
- Loading / skeleton.
- Empty state con acción útil.
- Error recuperable con reintento.
- Confirmación de acciones destructivas.
- Guardado exitoso.
- Cambios sin guardar.
- Permisos insuficientes.
# Módulo de recibos de sueldo

- La pantalla ` /payroll ` presenta creación de período, lista de períodos, selección de persona y editor del recibo.
- Cada impresión lleva marca visible **BORRADOR · PENDIENTE DE REVISIÓN** y aclara que no es válido para emisión o acreditación de pago.
- El recibo se organiza en contribuciones patronales, remuneraciones, deducciones y neto aritmético del borrador. Incluye rubros patronales informativos y gráfico referencial basado solo en conceptos cargados.
- Los conceptos se ingresan manualmente. Solicitar revisión bloquea cambios y cambia el estado a “En revisión”.
- No mostrar acciones de aprobación, emisión, firma o presentación ante organismos.
