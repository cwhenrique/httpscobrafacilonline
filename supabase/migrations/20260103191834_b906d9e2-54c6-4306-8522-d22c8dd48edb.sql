-- Update max_employees default to 0 (each payment adds +1)
ALTER TABLE public.profiles 
ALTER COLUMN max_employees SET DEFAULT 0;

-- Update existing users who haven't enabled the feature to have 0 max_employees
UPDATE public.profiles 
SET max_employees = 0 
WHERE employees_feature_enabled = false OR employees_feature_enabled IS NULL;