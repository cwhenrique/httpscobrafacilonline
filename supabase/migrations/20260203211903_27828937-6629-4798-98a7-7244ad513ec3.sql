-- Add columns for third-party loans
ALTER TABLE loans ADD COLUMN is_third_party boolean DEFAULT false;
ALTER TABLE loans ADD COLUMN third_party_name text;