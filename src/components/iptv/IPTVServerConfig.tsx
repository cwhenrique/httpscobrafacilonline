import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { DollarSign } from 'lucide-react';
import { useProfile } from '@/hooks/useProfile';
import { toast } from 'sonner';

export default function IPTVServerConfig() {
  const { profile, updateProfile } = useProfile();
  const [isOpen, setIsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [serverCost, setServerCost] = useState(0);

  // Sync form data when profile loads or dialog opens
  useEffect(() => {
    if (profile && isOpen) {
      setServerCost(profile.iptv_server_cost || 0);
    }
  }, [profile, isOpen]);

  const handleSave = async () => {
    setIsSaving(true);
    const { error } = await updateProfile({ iptv_server_cost: serverCost });
    setIsSaving(false);
    
    if (error) {
      toast.error('Erro ao salvar configuração');
    } else {
      toast.success('Custo do servidor salvo!');
      setIsOpen(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <DollarSign className="w-4 h-4" />
          Custo
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Custo do Servidor IPTV</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Custo Mensal do Servidor (R$)</Label>
            <Input 
              type="number"
              min="0"
              step="0.01"
              value={serverCost || ''}
              onChange={(e) => setServerCost(parseFloat(e.target.value) || 0)}
              placeholder="150.00"
            />
            <p className="text-xs text-muted-foreground">
              Valor total que você paga mensalmente pelo servidor. Usado para calcular seu lucro líquido.
            </p>
          </div>
          <Button onClick={handleSave} className="w-full" disabled={isSaving}>
            {isSaving ? 'Salvando...' : 'Salvar'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
