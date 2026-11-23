# Diseño de pantallas y experiencia

## Layout general
- Sidebar: Inicio, Empresas, Sueldos, Contabilidad, Reportes, Configuración.
- Barra superior: empresa activa, período, usuario y cerrar sesión.
- Desktop-first para tareas contables, responsive para consulta y acciones simples.
- Diseño profesional, sobrio, con tablas densas pero legibles.
- Accesibilidad: navegación teclado, labels, foco visible y contraste.

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
Paso 1 empresa/período.
Paso 2 novedades y conceptos.
Paso 3 revisión de empleados y totales.
Paso 4 aprobar y emitir.
No mostrar un cálculo legal como definitivo si faltan reglas.

### Vista previa del recibo
- PDF con las cuatro secciones del artículo 5 del Anexo I del Decreto 407/2026, en el orden y formato del Anexo III oficial vigente.
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
