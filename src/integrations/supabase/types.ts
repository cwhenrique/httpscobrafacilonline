export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      bills: {
        Row: {
          amount: number
          created_at: string
          description: string
          due_date: string
          id: string
          notes: string | null
          paid_date: string | null
          payee_name: string
          status: Database["public"]["Enums"]["payment_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          description: string
          due_date: string
          id?: string
          notes?: string | null
          paid_date?: string | null
          payee_name: string
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string
          due_date?: string
          id?: string
          notes?: string | null
          paid_date?: string | null
          payee_name?: string
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      client_documents: {
        Row: {
          client_id: string
          created_at: string
          description: string | null
          file_name: string
          file_path: string
          file_size: number | null
          file_type: string | null
          id: string
          user_id: string
        }
        Insert: {
          client_id: string
          created_at?: string
          description?: string | null
          file_name: string
          file_path: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          user_id: string
        }
        Update: {
          client_id?: string
          created_at?: string
          description?: string | null
          file_name?: string
          file_path?: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_documents_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          address: string | null
          avatar_url: string | null
          cep: string | null
          city: string | null
          client_type: Database["public"]["Enums"]["client_type"]
          complement: string | null
          cpf: string | null
          created_at: string
          email: string | null
          full_name: string
          id: string
          late_payments: number | null
          neighborhood: string | null
          notes: string | null
          number: string | null
          on_time_payments: number | null
          phone: string | null
          rg: string | null
          score: number | null
          score_updated_at: string | null
          state: string | null
          street: string | null
          total_loans: number | null
          total_paid: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: string | null
          avatar_url?: string | null
          cep?: string | null
          city?: string | null
          client_type?: Database["public"]["Enums"]["client_type"]
          complement?: string | null
          cpf?: string | null
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          late_payments?: number | null
          neighborhood?: string | null
          notes?: string | null
          number?: string | null
          on_time_payments?: number | null
          phone?: string | null
          rg?: string | null
          score?: number | null
          score_updated_at?: string | null
          state?: string | null
          street?: string | null
          total_loans?: number | null
          total_paid?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string | null
          avatar_url?: string | null
          cep?: string | null
          city?: string | null
          client_type?: Database["public"]["Enums"]["client_type"]
          complement?: string | null
          cpf?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          late_payments?: number | null
          neighborhood?: string | null
          notes?: string | null
          number?: string | null
          on_time_payments?: number | null
          phone?: string | null
          rg?: string | null
          score?: number | null
          score_updated_at?: string | null
          state?: string | null
          street?: string | null
          total_loans?: number | null
          total_paid?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      contract_payments: {
        Row: {
          amount: number
          contract_id: string
          created_at: string
          due_date: string
          id: string
          installment_number: number
          notes: string | null
          paid_date: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          contract_id: string
          created_at?: string
          due_date: string
          id?: string
          installment_number: number
          notes?: string | null
          paid_date?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          contract_id?: string
          created_at?: string
          due_date?: string
          id?: string
          installment_number?: number
          notes?: string | null
          paid_date?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contract_payments_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      contracts: {
        Row: {
          amount_to_receive: number
          bill_type: string
          client_address: string | null
          client_cpf: string | null
          client_email: string | null
          client_name: string
          client_phone: string | null
          client_rg: string | null
          contract_date: string | null
          contract_type: string
          created_at: string
          first_payment_date: string
          frequency: string
          id: string
          installments: number
          notes: string | null
          payment_method: string | null
          status: string
          total_amount: number
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_to_receive: number
          bill_type?: string
          client_address?: string | null
          client_cpf?: string | null
          client_email?: string | null
          client_name: string
          client_phone?: string | null
          client_rg?: string | null
          contract_date?: string | null
          contract_type?: string
          created_at?: string
          first_payment_date: string
          frequency?: string
          id?: string
          installments?: number
          notes?: string | null
          payment_method?: string | null
          status?: string
          total_amount: number
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_to_receive?: number
          bill_type?: string
          client_address?: string | null
          client_cpf?: string | null
          client_email?: string | null
          client_name?: string
          client_phone?: string | null
          client_rg?: string | null
          contract_date?: string | null
          contract_type?: string
          created_at?: string
          first_payment_date?: string
          frequency?: string
          id?: string
          installments?: number
          notes?: string | null
          payment_method?: string | null
          status?: string
          total_amount?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      loan_payments: {
        Row: {
          amount: number
          created_at: string
          id: string
          interest_paid: number | null
          loan_id: string
          notes: string | null
          payment_date: string
          principal_paid: number | null
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          interest_paid?: number | null
          loan_id: string
          notes?: string | null
          payment_date?: string
          principal_paid?: number | null
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          interest_paid?: number | null
          loan_id?: string
          notes?: string | null
          payment_date?: string
          principal_paid?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "loan_payments_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loans"
            referencedColumns: ["id"]
          },
        ]
      }
      loans: {
        Row: {
          client_id: string
          created_at: string
          due_date: string
          id: string
          installment_dates: Json | null
          installments: number | null
          interest_mode: Database["public"]["Enums"]["interest_mode"] | null
          interest_rate: number
          interest_type: Database["public"]["Enums"]["interest_type"]
          notes: string | null
          payment_type: Database["public"]["Enums"]["loan_payment_type"]
          principal_amount: number
          remaining_balance: number
          start_date: string
          status: Database["public"]["Enums"]["payment_status"]
          total_interest: number | null
          total_paid: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          client_id: string
          created_at?: string
          due_date: string
          id?: string
          installment_dates?: Json | null
          installments?: number | null
          interest_mode?: Database["public"]["Enums"]["interest_mode"] | null
          interest_rate: number
          interest_type?: Database["public"]["Enums"]["interest_type"]
          notes?: string | null
          payment_type?: Database["public"]["Enums"]["loan_payment_type"]
          principal_amount: number
          remaining_balance: number
          start_date?: string
          status?: Database["public"]["Enums"]["payment_status"]
          total_interest?: number | null
          total_paid?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          client_id?: string
          created_at?: string
          due_date?: string
          id?: string
          installment_dates?: Json | null
          installments?: number | null
          interest_mode?: Database["public"]["Enums"]["interest_mode"] | null
          interest_rate?: number
          interest_type?: Database["public"]["Enums"]["interest_type"]
          notes?: string | null
          payment_type?: Database["public"]["Enums"]["loan_payment_type"]
          principal_amount?: number
          remaining_balance?: number
          start_date?: string
          status?: Database["public"]["Enums"]["payment_status"]
          total_interest?: number | null
          total_paid?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "loans_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      monthly_fee_payments: {
        Row: {
          amount: number
          created_at: string
          due_date: string
          id: string
          monthly_fee_id: string
          notes: string | null
          payment_date: string | null
          reference_month: string
          status: Database["public"]["Enums"]["payment_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          due_date: string
          id?: string
          monthly_fee_id: string
          notes?: string | null
          payment_date?: string | null
          reference_month: string
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          due_date?: string
          id?: string
          monthly_fee_id?: string
          notes?: string | null
          payment_date?: string | null
          reference_month?: string
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "monthly_fee_payments_monthly_fee_id_fkey"
            columns: ["monthly_fee_id"]
            isOneToOne: false
            referencedRelation: "monthly_fees"
            referencedColumns: ["id"]
          },
        ]
      }
      monthly_fees: {
        Row: {
          amount: number
          client_id: string
          created_at: string
          description: string | null
          due_day: number
          id: string
          interest_rate: number | null
          is_active: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          client_id: string
          created_at?: string
          description?: string | null
          due_day?: number
          id?: string
          interest_rate?: number | null
          is_active?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          client_id?: string
          created_at?: string
          description?: string | null
          due_day?: number
          id?: string
          interest_rate?: number | null
          is_active?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "monthly_fees_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          client_id: string | null
          created_at: string
          id: string
          is_read: boolean
          loan_id: string | null
          message: string
          title: string
          type: string
          user_id: string
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          loan_id?: string | null
          message: string
          title: string
          type?: string
          user_id: string
        }
        Update: {
          client_id?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          loan_id?: string | null
          message?: string
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loans"
            referencedColumns: ["id"]
          },
        ]
      }
      product_sale_payments: {
        Row: {
          amount: number
          created_at: string
          due_date: string
          id: string
          installment_number: number
          notes: string | null
          paid_date: string | null
          product_sale_id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          due_date: string
          id?: string
          installment_number: number
          notes?: string | null
          paid_date?: string | null
          product_sale_id: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          due_date?: string
          id?: string
          installment_number?: number
          notes?: string | null
          paid_date?: string | null
          product_sale_id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_sale_payments_product_sale_id_fkey"
            columns: ["product_sale_id"]
            isOneToOne: false
            referencedRelation: "product_sales"
            referencedColumns: ["id"]
          },
        ]
      }
      product_sales: {
        Row: {
          client_address: string | null
          client_cpf: string | null
          client_email: string | null
          client_name: string
          client_phone: string | null
          client_rg: string | null
          cost_value: number | null
          created_at: string
          down_payment: number | null
          first_due_date: string
          id: string
          installment_value: number
          installments: number
          notes: string | null
          product_description: string | null
          product_name: string
          remaining_balance: number
          sale_date: string
          status: string
          total_amount: number
          total_paid: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          client_address?: string | null
          client_cpf?: string | null
          client_email?: string | null
          client_name: string
          client_phone?: string | null
          client_rg?: string | null
          cost_value?: number | null
          created_at?: string
          down_payment?: number | null
          first_due_date: string
          id?: string
          installment_value: number
          installments?: number
          notes?: string | null
          product_description?: string | null
          product_name: string
          remaining_balance: number
          sale_date?: string
          status?: string
          total_amount: number
          total_paid?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          client_address?: string | null
          client_cpf?: string | null
          client_email?: string | null
          client_name?: string
          client_phone?: string | null
          client_rg?: string | null
          cost_value?: number | null
          created_at?: string
          down_payment?: number | null
          first_due_date?: string
          id?: string
          installment_value?: number
          installments?: number
          notes?: string | null
          product_description?: string | null
          product_name?: string
          remaining_balance?: number
          sale_date?: string
          status?: string
          total_amount?: number
          total_paid?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          company_name: string | null
          created_at: string
          email: string | null
          full_name: string | null
          has_seen_loan_form_tutorial: boolean | null
          has_seen_loans_tutorial: boolean | null
          id: string
          is_active: boolean
          phone: string | null
          temp_password: string | null
          trial_expires_at: string | null
          updated_at: string
        }
        Insert: {
          company_name?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          has_seen_loan_form_tutorial?: boolean | null
          has_seen_loans_tutorial?: boolean | null
          id: string
          is_active?: boolean
          phone?: string | null
          temp_password?: string | null
          trial_expires_at?: string | null
          updated_at?: string
        }
        Update: {
          company_name?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          has_seen_loan_form_tutorial?: boolean | null
          has_seen_loans_tutorial?: boolean | null
          id?: string
          is_active?: boolean
          phone?: string | null
          temp_password?: string | null
          trial_expires_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      vehicle_payments: {
        Row: {
          amount: number
          created_at: string
          due_date: string
          id: string
          installment_number: number
          notes: string | null
          paid_date: string | null
          status: string
          updated_at: string
          user_id: string
          vehicle_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          due_date: string
          id?: string
          installment_number: number
          notes?: string | null
          paid_date?: string | null
          status?: string
          updated_at?: string
          user_id: string
          vehicle_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          due_date?: string
          id?: string
          installment_number?: number
          notes?: string | null
          paid_date?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_payments_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicles: {
        Row: {
          brand: string
          buyer_address: string | null
          buyer_cpf: string | null
          buyer_email: string | null
          buyer_name: string | null
          buyer_phone: string | null
          buyer_rg: string | null
          chassis: string | null
          color: string | null
          cost_value: number | null
          created_at: string
          down_payment: number | null
          first_due_date: string
          id: string
          installment_value: number
          installments: number
          model: string
          notes: string | null
          plate: string | null
          purchase_date: string
          purchase_value: number
          remaining_balance: number
          seller_name: string
          status: string
          total_paid: number | null
          updated_at: string
          user_id: string
          year: number
        }
        Insert: {
          brand: string
          buyer_address?: string | null
          buyer_cpf?: string | null
          buyer_email?: string | null
          buyer_name?: string | null
          buyer_phone?: string | null
          buyer_rg?: string | null
          chassis?: string | null
          color?: string | null
          cost_value?: number | null
          created_at?: string
          down_payment?: number | null
          first_due_date: string
          id?: string
          installment_value: number
          installments?: number
          model: string
          notes?: string | null
          plate?: string | null
          purchase_date?: string
          purchase_value: number
          remaining_balance: number
          seller_name: string
          status?: string
          total_paid?: number | null
          updated_at?: string
          user_id: string
          year: number
        }
        Update: {
          brand?: string
          buyer_address?: string | null
          buyer_cpf?: string | null
          buyer_email?: string | null
          buyer_name?: string | null
          buyer_phone?: string | null
          buyer_rg?: string | null
          chassis?: string | null
          color?: string | null
          cost_value?: number | null
          created_at?: string
          down_payment?: number | null
          first_due_date?: string
          id?: string
          installment_value?: number
          installments?: number
          model?: string
          notes?: string | null
          plate?: string | null
          purchase_date?: string
          purchase_value?: number
          remaining_balance?: number
          seller_name?: string
          status?: string
          total_paid?: number | null
          updated_at?: string
          user_id?: string
          year?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      calculate_client_score: {
        Args: { p_late: number; p_on_time: number; p_total_loans: number }
        Returns: number
      }
    }
    Enums: {
      client_type: "loan" | "monthly" | "both"
      interest_mode: "per_installment" | "on_total"
      interest_type: "simple" | "compound"
      loan_payment_type: "single" | "installment" | "daily" | "weekly"
      payment_status: "paid" | "pending" | "overdue"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      client_type: ["loan", "monthly", "both"],
      interest_mode: ["per_installment", "on_total"],
      interest_type: ["simple", "compound"],
      loan_payment_type: ["single", "installment", "daily", "weekly"],
      payment_status: ["paid", "pending", "overdue"],
    },
  },
} as const
