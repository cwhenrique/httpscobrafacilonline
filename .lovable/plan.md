
# Ativar Relatorio para cw@gmail.com

## Situacao Atual
- Usuario: `cw@gmail.com` (ID: `5dfd21d1-2b58-4e28-ae94-5a5d6c03128b`)
- `relatorio_ativo`: **false** (desativado)

## Alteracao Necessaria
Executar um UPDATE no banco de dados para ativar a flag `relatorio_ativo = true` para esse usuario.

```sql
UPDATE profiles 
SET relatorio_ativo = true 
WHERE email = 'cw@gmail.com';
```

## Detalhes Tecnicos
Sera utilizada a ferramenta de migracao do banco para executar o UPDATE, ja que operacoes de escrita nao podem ser feitas pela query de leitura. A migracao vai simplesmente setar o campo `relatorio_ativo` para `true` no perfil do usuario `cw@gmail.com`.
