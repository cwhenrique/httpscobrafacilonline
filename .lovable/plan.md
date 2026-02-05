
# Plano: Corrigir Datas de Vencimento das Assinaturas IPTV

## Problema Identificado

O usuário `comunidade12tv@gmail.com` cadastrou assinaturas com vencimentos nos dias **10, 15, 20 e 30**, mas o campo `due_day` ficou como **10** para todas. Quando as cobranças de fevereiro foram geradas automaticamente, o sistema usou o `due_day=10` da assinatura ao invés da data correta.

### Dados afetados:

| Dia Original | Clientes Afetados |
|-------------|------------------|
| **15** | Lucas |
| **20** | Diego 100, Douglas, Eduardo, Fabiano batista, Fabio, Fernando, Luana, Nego, pastor marcos, Paulo cesar, Rafaela, Rodrigo, SANDRA, Sandra do churrasquinho, thayna, Wanderley |
| **30** | Carlinhos, carmim rocha, Jeferson, leicimar Teixeira, lorrane da silva, Marli, Rosana monte, Rose, Rubes |

## Solução

### 1) Atualizar o `due_day` das assinaturas (`monthly_fees`)

Corrigir o campo para refletir o vencimento real:

```sql
-- Atualizar due_day para 15
UPDATE monthly_fees SET due_day = 15 WHERE id = '857ab2ef-5e1e-491f-baa9-78b26e9a5a48';

-- Atualizar due_day para 20 (16 assinaturas)
UPDATE monthly_fees SET due_day = 20 WHERE id IN (
  '860be608-9415-4e84-add2-158be9762153', 'fb48551d-4246-4dd2-b3de-c4fa5ae21fb1',
  '41386d75-40f1-475b-832f-dcc9b3d6b447', '07e1018a-98a9-46db-bb81-5a4ea3e2a3b9',
  '7b42acfc-a88a-499a-8612-a1e014b279c2', '90d40c09-07f1-40e1-97aa-6c0a1ec1d00d',
  'a75ab123-bcc6-452f-a231-99ca54ec55bb', '119f8c39-6d5f-4bd9-b2d7-57c4c53af83a',
  '7c317c70-67f2-4b7e-a3a5-8bf3310ae047', '1b65645f-af92-41c3-819d-9d47fa2a9332',
  '3002f29e-a0e3-4cf5-b554-5b593c726dd8', '01a0608e-bde0-4150-a596-8217fe953669',
  '4cb2ef84-40b6-4515-ab9f-355a11216c74', '6e32c5db-9223-4fc8-b178-cd87c36ef392',
  '4fe0f0a2-118b-4e6d-8246-f72263013f4b', '93b8f347-c66a-47be-9daa-93f73c2d2ea9'
);

-- Atualizar due_day para 30 (9 assinaturas)
UPDATE monthly_fees SET due_day = 30 WHERE id IN (
  'eac8baf2-8cfc-418b-b1e5-e4b731f226c9', 'cfd3c0e3-4837-4207-9fba-7ea912ae4d2e',
  '61641cb1-2ee5-486e-9398-78765a3c1c0b', '97ac0368-64d9-4927-b999-c18a653e02d1',
  '7410e51e-afb8-4ed1-8c28-cd954b32c792', 'b3cd6cdc-3869-49d6-9d0b-64b7a10abdaa',
  '838210c1-bcfb-4c31-a4b3-522d9cb7569b', 'a1a12c65-4fc8-4ccc-a64c-8b5274e3ac7c',
  '872f97e1-f578-490a-a94b-85706400c5da'
);
```

### 2) Corrigir o `due_date` das cobranças de fevereiro (`monthly_fee_payments`)

As cobranças de fevereiro foram geradas com dia 10, mas deveriam seguir o vencimento correto:

```sql
-- Atualizar due_date para dia 15
UPDATE monthly_fee_payments 
SET due_date = '2026-02-15' 
WHERE monthly_fee_id = '857ab2ef-5e1e-491f-baa9-78b26e9a5a48'
  AND reference_month = '2026-02-01';

-- Atualizar due_date para dia 20
UPDATE monthly_fee_payments 
SET due_date = '2026-02-20' 
WHERE monthly_fee_id IN (
  '860be608-9415-4e84-add2-158be9762153', 'fb48551d-4246-4dd2-b3de-c4fa5ae21fb1',
  '41386d75-40f1-475b-832f-dcc9b3d6b447', '07e1018a-98a9-46db-bb81-5a4ea3e2a3b9',
  '7b42acfc-a88a-499a-8612-a1e014b279c2', '90d40c09-07f1-40e1-97aa-6c0a1ec1d00d',
  'a75ab123-bcc6-452f-a231-99ca54ec55bb', '119f8c39-6d5f-4bd9-b2d7-57c4c53af83a',
  '7c317c70-67f2-4b7e-a3a5-8bf3310ae047', '1b65645f-af92-41c3-819d-9d47fa2a9332',
  '3002f29e-a0e3-4cf5-b554-5b593c726dd8', '01a0608e-bde0-4150-a596-8217fe953669',
  '4cb2ef84-40b6-4515-ab9f-355a11216c74', '6e32c5db-9223-4fc8-b178-cd87c36ef392',
  '4fe0f0a2-118b-4e6d-8246-f72263013f4b', '93b8f347-c66a-47be-9daa-93f73c2d2ea9'
) AND reference_month = '2026-02-01';

-- Atualizar due_date para dia 28 (fevereiro não tem dia 30)
UPDATE monthly_fee_payments 
SET due_date = '2026-02-28' 
WHERE monthly_fee_id IN (
  'eac8baf2-8cfc-418b-b1e5-e4b731f226c9', 'cfd3c0e3-4837-4207-9fba-7ea912ae4d2e',
  '61641cb1-2ee5-486e-9398-78765a3c1c0b', '97ac0368-64d9-4927-b999-c18a653e02d1',
  '7410e51e-afb8-4ed1-8c28-cd954b32c792', 'b3cd6cdc-3869-49d6-9d0b-64b7a10abdaa',
  '838210c1-bcfb-4c31-a4b3-522d9cb7569b', 'a1a12c65-4fc8-4ccc-a64c-8b5274e3ac7c',
  '872f97e1-f578-490a-a94b-85706400c5da'
) AND reference_month = '2026-02-01';
```

## Impacto

| Antes | Depois |
|-------|--------|
| Todos com vencimento dia 10/02 | Vencimentos em 10, 15, 20 ou 28/02 conforme cadastro original |
| Próximas renovações cairiam no dia 10 | Próximas renovações usarão o `due_day` correto (15, 20 ou 30) |

## Observação Técnica

Para assinaturas com `due_day = 30`, em meses mais curtos (fevereiro, abril, junho, setembro, novembro), o sistema deve ajustar automaticamente para o último dia do mês. Isso já é tratado pela função `setDate` do date-fns.
