import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Server, ExternalLink } from 'lucide-react';
import { useProfile } from '@/hooks/useProfile';
import { toast } from 'sonner';

export default function IPTVServerConfig() {
  const { profile, updateProfile } = useProfile();
  const [isOpen, setIsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    iptv_server_name: '',
    iptv_server_url: '',
    iptv_server_cost: 0,
  });

  // Sync form data when profile loads or dialog opens
  useEffect(() => {
    if (profile && isOpen) {
      setFormData({
        iptv_server_name: profile.iptv_server_name || '',
        iptv_server_url: profile.iptv_server_url || '',
        iptv_server_cost: profile.iptv_server_cost || 0,
      });
    }
  }, [profile, isOpen]);

  const handleSave = async () => {
    setIsSaving(true);
    const { error } = await updateProfile(formData);
    setIsSaving(false);
    
    if (error) {
      toast.error('Erro ao salvar configurações');
    } else {
      toast.success('Configurações do servidor salvas!');
      setIsOpen(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Server className="w-4 h-4" />
          Servidor
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Configurações do Servidor IPTV</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Nome do Servidor</Label>
            <Input 
              value={formData.iptv_server_name}
              onChange={(e) => setFormData({...formData, iptv_server_name: e.target.value})}
              placeholder="Ex: IPTVBrasil, MegaTV..."
            />
          </div>
          <div className="space-y-2">
            <Label>Link do Painel</Label>
            <div className="flex gap-2">
              <Input 
                value={formData.iptv_server_url}
                onChange={(e) => setFormData({...formData, iptv_server_url: e.target.value})}
                placeholder="https://painel.servidor.com"
              />
              {formData.iptv_server_url && (
                <Button variant="outline" size="icon" asChild>
                  <a href={formData.iptv_server_url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </Button>
              )}
            </div>
          </div>
          <div className="space-y-2">
            <Label>Custo Mensal do Servidor (R$)</Label>
            <Input 
              type="number"
              min="0"
              step="0.01"
              value={formData.iptv_server_cost || ''}
              onChange={(e) => setFormData({...formData, iptv_server_cost: parseFloat(e.target.value) || 0})}
              placeholder="150.00"
            />
            <p className="text-xs text-muted-foreground">
              Usado para calcular seu lucro líquido
            </p>
          </div>
          <Button onClick={handleSave} className="w-full" disabled={isSaving}>
            {isSaving ? 'Salvando...' : 'Salvar Configurações'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
