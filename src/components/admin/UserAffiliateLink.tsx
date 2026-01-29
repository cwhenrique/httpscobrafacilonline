import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Link as LinkIcon, Unlink } from 'lucide-react';

interface Affiliate {
  id: string;
  email: string;
  name: string;
  is_active: boolean;
}

interface UserAffiliateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  userName: string | null;
  userEmail: string | null;
  currentAffiliateEmail: string | null;
  onSuccess: () => void;
}

export function UserAffiliateDialog({
  open,
  onOpenChange,
  userId,
  userName,
  userEmail,
  currentAffiliateEmail,
  onSuccess,
}: UserAffiliateDialogProps) {
  const { toast } = useToast();
  const [affiliates, setAffiliates] = useState<Affiliate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedAffiliate, setSelectedAffiliate] = useState<string>(currentAffiliateEmail || 'none');

  useEffect(() => {
    if (open) {
      fetchAffiliates();
      setSelectedAffiliate(currentAffiliateEmail || 'none');
    }
  }, [open, currentAffiliateEmail]);

  const fetchAffiliates = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('affiliates')
        .select('id, email, name, is_active')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setAffiliates(data || []);
    } catch (error) {
      console.error('Error fetching affiliates:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const newAffiliateEmail = selectedAffiliate === 'none' ? null : selectedAffiliate;
      
      const { error } = await supabase
        .from('profiles')
        .update({ affiliate_email: newAffiliateEmail })
        .eq('id', userId);

      if (error) throw error;

      const affiliateName = affiliates.find(a => a.email === newAffiliateEmail)?.name;
      
      toast({
        title: newAffiliateEmail ? 'Afiliado vinculado!' : 'Afiliado desvinculado!',
        description: newAffiliateEmail 
          ? `${userName || userEmail} foi vinculado a ${affiliateName}`
          : `${userName || userEmail} não está mais vinculado a nenhum afiliado`,
      });

      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error updating affiliate link:', error);
      toast({
        title: 'Erro ao vincular afiliado',
        description: error.message || 'Tente novamente',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LinkIcon className="w-5 h-5 text-primary" />
            Vincular Afiliado
          </DialogTitle>
          <DialogDescription>
            Vincule {userName || userEmail} a um afiliado para que os links de checkout sejam direcionados automaticamente.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {loading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Afiliado</label>
                <Select value={selectedAffiliate} onValueChange={setSelectedAffiliate}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um afiliado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">
                      <span className="flex items-center gap-2">
                        <Unlink className="w-4 h-4 text-muted-foreground" />
                        Sem afiliado
                      </span>
                    </SelectItem>
                    {affiliates.map((affiliate) => (
                      <SelectItem key={affiliate.id} value={affiliate.email}>
                        <span className="flex items-center gap-2">
                          <LinkIcon className="w-4 h-4 text-primary" />
                          {affiliate.name} ({affiliate.email})
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {currentAffiliateEmail && (
                <p className="text-sm text-muted-foreground">
                  Atualmente vinculado a: <strong>{currentAffiliateEmail}</strong>
                </p>
              )}

              {affiliates.length === 0 && (
                <p className="text-sm text-amber-500">
                  Nenhum afiliado ativo cadastrado. Cadastre afiliados na aba "Afiliados" primeiro.
                </p>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving || loading}>
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Salvando...
              </>
            ) : (
              'Salvar'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
