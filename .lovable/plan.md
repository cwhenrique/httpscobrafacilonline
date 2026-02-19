

# Adicionar Checkbox de Seleção ao Lado do Telefone

## O que sera feito

Adicionar um checkbox ao lado da coluna "Telefone" na tabela "Todos os Usuarios" da pagina de administracao, permitindo selecionar e desmarcar usuarios individualmente. Tambem sera adicionado um checkbox no cabecalho para selecionar/desmarcar todos de uma vez.

## Mudancas

### Arquivo: `src/pages/CreateTrialUser.tsx`

1. **Novo estado** para armazenar os IDs dos usuarios selecionados:
   - `const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set())`

2. **Funcoes auxiliares**:
   - `toggleUserSelection(userId)` - marca/desmarca um usuario
   - `toggleAllSelection()` - seleciona ou desmarca todos os usuarios da pagina atual

3. **Coluna nova no cabecalho da tabela** (antes de "Nome"):
   - Checkbox com estado "checked" quando todos da pagina estao selecionados, "indeterminate" quando alguns estao selecionados

4. **Checkbox em cada linha** (antes do Nome):
   - Checkbox vinculado ao estado de selecao do usuario correspondente

5. **Contador de selecionados** exibido acima da tabela quando houver selecao (ex: "3 usuarios selecionados")

### Componente utilizado
- `Checkbox` de `@/components/ui/checkbox` (ja existe no projeto)

### Detalhes tecnicos

A coluna do checkbox sera adicionada como primeira coluna da tabela, nao ao lado do telefone diretamente, pois e o padrao mais intuitivo para tabelas com selecao. O checkbox ficara visualmente proximo ao inicio de cada linha.

```text
+---+--------+-------+----------+-------+...
| v | Nome   | Email | Telefone | Senha |...
+---+--------+-------+----------+-------+...
| v | Joao   | j@... | 55...    | ***   |...
| _ | Maria  | m@... | 55...    | ***   |...
+---+--------+-------+----------+-------+...
```

Se preferir que o checkbox fique literalmente dentro da celula do telefone (ao lado do numero), isso tambem pode ser feito.
