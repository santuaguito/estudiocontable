# Sistema web para estudios contables

Documentación de producto, arquitectura, implementación y pruebas para desarrollar una aplicación de gestión contable en dos etapas.

## Objetivo

Crear una aplicación web para un estudio contable argentino que permita:

- Gestionar empresas y empleados.
- Preparar recibos de sueldo en PDF.
- Importar y clasificar extractos bancarios.
- Generar asientos contables y mayores.
- Elaborar sumas y saldos.
- Aplicar ajuste por inflación contable.
- Exportar un paquete de balance en PDF.

## Cómo usar estos archivos en VS Code

1. Abrí la carpeta del proyecto en Visual Studio Code.
2. Leé `00_PRODUCT_SPEC.md` y `01_ARCHITECTURE.md`.
3. Implementá siguiendo `04_IMPLEMENTATION_PLAN.md`, una tarea por vez.
4. Antes de avanzar de módulo, ejecutá las pruebas de `05_TEST_PLAN.md`.
5. No implementes cálculos laborales o contables definitivos sin aprobación de un contador matriculado.

Los archivos Markdown son especificaciones y prompts de trabajo para el agente de desarrollo; no son código ejecutable por sí solos.

## Aplicación en desarrollo

La aplicación usa Supabase Auth y PostgreSQL para gestionar empresas y empleados por estudio. Requiere Node.js 20.9 o superior.

```bash
npm install
npx supabase login
npx supabase link --project-ref <project-ref>
npx supabase db push --remote
cp .env.example .env.local
npm run dev
```

Completá `.env.local` con `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` desde la configuración del proyecto. No uses claves `secret` o `service_role` en el navegador. La migración de `supabase/migrations/` crea los estudios, miembros, empresas, empleados, auditoría, y políticas RLS. La contraseña de la base y el token CLI se ingresan localmente; no los agregues a Git ni los compartas por chat.

Para ejecutar las verificaciones disponibles:

```bash
npm test
npm run lint
npm run typecheck
npm run build
```

Las altas se guardan en Supabase y el acceso a filas se limita mediante RLS por estudio. Aún se debe validar el despliegue de la migración en el proyecto Supabase de destino y completar la revisión profesional antes de usar datos reales de nómina o contabilidad.

## Documentos

- `00_PRODUCT_SPEC.md`: alcance funcional completo.
- `01_ARCHITECTURE.md`: arquitectura recomendada, módulos y estructura.
- `02_DATA_MODEL.md`: entidades y relaciones.
- `03_BUSINESS_RULES.md`: reglas de nómina, contabilidad, cierres y auditoría.
- `04_IMPLEMENTATION_PLAN.md`: orden de construcción y prompts para VS Code.
- `05_TEST_PLAN.md`: pruebas unitarias, integración, seguridad y aceptación.
- `06_UI_UX.md`: pantallas, navegación y estados.
- `07_RELEASE_CHECKLIST.md`: checklist previo a producción.

## Estado actual del módulo de sueldos

La sección **Sueldos** genera borradores con escala FAECYS Acuerdo 10/2026, antigüedad, presentismo y tasas sindicales configuradas. También estima aportes y costos patronales con parámetros informados por empresa y una marca RIFL por persona que debe confirmarse previamente en ARCA. Los recibos individuales se pueden quitar de un período borrador; también se puede eliminar el período completo. La estimación no reemplaza la liquidación profesional ni el F.931.

La solicitud de revisión cambia el estado a **En revisión** y queda visible en la lista de períodos compartida por los miembros del estudio. Un miembro con rol **contador** o **propietario** puede aceptar cada recibo desde la pantalla; se registran la cuenta y la fecha. El recibo aprobado queda bloqueado y se descarga como PDF final del estudio. No se envían correos, ni se registran firma o pago.

El flujo parte de la ficha individual de cada empresa (`/companies/{id}`). Allí se configuran por persona categoría CCT 130/75, jornada, antigüedad, presentismo y porcentajes sindicales/solidarios. Por empresa se configuran las alícuotas ARCA, FAL y ART. El borrador se genera para períodos de noviembre de 2026 a mayo de 2027. Sueldos requiere empresa activa, servicio “Sueldos” o “Sueldos y contabilidad”, perfiles completos, parámetros patronales y las siete migraciones aplicadas en orden (`20261122000000` a `20261128000000`).

## Advertencias de alcance

- La aplicación es una herramienta de apoyo profesional; no reemplaza la revisión del contador.
- Las reglas de liquidación laboral, convenios, retenciones y ajuste por inflación deben ser versionadas y verificadas.
- Recibo de sueldo: la Ley 27.802 modificó el artículo 140 de la LCT y el Decreto 407/2026 reglamentó su contenido y aprobó un modelo en el Anexo III. La especificación exige las cuatro secciones del artículo 5 del Anexo I, el detalle de conceptos a cargo del empleador antes del bruto del trabajador y, en el anverso, el resumen del costo laboral por los siete rubros mínimos. El gráfico circular se debe reproducir solo según el modelo gráfico oficial del Anexo III; no surge como requisito independiente del texto del artículo 5. La documentación del proyecto no implica que esa plantilla ya esté implementada. Las alícuotas y reglas se mantienen parametrizadas, versionadas y sujetas a aprobación profesional.
- No se deben cargar credenciales, claves API ni datos reales de empleados en Git.
# estudiocontable
