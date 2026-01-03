-- Adicionar nova permissão view_dashboard ao enum
ALTER TYPE public.employee_permission ADD VALUE IF NOT EXISTS 'view_dashboard';