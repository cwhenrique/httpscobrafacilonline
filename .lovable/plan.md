# Plano: Nome/Link do Servidor por Assinatura - IMPLEMENTADO ✓

## Objetivo

Mover o nome e link do servidor de uma configuração global para ser por assinatura:
- **Cada assinatura** terá seu próprio servidor (nome + link do painel)
- **Custo do servidor** permanece global (por usuário) para cálculo de lucro

---

## Alterações Realizadas

### 1. ✅ Banco de Dados - Campos adicionados na tabela `monthly_fees`

```sql
ALTER TABLE monthly_fees
ADD COLUMN iptv_server_name TEXT,
ADD COLUMN iptv_server_url TEXT;
```

### 2. ✅ Hook `useMonthlyFees.ts` - Interfaces atualizadas

Campos adicionados: `iptv_server_name`, `iptv_server_url` nas interfaces MonthlyFee, CreateMonthlyFeeData, UpdateMonthlyFeeData.

### 3. ✅ `IPTVSubscriptionForm.tsx` - Campos de servidor no formulário

Seção "Servidor IPTV" adicionada com campos:
- Nome do Servidor
- Link do Painel (com botão para abrir)

### 4. ✅ `ProductSales.tsx` - Servidor no card e modal de edição

- Card expandido mostra o servidor e link para abrir o painel
- Modal de edição inclui campos para alterar servidor

### 5. ✅ `IPTVServerConfig.tsx` - Simplificado para apenas Custo

Componente agora gerencia apenas o custo mensal do servidor para cálculo de lucro.

---

## Resultado Final

**No formulário de Nova Assinatura:**
- Campo "Nome do Servidor" (Ex: MegaTV)
- Campo "Link do Painel" com botão para abrir

**No card de cada assinatura:**
- Nome do servidor visível
- Link para abrir o painel do servidor

**Na configuração global (botão Custo):**
- Apenas o custo mensal do servidor para cálculo de lucro
