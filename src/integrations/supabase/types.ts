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
      affiliates: {
        Row: {
          created_at: string
          email: string
          id: string
          is_active: boolean
          link_anual: string
          link_mensal: string
          link_trimestral: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          is_active?: boolean
          link_anual: string
          link_mensal: string
          link_trimestral: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          is_active?: boolean
          link_anual?: string
          link_mensal?: string
          link_trimestral?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      bills: {
        Row: {
          amount: number
          category: string | null
          created_at: string
          description: string
          due_date: string
          id: string
          is_recurring: boolean | null
          notes: string | null
          owner_type: string | null
          paid_date: string | null
          payee_name: string
          pix_key: string | null
          recurrence_months: number | null
          status: Database["public"]["Enums"]["payment_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          category?: string | null
          created_at?: string
          description: string
          due_date: string
          id?: string
          is_recurring?: boolean | null
          notes?: string | null
          owner_type?: string | null
          paid_date?: string | null
          payee_name: string
          pix_key?: string | null
          recurrence_months?: number | null
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          category?: string | null
          created_at?: string
          description?: string
          due_date?: string
          id?: string
          is_recurring?: boolean | null
          notes?: string | null
          owner_type?: string | null
          paid_date?: string | null
          payee_name?: string
          pix_key?: string | null
          recurrence_months?: number | null
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      check_discount_payments: {
        Row: {
          amount: number
          check_discount_id: string
          created_at: string
          id: string
          installment_number: number
          notes: string | null
          payment_date: string
          user_id: string
        }
        Insert: {
          amount: number
          check_discount_id: string
          created_at?: string
          id?: string
          installment_number?: number
          notes?: string | null
          payment_date?: string
          user_id: string
        }
        Update: {
          amount?: number
          check_discount_id?: string
          created_at?: string
          id?: string
          installment_number?: number
          notes?: string | null
          payment_date?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "check_discount_payments_check_discount_id_fkey"
            columns: ["check_discount_id"]
            isOneToOne: false
            referencedRelation: "check_discounts"
            referencedColumns: ["id"]
          },
        ]
      }
      check_discounts: {
        Row: {
          bank_name: string
          check_number: string
          client_id: string | null
          created_at: string
          discount_amount: number
          discount_date: string
          discount_rate: number
          discount_type: string
          due_date: string
          id: string
          installments_count: number | null
          issuer_document: string | null
          issuer_name: string | null
          net_value: number
          nominal_value: number
          notes: string | null
          payment_method: string | null
          penalty_amount: number | null
          penalty_rate: number | null
          purchase_value: number | null
          return_date: string | null
          return_reason: string | null
          seller_name: string | null
          status: string
          total_debt: number | null
          total_paid_debt: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          bank_name: string
          check_number: string
          client_id?: string | null
          created_at?: string
          discount_amount?: number
          discount_date?: string
          discount_rate?: number
          discount_type?: string
          due_date: string
          id?: string
          installments_count?: number | null
          issuer_document?: string | null
          issuer_name?: string | null
          net_value?: number
          nominal_value: number
          notes?: string | null
          payment_method?: string | null
          penalty_amount?: number | null
          penalty_rate?: number | null
          purchase_value?: number | null
          return_date?: string | null
          return_reason?: string | null
          seller_name?: string | null
          status?: string
          total_debt?: number | null
          total_paid_debt?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          bank_name?: string
          check_number?: string
          client_id?: string | null
          created_at?: string
          discount_amount?: number
          discount_date?: string
          discount_rate?: number
          discount_type?: string
          due_date?: string
          id?: string
          installments_count?: number | null
          issuer_document?: string | null
          issuer_name?: string | null
          net_value?: number
          nominal_value?: number
          notes?: string | null
          payment_method?: string | null
          penalty_amount?: number | null
          penalty_rate?: number | null
          purchase_value?: number | null
          return_date?: string | null
          return_reason?: string | null
          seller_name?: string | null
          status?: string
          total_debt?: number | null
          total_paid_debt?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "check_discounts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_assignments: {
        Row: {
          assigned_by: string
          client_id: string
          created_at: string | null
          employee_id: string
          id: string
        }
        Insert: {
          assigned_by: string
          client_id: string
          created_at?: string | null
          employee_id: string
          id?: string
        }
        Update: {
          assigned_by?: string
          client_id?: string
          created_at?: string | null
          employee_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_assignments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_assignments_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
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
          created_by: string
          email: string | null
          facebook: string | null
          full_name: string
          id: string
          instagram: string | null
          is_active: boolean
          late_payments: number | null
          neighborhood: string | null
          notes: string | null
          number: string | null
          on_time_payments: number | null
          phone: string | null
          profession: string | null
          referrer_name: string | null
          referrer_phone: string | null
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
          created_by?: string
          email?: string | null
          facebook?: string | null
          full_name: string
          id?: string
          instagram?: string | null
          is_active?: boolean
          late_payments?: number | null
          neighborhood?: string | null
          notes?: string | null
          number?: string | null
          on_time_payments?: number | null
          phone?: string | null
          profession?: string | null
          referrer_name?: string | null
          referrer_phone?: string | null
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
          created_by?: string
          email?: string | null
          facebook?: string | null
          full_name?: string
          id?: string
          instagram?: string | null
          is_active?: boolean
          late_payments?: number | null
          neighborhood?: string | null
          notes?: string | null
          number?: string | null
          on_time_payments?: number | null
          phone?: string | null
          profession?: string | null
          referrer_name?: string | null
          referrer_phone?: string | null
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
      contract_expenses: {
        Row: {
          amount: number
          category: string
          contract_id: string
          created_at: string
          description: string | null
          expense_date: string
          id: string
          user_id: string
        }
        Insert: {
          amount: number
          category?: string
          contract_id: string
          created_at?: string
          description?: string | null
          expense_date?: string
          id?: string
          user_id: string
        }
        Update: {
          amount?: number
          category?: string
          contract_id?: string
          created_at?: string
          description?: string | null
          expense_date?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contract_expenses_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
        ]
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
      employee_permissions: {
        Row: {
          created_at: string | null
          employee_id: string
          id: string
          permission: Database["public"]["Enums"]["employee_permission"]
        }
        Insert: {
          created_at?: string | null
          employee_id: string
          id?: string
          permission: Database["public"]["Enums"]["employee_permission"]
        }
        Update: {
          created_at?: string | null
          employee_id?: string
          id?: string
          permission?: Database["public"]["Enums"]["employee_permission"]
        }
        Relationships: [
          {
            foreignKeyName: "employee_permissions_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          created_at: string | null
          email: string
          employee_user_id: string
          id: string
          is_active: boolean | null
          name: string
          owner_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          employee_user_id: string
          id?: string
          is_active?: boolean | null
          name: string
          owner_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          employee_user_id?: string
          id?: string
          is_active?: boolean | null
          name?: string
          owner_id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      iptv_plans: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          max_devices: number | null
          name: string
          price: number
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          max_devices?: number | null
          name: string
          price: number
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          max_devices?: number | null
          name?: string
          price?: number
          updated_at?: string | null
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
          contract_date: string | null
          created_at: string
          created_by: string
          due_date: string
          id: string
          installment_dates: Json | null
          installments: number | null
          interest_mode: Database["public"]["Enums"]["interest_mode"] | null
          interest_rate: number
          interest_type: Database["public"]["Enums"]["interest_type"]
          is_third_party: boolean | null
          notes: string | null
          payment_type: Database["public"]["Enums"]["loan_payment_type"]
          principal_amount: number
          remaining_balance: number
          start_date: string
          status: Database["public"]["Enums"]["payment_status"]
          third_party_name: string | null
          total_interest: number | null
          total_paid: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          client_id: string
          contract_date?: string | null
          created_at?: string
          created_by: string
          due_date: string
          id?: string
          installment_dates?: Json | null
          installments?: number | null
          interest_mode?: Database["public"]["Enums"]["interest_mode"] | null
          interest_rate: number
          interest_type?: Database["public"]["Enums"]["interest_type"]
          is_third_party?: boolean | null
          notes?: string | null
          payment_type?: Database["public"]["Enums"]["loan_payment_type"]
          principal_amount: number
          remaining_balance: number
          start_date?: string
          status?: Database["public"]["Enums"]["payment_status"]
          third_party_name?: string | null
          total_interest?: number | null
          total_paid?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          client_id?: string
          contract_date?: string | null
          created_at?: string
          created_by?: string
          due_date?: string
          id?: string
          installment_dates?: Json | null
          installments?: number | null
          interest_mode?: Database["public"]["Enums"]["interest_mode"] | null
          interest_rate?: number
          interest_type?: Database["public"]["Enums"]["interest_type"]
          is_third_party?: boolean | null
          notes?: string | null
          payment_type?: Database["public"]["Enums"]["loan_payment_type"]
          principal_amount?: number
          remaining_balance?: number
          start_date?: string
          status?: Database["public"]["Enums"]["payment_status"]
          third_party_name?: string | null
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
          card_color: string | null
          client_id: string
          created_at: string
          credit_expires_at: string | null
          current_devices: number | null
          demo_expires_at: string | null
          description: string | null
          due_day: number
          id: string
          interest_rate: number | null
          iptv_server_name: string | null
          iptv_server_url: string | null
          is_active: boolean
          is_demo: boolean | null
          last_renewal_at: string | null
          login_password: string | null
          login_username: string | null
          max_devices: number | null
          plan_type: string | null
          referral_source: string | null
          renewal_count: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          card_color?: string | null
          client_id: string
          created_at?: string
          credit_expires_at?: string | null
          current_devices?: number | null
          demo_expires_at?: string | null
          description?: string | null
          due_day?: number
          id?: string
          interest_rate?: number | null
          iptv_server_name?: string | null
          iptv_server_url?: string | null
          is_active?: boolean
          is_demo?: boolean | null
          last_renewal_at?: string | null
          login_password?: string | null
          login_username?: string | null
          max_devices?: number | null
          plan_type?: string | null
          referral_source?: string | null
          renewal_count?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          card_color?: string | null
          client_id?: string
          created_at?: string
          credit_expires_at?: string | null
          current_devices?: number | null
          demo_expires_at?: string | null
          description?: string | null
          due_day?: number
          id?: string
          interest_rate?: number | null
          iptv_server_name?: string | null
          iptv_server_url?: string | null
          is_active?: boolean
          is_demo?: boolean | null
          last_renewal_at?: string | null
          login_password?: string | null
          login_username?: string | null
          max_devices?: number | null
          plan_type?: string | null
          referral_source?: string | null
          renewal_count?: number | null
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
      pending_messages: {
        Row: {
          client_name: string
          client_phone: string
          confirmation_keyword: string | null
          confirmed_at: string | null
          contract_id: string | null
          contract_type: string | null
          created_at: string | null
          expires_at: string | null
          id: string
          message_content: string
          message_type: string
          sent_at: string | null
          status: string
          user_id: string
        }
        Insert: {
          client_name: string
          client_phone: string
          confirmation_keyword?: string | null
          confirmed_at?: string | null
          contract_id?: string | null
          contract_type?: string | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          message_content: string
          message_type: string
          sent_at?: string | null
          status?: string
          user_id: string
        }
        Update: {
          client_name?: string
          client_phone?: string
          confirmation_keyword?: string | null
          confirmed_at?: string | null
          contract_id?: string | null
          contract_type?: string | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          message_content?: string
          message_type?: string
          sent_at?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
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
      profile_audit_log: {
        Row: {
          changed_at: string
          changed_by: string
          field_name: string
          id: string
          ip_address: unknown
          new_value: string | null
          old_value: string | null
          user_agent: string | null
          user_id: string
          verification_id: string | null
        }
        Insert: {
          changed_at?: string
          changed_by: string
          field_name: string
          id?: string
          ip_address?: unknown
          new_value?: string | null
          old_value?: string | null
          user_agent?: string | null
          user_id: string
          verification_id?: string | null
        }
        Update: {
          changed_at?: string
          changed_by?: string
          field_name?: string
          id?: string
          ip_address?: unknown
          new_value?: string | null
          old_value?: string | null
          user_agent?: string | null
          user_id?: string
          verification_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profile_audit_log_verification_id_fkey"
            columns: ["verification_id"]
            isOneToOne: false
            referencedRelation: "verification_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          affiliate_email: string | null
          billing_message_config: Json | null
          billing_signature_name: string | null
          cash_flow_initial_balance: number | null
          check_discount_enabled: boolean | null
          company_logo_url: string | null
          company_name: string | null
          created_at: string
          email: string | null
          employees_feature_enabled: boolean | null
          evolution_api_key: string | null
          evolution_api_url: string | null
          evolution_instance_name: string | null
          full_name: string | null
          has_seen_loan_form_tutorial: boolean | null
          has_seen_loans_tutorial: boolean | null
          id: string
          iptv_server_cost: number | null
          iptv_server_name: string | null
          iptv_server_url: string | null
          is_active: boolean
          max_employees: number | null
          payment_link: string | null
          phone: string | null
          pix_key: string | null
          pix_key_type: string | null
          pix_pre_message: string | null
          report_schedule_hours: number[] | null
          subscription_expires_at: string | null
          subscription_plan: string | null
          temp_password: string | null
          trial_expires_at: string | null
          updated_at: string
          voice_assistant_enabled: boolean | null
          whatsapp_connected_at: string | null
          whatsapp_connected_phone: string | null
          whatsapp_instance_id: string | null
          whatsapp_to_clients_enabled: boolean | null
        }
        Insert: {
          affiliate_email?: string | null
          billing_message_config?: Json | null
          billing_signature_name?: string | null
          cash_flow_initial_balance?: number | null
          check_discount_enabled?: boolean | null
          company_logo_url?: string | null
          company_name?: string | null
          created_at?: string
          email?: string | null
          employees_feature_enabled?: boolean | null
          evolution_api_key?: string | null
          evolution_api_url?: string | null
          evolution_instance_name?: string | null
          full_name?: string | null
          has_seen_loan_form_tutorial?: boolean | null
          has_seen_loans_tutorial?: boolean | null
          id: string
          iptv_server_cost?: number | null
          iptv_server_name?: string | null
          iptv_server_url?: string | null
          is_active?: boolean
          max_employees?: number | null
          payment_link?: string | null
          phone?: string | null
          pix_key?: string | null
          pix_key_type?: string | null
          pix_pre_message?: string | null
          report_schedule_hours?: number[] | null
          subscription_expires_at?: string | null
          subscription_plan?: string | null
          temp_password?: string | null
          trial_expires_at?: string | null
          updated_at?: string
          voice_assistant_enabled?: boolean | null
          whatsapp_connected_at?: string | null
          whatsapp_connected_phone?: string | null
          whatsapp_instance_id?: string | null
          whatsapp_to_clients_enabled?: boolean | null
        }
        Update: {
          affiliate_email?: string | null
          billing_message_config?: Json | null
          billing_signature_name?: string | null
          cash_flow_initial_balance?: number | null
          check_discount_enabled?: boolean | null
          company_logo_url?: string | null
          company_name?: string | null
          created_at?: string
          email?: string | null
          employees_feature_enabled?: boolean | null
          evolution_api_key?: string | null
          evolution_api_url?: string | null
          evolution_instance_name?: string | null
          full_name?: string | null
          has_seen_loan_form_tutorial?: boolean | null
          has_seen_loans_tutorial?: boolean | null
          id?: string
          iptv_server_cost?: number | null
          iptv_server_name?: string | null
          iptv_server_url?: string | null
          is_active?: boolean
          max_employees?: number | null
          payment_link?: string | null
          phone?: string | null
          pix_key?: string | null
          pix_key_type?: string | null
          pix_pre_message?: string | null
          report_schedule_hours?: number[] | null
          subscription_expires_at?: string | null
          subscription_plan?: string | null
          temp_password?: string | null
          trial_expires_at?: string | null
          updated_at?: string
          voice_assistant_enabled?: boolean | null
          whatsapp_connected_at?: string | null
          whatsapp_connected_phone?: string | null
          whatsapp_instance_id?: string | null
          whatsapp_to_clients_enabled?: boolean | null
        }
        Relationships: []
      }
      subscription_reactivations: {
        Row: {
          created_at: string | null
          id: string
          monthly_fee_id: string
          notes: string | null
          previous_inactive_days: number | null
          reactivated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          monthly_fee_id: string
          notes?: string | null
          previous_inactive_days?: number | null
          reactivated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          monthly_fee_id?: string
          notes?: string | null
          previous_inactive_days?: number | null
          reactivated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_reactivations_monthly_fee_id_fkey"
            columns: ["monthly_fee_id"]
            isOneToOne: false
            referencedRelation: "monthly_fees"
            referencedColumns: ["id"]
          },
        ]
      }
      tutorial_videos: {
        Row: {
          category: string
          created_at: string | null
          description: string | null
          duration: string | null
          id: string
          is_active: boolean | null
          order_number: number
          title: string
          updated_at: string | null
          youtube_video_id: string | null
        }
        Insert: {
          category?: string
          created_at?: string | null
          description?: string | null
          duration?: string | null
          id?: string
          is_active?: boolean | null
          order_number: number
          title: string
          updated_at?: string | null
          youtube_video_id?: string | null
        }
        Update: {
          category?: string
          created_at?: string | null
          description?: string | null
          duration?: string | null
          id?: string
          is_active?: boolean | null
          order_number?: number
          title?: string
          updated_at?: string | null
          youtube_video_id?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
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
      verification_codes: {
        Row: {
          attempts: number
          code: string
          created_at: string
          expires_at: string
          field_name: string
          id: string
          ip_address: unknown
          pending_updates: Json
          user_agent: string | null
          user_id: string
          verified_at: string | null
        }
        Insert: {
          attempts?: number
          code: string
          created_at?: string
          expires_at?: string
          field_name: string
          id?: string
          ip_address?: unknown
          pending_updates?: Json
          user_agent?: string | null
          user_id: string
          verified_at?: string | null
        }
        Update: {
          attempts?: number
          code?: string
          created_at?: string
          expires_at?: string
          field_name?: string
          id?: string
          ip_address?: unknown
          pending_updates?: Json
          user_agent?: string | null
          user_id?: string
          verified_at?: string | null
        }
        Relationships: []
      }
      whatsapp_messages: {
        Row: {
          client_name: string
          client_phone: string
          contract_type: string
          created_at: string | null
          id: string
          loan_id: string | null
          message_type: string
          sent_at: string | null
          user_id: string
        }
        Insert: {
          client_name: string
          client_phone: string
          contract_type: string
          created_at?: string | null
          id?: string
          loan_id?: string | null
          message_type: string
          sent_at?: string | null
          user_id: string
        }
        Update: {
          client_name?: string
          client_phone?: string
          contract_type?: string
          created_at?: string | null
          id?: string
          loan_id?: string | null
          message_type?: string
          sent_at?: string | null
          user_id?: string
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
      can_view_client: {
        Args: {
          _client_created_by: string
          _client_id: string
          _client_user_id: string
          _user_id: string
        }
        Returns: boolean
      }
      can_view_client_optimized: {
        Args: {
          _client_created_by: string
          _client_id: string
          _client_user_id: string
          _user_id: string
        }
        Returns: boolean
      }
      can_view_loan: {
        Args: {
          _loan_created_by: string
          _loan_user_id: string
          _user_id: string
        }
        Returns: boolean
      }
      can_view_loan_optimized: {
        Args: {
          _loan_created_by: string
          _loan_user_id: string
          _user_id: string
        }
        Returns: boolean
      }
      debug_auth_uid: {
        Args: never
        Returns: {
          current_uid: string
          is_authenticated: boolean
        }[]
      }
      get_dashboard_stats: {
        Args: { p_user_id: string }
        Returns: {
          active_clients: number
          active_loans_count: number
          due_today_count: number
          loans_this_week: number
          overdue_amount: number
          overdue_count: number
          overdue_this_week: number
          paid_loans_count: number
          pending_interest: number
          received_this_week: number
          total_loaned: number
          total_pending: number
          total_received: number
        }[]
      }
      get_employee_context: {
        Args: { _user_id: string }
        Returns: {
          employee_id: string
          employee_name: string
          is_active: boolean
          is_employee: boolean
          owner_id: string
          permissions: string[]
        }[]
      }
      get_employee_owner_id: { Args: { _user_id: string }; Returns: string }
      has_employee_permission: {
        Args: { _permission: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_active_employee: { Args: { _user_id: string }; Returns: boolean }
      payment_created_second: { Args: { ts: string }; Returns: string }
    }
    Enums: {
      app_role: "admin" | "user"
      client_type: "loan" | "monthly" | "both"
      employee_permission:
        | "view_loans"
        | "create_loans"
        | "register_payments"
        | "adjust_dates"
        | "delete_loans"
        | "view_clients"
        | "create_clients"
        | "edit_clients"
        | "delete_clients"
        | "view_reports"
        | "manage_bills"
        | "manage_vehicles"
        | "manage_products"
        | "view_settings"
        | "view_all_loans"
        | "view_dashboard"
        | "view_all_clients"
        | "manage_checks"
      interest_mode: "per_installment" | "on_total" | "compound"
      interest_type: "simple" | "compound"
      loan_payment_type:
        | "single"
        | "installment"
        | "daily"
        | "weekly"
        | "biweekly"
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
      app_role: ["admin", "user"],
      client_type: ["loan", "monthly", "both"],
      employee_permission: [
        "view_loans",
        "create_loans",
        "register_payments",
        "adjust_dates",
        "delete_loans",
        "view_clients",
        "create_clients",
        "edit_clients",
        "delete_clients",
        "view_reports",
        "manage_bills",
        "manage_vehicles",
        "manage_products",
        "view_settings",
        "view_all_loans",
        "view_dashboard",
        "view_all_clients",
        "manage_checks",
      ],
      interest_mode: ["per_installment", "on_total", "compound"],
      interest_type: ["simple", "compound"],
      loan_payment_type: [
        "single",
        "installment",
        "daily",
        "weekly",
        "biweekly",
      ],
      payment_status: ["paid", "pending", "overdue"],
    },
  },
} as const
