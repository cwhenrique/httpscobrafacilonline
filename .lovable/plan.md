

# Remover Acesso ao Relatorio - clau_pogian@hotmail.com

## Objetivo

Desativar o envio de relatorios diarios para a conta `clau_pogian@hotmail.com`.

## Como funciona hoje

O campo `relatorio_ativo` na tabela `profiles` controla se o usuario recebe relatorios. Atualmente esta como `true` para esta conta.

## Alteracao

Executar um UPDATE simples no banco de dados para setar `relatorio_ativo = false` para o usuario com email `clau_pogian@hotmail.com` (ID: `f83121f6-8ffe-4945-a35e-aaf389974162`).

Isso fara com que a funcao `daily-summary` ignore este usuario, pois a query filtra por `relatorio_ativo.eq.true`.

## Detalhes Tecnicos

- Nenhuma alteracao de codigo necessaria
- Apenas um UPDATE no banco: `UPDATE profiles SET relatorio_ativo = false WHERE id = 'f83121f6-...'`
- O usuario ainda tera o WhatsApp conectado (`whatsapp_instance_id` permanece), apenas nao recebera mais o relatorio automatico

