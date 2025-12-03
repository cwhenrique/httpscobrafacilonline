import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2, User, Phone, Building, AlertCircle } from 'lucide-react';
import { useProfile } from '@/hooks/useProfile';

interface ProfileSetupModalProps {
  open: boolean;
}

export function ProfileSetupModal({ open }: ProfileSetupModalProps) {
  const { profile, updateProfile } = useProfile();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    full_name: profile?.full_name || '',
    phone: profile?.phone || '',
    company_name: profile?.company_name || '',
  });
  const [errors, setErrors] = useState<{ full_name?: string; phone?: string }>({});

  const formatPhone = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 2) return numbers;
    if (numbers.length <= 7) return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
    if (numbers.length <= 11) return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7)}`;
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`;
  };

  const validateForm = () => {
    const newErrors: { full_name?: string; phone?: string } = {};
    
    if (!formData.full_name.trim()) {
      newErrors.full_name = 'Nome é obrigatório';
    }
    
    const phoneNumbers = formData.phone.replace(/\D/g, '');
    if (!phoneNumbers) {
      newErrors.phone = 'Telefone é obrigatório';
    } else if (phoneNumbers.length < 10 || phoneNumbers.length > 11) {
      newErrors.phone = 'Telefone inválido (10 ou 11 dígitos)';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setLoading(true);
    const { error } = await updateProfile({
      full_name: formData.full_name.trim(),
      phone: formData.phone.replace(/\D/g, ''),
      company_name: formData.company_name.trim() || null,
    });

    if (error) {
      toast.error('Erro ao salvar perfil');
    } else {
      toast.success('Perfil configurado com sucesso!');
    }
    setLoading(false);
  };

  return (
    <Dialog open={open}>
      <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-amber-500" />
            Configure seu Perfil
          </DialogTitle>
          <DialogDescription>
            Para utilizar o CobraFácil, preencha as informações abaixo. Seu telefone será usado para receber notificações de cobranças.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <User className="w-4 h-4" />
              Nome Completo <span className="text-destructive">*</span>
            </Label>
            <Input
              value={formData.full_name}
              onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
              placeholder="Seu nome completo"
              className={errors.full_name ? 'border-destructive' : ''}
            />
            {errors.full_name && (
              <p className="text-sm text-destructive">{errors.full_name}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Phone className="w-4 h-4" />
              WhatsApp <span className="text-destructive">*</span>
            </Label>
            <Input
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: formatPhone(e.target.value) })}
              placeholder="(00) 00000-0000"
              className={errors.phone ? 'border-destructive' : ''}
            />
            {errors.phone && (
              <p className="text-sm text-destructive">{errors.phone}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Você receberá lembretes de cobranças neste número
            </p>
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Building className="w-4 h-4" />
              Nome da Empresa <span className="text-muted-foreground text-xs">(opcional)</span>
            </Label>
            <Input
              value={formData.company_name}
              onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
              placeholder="Minha Empresa Ltda"
            />
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Salvando...
              </>
            ) : (
              'Começar a Usar'
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
