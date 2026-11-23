# Arquitectura técnica recomendada

## Stack sugerido

- Frontend y backend: Next.js con TypeScript (App Router).
- UI: Tailwind CSS + componentes accesibles.
- Base de datos: PostgreSQL.
- ORM: Prisma.
- Autenticación: Auth.js o proveedor gestionado compatible; preferir contraseña con hashing seguro y recuperación.
- PDFs: generación server-side con librería mantenida (por ejemplo, PDFKit o React PDF), validada en el runtime de despliegue.
- Almacenamiento de PDFs y archivos: bucket privado compatible con S3; no guardar archivos sensibles en rutas públicas.
- Validación: Zod en todas las entradas.
- Testing: Vitest, Testing Library y Playwright.
- CI: GitHub Actions con lint, typecheck, tests y build.

La elección final de hosting debe validarse para procesos de PDF, archivos y límites del plan. No asumir que un proceso pesado puede ejecutarse en una función serverless sin límites.

## Principios

1. Separar UI, casos de uso, reglas de negocio y acceso a datos.
2. Todas las operaciones contables deben ejecutarse en transacciones de base de datos.
3. Usar decimal de precisión para importes; nunca `float`/`number` como almacenamiento monetario.
4. Guardar importes en unidades decimales o centavos con escala definida y moneda explícita.
5. No borrar registros contables emitidos: anular/revertir con trazabilidad.
6. Guardar snapshot de datos y reglas utilizados al emitir un recibo.
7. Validar autorización en backend, no solo ocultar botones.
8. Todas las fechas contables deben respetar zona horaria y calendario fiscal de Argentina.
9. Aislar datos por estudio/tenant desde el modelo inicial, aunque inicialmente exista un único usuario.

## Estructura sugerida

```text
src/
  app/
    (auth)/login/
    (private)/dashboard/
    (private)/companies/
    (private)/payroll/
    (private)/accounting/bank-import/
    (private)/accounting/trial-balance/
    (private)/accounting/inflation/
    api/
  components/
  modules/
    auth/
    companies/
    employees/
    payroll/
    bank-import/
    accounting/
    inflation/
    reports/
  lib/
    db/
    auth/
    validation/
    pdf/
    audit/
  domain/
    payroll/
    accounting/
    inflation/
  tests/
prisma/
  schema.prisma
```

## Seguridad y privacidad

- Contraseñas con Argon2id o bcrypt con configuración segura.
- Rate limit en login y endpoints de procesamiento.
- CSRF y cookies seguras según framework.
- Protección contra acceso horizontal: empresa A no puede consultar empresa B.
- CUIT/CUIL y datos salariales considerados sensibles; acceso mínimo necesario.
- Cifrado en tránsito y cifrado de almacenamiento provisto por hosting.
- Secretos solo en variables de entorno del servidor.
- `.env`, `.env.local`, archivos de claves y backups fuera de Git.
- Auditoría para alta/edición/baja, emisión/anulación y cierre.
- Política de backup, restauración y retención.
- No registrar CUIT/CUIL, salarios ni contenido bancario completo en logs.
- Archivos importados con límite de tamaño, MIME validado y sanitización.

## Entornos

- `development`: datos ficticios.
- `test`: base aislada y fixtures.
- `staging`: datos anonimizados.
- `production`: datos reales con backups y acceso restringido.

## Observación

La aplicación no debe depender de un único proveedor de IA para contabilizar o liquidar. Las reglas críticas deben ser deterministas, versionadas y aprobadas por profesionales.
