# Modelo de datos inicial

Los nombres son orientativos; el agente debe convertirlos a modelos Prisma y generar migraciones.

## Tenant / User
- `Tenant`: estudio contable, nombre, configuración, zona horaria.
- `User`: email normalizado, passwordHash/proveedor, estado.
- `Membership`: userId, tenantId, rol, permisos.
- `AuditLog`: tenantId, userId, entidad, entityId, acción, cambios redactados, timestamp, requestId.

## Empresas y empleados
- `Company`: tenantId, CUIT normalizado, razón social, domicilio, serviceType, fiscalYearEndMonth, fiscalYearEndDay, status.
- `Employee`: companyId, CUIL normalizado, nombre, categoría, fechaIngreso, fechaBaja, status.
- `EmployeeCompensationVersion`: employeeId, validFrom, validTo, sueldoBasico, porcentajes/importes configurados, adicionalConectividad, fuente/regla.
- `PayrollPeriod`: companyId, year, month, status, closedAt.
- `PayrollRun`: periodId, version, status, approvedBy, approvedAt.
- `PayrollSlip`: payrollRunId, employeeId, employeeSnapshot JSON, ruleSnapshot JSON, gross, deductions, net, status, pdfObjectKey, issuedAt.
- `PayrollItem`: slipId, code, label, category, base, rate, amount, calculationDescription, ruleVersion.

## Contabilidad
- `ChartOfAccount`: tenantId, code, name, accountType, parentId, isPostingAccount, inflationAdjusted, adjustmentAccountId, active.
- `BankAccount`: companyId, name, bankName, currency, chartAccountId.
- `BankStatementImport`: bankAccountId, fileHash, filename, importedAt, importedBy, status.
- `BankTransaction`: importId, externalId, date, originalDescription, editableDescription, debit, credit, balance, currency, transactionHash, classificationStatus.
- `Counterparty`: tenantId, taxId opcional, name, normalizedName.
- `JournalEntry`: companyId, date, period, number, description, sourceType, sourceId, status, createdBy, approvedBy, reversedEntryId.
- `JournalLine`: journalEntryId, accountId, counterpartyId opcional, description, debit, credit, currency, exchangeRate opcional.
- `RecurringEntryTemplate`: companyId, name, active, schedule, lines JSON validado, lastGeneratedPeriod.
- `TrialBalanceSnapshot`: companyId, period, version, generatedAt, totals JSON, status.

## Ajuste por inflación
- `InflationIndex`: tenantId, source, series, month, value decimal, publicationDate, verifiedBy, notes.
- `InflationAdjustmentRun`: companyId, fiscalPeriod, indexSeries, status, methodVersion, generatedAt, approvedBy.
- `InflationAdjustmentLine`: runId, accountId, sourceJournalLineId, originDate, originalAmount, coefficient, adjustedAmount, adjustmentAmount, calculationDetails JSON.

## Restricciones esenciales
- Unicidad CUIT por tenant.
- Unicidad CUIL por empresa (configurable según situación).
- Un recibo por empleado y período en una corrida, salvo corrida complementaria.
- Un código de cuenta por tenant.
- Debe y Haber no negativos en líneas normales; no permitir ambos > 0 en una misma línea.
- En cada asiento contabilizado: totalDebe = totalHaber.
- Índices mensuales únicos por fuente/serie.
- Soft delete en empresas, empleados y cuentas con movimientos.
- FK y cascadas restrictivas para evitar borrar historia contable.
