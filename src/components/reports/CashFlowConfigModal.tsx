import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Wallet, RotateCcw } from 'lucide-react';
import { formatCurrency } from '@/lib/calculations';

interface CashFlowConfigModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentBalance: number;
  onSave: (value: number) => void;
}

export function CashFlowConfigModal({
  open,
  onOpenChange,
  currentBalance,
  onSave,
}: CashFlowConfigModalProps) {
  const [value, setValue] = useState('');

  // Atualiza o valor quando o modal abre
  useEffect(() => {
    if (open) {
      setValue(currentBalance > 0 ? (currentBalance * 100).toString() : '');
    }
  }, [open, currentBalance]);

  // Formata o input como moeda
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Remove tudo exceto números
    const numericValue = e.target.value.replace(/\D/g, '');
    setValue(numericValue);
  };

  // Formata para exibição (divide por 100 para centavos)
  const displayValue = value
    ? (parseInt(value) / 100).toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL',
      })
    : '';

  const handleReset = () => {
    setValue('');
  };

  const handleSave = () => {
    const numericValue = value ? parseInt(value) / 100 : 0;
    onSave(numericValue);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="w-5 h-5 text-primary" />
            Configurar Caixa Extra
          </DialogTitle>
          <DialogDescription>
            Defina o valor de dinheiro disponível que ainda não foi emprestado.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="balance">Valor do Caixa Extra</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                R$
              </span>
              <Input
                id="balance"
                type="text"
                inputMode="numeric"
                placeholder="0,00"
                value={displayValue.replace('R$', '').trim()}
                onChange={handleInputChange}
                className="pl-10 text-lg font-medium"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Dinheiro disponível que ainda não foi emprestado.
            </p>
          </div>

          {/* Botão de Reset */}
          {value && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleReset}
              className="text-muted-foreground hover:text-foreground"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Remover caixa extra
            </Button>
          )}

          <div className="bg-muted/50 rounded-lg p-3 space-y-2">
            <p className="text-sm font-medium">Como funciona:</p>
            <ul className="text-xs text-muted-foreground space-y-1">
              <li>💰 <strong>Caixa extra:</strong> Dinheiro que você tem mas ainda não emprestou</li>
              <li>📤 <strong>Saídas:</strong> Empréstimos concedidos no período</li>
              <li>📥 <strong>Entradas:</strong> Pagamentos recebidos no período</li>
              <li>📊 <strong>Resultado:</strong> Caixa Extra + Entradas - Saídas</li>
            </ul>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave}>
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
