-- Add score columns to clients table
ALTER TABLE public.clients 
ADD COLUMN IF NOT EXISTS score INTEGER DEFAULT 100,
ADD COLUMN IF NOT EXISTS total_loans INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_paid NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS on_time_payments INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS late_payments INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS score_updated_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Create a function to calculate client score
CREATE OR REPLACE FUNCTION public.calculate_client_score(
  p_on_time INTEGER,
  p_late INTEGER,
  p_total_loans INTEGER
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total_payments INTEGER;
  on_time_ratio NUMERIC;
  base_score INTEGER := 100;
BEGIN
  total_payments := p_on_time + p_late;
  
  IF total_payments = 0 THEN
    RETURN 100; -- New client, neutral score
  END IF;
  
  on_time_ratio := p_on_time::NUMERIC / total_payments;
  
  -- Score calculation:
  -- Base 100, -5 for each late payment, +2 for each on-time payment (max 150)
  -- Minimum score is 0
  base_score := 100 + (p_on_time * 2) - (p_late * 10);
  
  -- Bonus for having multiple loans with good history
  IF p_total_loans >= 3 AND on_time_ratio >= 0.8 THEN
    base_score := base_score + 10;
  END IF;
  
  -- Clamp between 0 and 150
  RETURN GREATEST(0, LEAST(150, base_score));
END;
$$;