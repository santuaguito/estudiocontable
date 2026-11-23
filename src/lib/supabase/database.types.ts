export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];
export type CompanyService = "payroll" | "balance" | "both";
export type StudioRole = "owner" | "accountant" | "assistant" | "viewer";

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
        },
        {
          id?: string; studio_id: string; legal_name: string; tax_id: string;
          address: string; service_type: CompanyService; fiscal_year_end?: string | null;
          active?: boolean; created_at?: string; updated_at?: string;
        }
      >;
      employees: Table<
        {
          id: string; studio_id: string; company_id: string; full_name: string;
          cuil: string; category: string; start_date: string; active: boolean;
          created_at: string; updated_at: string;
        },
        {
          id?: string; studio_id: string; company_id: string; full_name: string;
          cuil: string; category: string; start_date: string; active?: boolean;
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
    };
    Views: { [_ in never]: never };
    Functions: {
      is_studio_member: { Args: { target_studio_id: string }; Returns: boolean };
    };
    Enums: { studio_role: StudioRole; company_service: CompanyService };
    CompositeTypes: { [_ in never]: never };
  };
};
