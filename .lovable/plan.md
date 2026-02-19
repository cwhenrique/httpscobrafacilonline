

# Liberar Relatorios Automaticos para clau_pogian@hotmail.com

## O que sera feito

Atualizar o campo `relatorio_ativo` para `true` no perfil do usuario Henrique (clau_pogian@hotmail.com), ativando a funcionalidade de relatorios diarios via API oficial do WhatsApp.

## Detalhes tecnicos

Executar uma migration SQL simples:

```text
UPDATE profiles 
SET relatorio_ativo = true 
WHERE email = 'clau_pogian@hotmail.com';
```

Isso fara com que a pagina de Relatorios Auto mostre o status "Ativo" e permita configurar horario e categorias de relatorio.

