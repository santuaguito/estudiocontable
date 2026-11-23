export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];
export type CompanyService = "payroll" | "balance" | "both";
export type StudioRole = "owner" | "accountant" | "assistant" | "viewer";
export type PayrollStatus = "draft" | "review_requested" | "approved";
export type PayrollItemType = "employer_contribution" | "remuneration" | "deduction";
export type EmployerCostCategory = "sindical" | "seguridad_social" | "obra_social" | "inssjp" | "art" | "camaras" | "otros";

type Table<Row, Insert, Update = Partial<Insert>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      studios: Table<
        { id: string; name: string; created_at: string },
        { id?: string; name: string; created_at?: string }
      >;
      studio_members: Table<
        { studio_id: string; user_id: string; role: StudioRole; created_at: string },
        { studio_id: string; user_id: string; role?: StudioRole; created_at?: string }
      >;
      companies: Table<
        {
          id: string; studio_id: string; legal_name: string; tax_id: string;
          address: string; service_type: CompanyService; fiscal_year_end: string | null;
          active: boolean; created_at: string; updated_at: string;
          arca_employer_rate: number | null; fal_rate: number; art_rate: number | null;
        },
        {
          id?: string; studio_id: string; legal_name: string; tax_id: string;
          address: string; service_type: CompanyService; fiscal_year_end?: string | null;
          active?: boolean; created_at?: string; updated_at?: string;
          arca_employer_rate?: number | null; fal_rate?: number; art_rate?: number | null;
        }
      >;
      employees: Table<
        {
          id: string; studio_id: string; company_id: string; full_name: string;
          cuil: string; category: string; start_date: string; base_salary: number; active: boolean;
          cct_code: string | null; weekly_hours: number; seniority_years: number; presentismo_eligible: boolean;
          union_rate: number; solidarity_rate: number; rifl_eligible: boolean;
          created_at: string; updated_at: string;
        },
        {
          id?: string; studio_id: string; company_id: string; full_name: string;
          cuil: string; category: string; start_date: string; base_salary?: number; active?: boolean;
          cct_code?: string | null; weekly_hours?: number; seniority_years?: number; presentismo_eligible?: boolean;
          union_rate?: number; solidarity_rate?: number; rifl_eligible?: boolean;
          created_at?: string; updated_at?: string;
        }
      >;
      audit_events: Table<
        {
          id: string; studio_id: string; user_id: string; action: string;
          entity_type: string; entity_id: string | null; details: Json; created_at: string;
        },
        {
          id?: string; studio_id: string; user_id: string; action: string;
          entity_type: string; entity_id?: string | null; details?: Json; created_at?: string;
        }
      >;
      payroll_periods: Table<
        {
          id: string; studio_id: string; company_id: string; payment_year: number;
          payment_month: number; payment_date: string | null; payment_location: string | null;
          social_contributions_payment_date: string | null;
          social_contributions_payment_location: string | null;
          status: PayrollStatus; created_by: string; created_at: string; updated_at: string;
        },
        {
          id?: string; studio_id: string; company_id: string; payment_year: number;
          payment_month: number; payment_date?: string | null; payment_location?: string | null;
          social_contributions_payment_date?: string | null;
          social_contributions_payment_location?: string | null;
          status?: PayrollStatus; created_by: string; created_at?: string; updated_at?: string;
        }
      >;
      payroll_slips: Table<
        {
          id: string; studio_id: string; company_id: string; period_id: string; employee_id: string;
          status: PayrollStatus; company_snapshot: Json; employee_snapshot: Json;
          created_by: string; created_at: string; updated_at: string;
          reviewed_by: string | null; reviewed_at: string | null;
        },
        {
          id?: string; studio_id: string; company_id: string; period_id: string; employee_id: string;
          status?: PayrollStatus; company_snapshot: Json; employee_snapshot: Json;
          created_by: string; created_at?: string; updated_at?: string;
          reviewed_by?: string | null; reviewed_at?: string | null;
        }
      >;
      payroll_items: Table<
        {
          id: string; studio_id: string; slip_id: string; item_type: PayrollItemType;
          cost_category: EmployerCostCategory | null; description: string;
          calculation_base: number | null; unit: string | null; amount: number;
          calculation_note: string | null; rule_version: string | null;
          sort_order: number; created_by: string; created_at: string; updated_at: string;
        },
        {
          id?: string; studio_id: string; slip_id: string; item_type: PayrollItemType;
          cost_category?: EmployerCostCategory | null; description: string;
          calculation_base?: number | null; unit?: string | null; amount: number;
          calculation_note?: string | null; rule_version?: string | null;
          sort_order?: number; created_by: string; created_at?: string; updated_at?: string;
        }
      >;
    };
    Views: { [_ in never]: never };
    Functions: {
      is_studio_member: { Args: { target_studio_id: string }; Returns: boolean };
      create_payroll_drafts: {
        Args: {
          target_company_id: string; target_year: number; target_month: number;
          target_payment_date: string | null; target_payment_location: string | null;
          target_social_contributions_payment_date: string | null;
          target_social_contributions_payment_location: string | null;
        };
        Returns: string;
      };
      request_payroll_review: { Args: { target_period_id: string }; Returns: number };
      approve_payroll_slip: { Args: { target_slip_id: string }; Returns: boolean };
      delete_payroll_draft: { Args: { target_period_id: string }; Returns: undefined };
      delete_payroll_slip_draft: { Args: { target_slip_id: string }; Returns: undefined };
    };
    Enums: {
      studio_role: StudioRole; company_service: CompanyService; payroll_status: PayrollStatus;
      payroll_item_type: PayrollItemType; employer_cost_category: EmployerCostCategory;
    };
    CompositeTypes: { [_ in never]: never };
  };
};
