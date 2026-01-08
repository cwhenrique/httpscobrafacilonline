-- Corrigir principal_amount de empréstimos existentes que têm tag [AMORTIZATION]
-- A tag contém: [AMORTIZATION:valor_amortizado:novo_principal:novos_juros:data]
-- Precisamos extrair o "novo_principal" (segundo valor após AMORTIZATION:)

UPDATE loans
SET principal_amount = (
  regexp_match(notes, '\[AMORTIZATION:[0-9.]+:([0-9.]+):[0-9.]+:[0-9-]+\]')
)[1]::numeric
WHERE notes LIKE '%[AMORTIZATION%'
  AND status != 'paid'
  AND (regexp_match(notes, '\[AMORTIZATION:[0-9.]+:([0-9.]+):[0-9.]+:[0-9-]+\]'))[1] IS NOT NULL;