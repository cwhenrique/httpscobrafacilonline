import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { MessageCircle, Settings, X } from 'lucide-react';

interface WhatsAppNotConnectedDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function WhatsAppNotConnectedDialog({
  open,
  onOpenChange,
}: WhatsAppNotConnectedDialogProps) {
  const navigate = useNavigate();

  const handleGoToSettings = () => {
    onOpenChange(false);
    navigate('/settings');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-yellow-500/10">
            <MessageCircle className="h-8 w-8 text-yellow-500" />
          </div>
          <DialogTitle className="text-xl text-center">
            WhatsApp Não Conectado
          </DialogTitle>
          <DialogDescription className="text-center text-base mt-2">
            Para enviar comprovantes para você mesmo, é necessário conectar seu WhatsApp nas configurações.
          </DialogDescription>
        </DialogHeader>

        <div className="bg-muted/50 rounded-lg p-4 mt-4">
          <p className="text-sm text-muted-foreground text-center">
            Ao conectar seu WhatsApp, você poderá enviar mensagens do seu próprio número para você mesmo, mantendo todos os comprovantes organizados.
          </p>
        </div>

        <div className="flex flex-col gap-3 mt-6">
          <Button onClick={handleGoToSettings} className="w-full gap-2">
            <Settings className="w-4 h-4" />
            Ir para Configurações
          </Button>
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="w-full gap-2">
            <X className="w-4 h-4" />
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
