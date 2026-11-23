import PayrollWorkspace from "@/modules/payroll/PayrollWorkspace";

export default async function CompanyPayrollPage({ params }: { params: Promise<{ companyId: string }> }) {
  const { companyId } = await params;
  return <PayrollWorkspace companyId={companyId} />;
}
