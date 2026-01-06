import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { MessageCircle, Settings, X, Menu, Plus, QrCode, CheckCircle2 } from 'lucide-react';

interface WhatsAppNotConnectedDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const steps = [
  {
    number: 1,
    icon: Menu,
    title: 'Abra o menu lateral',
    description: 'Clique no ícone de menu no canto superior',
  },
  {
    number: 2,
    icon: Settings,
    title: 'Vá em Configurações',
    description: 'Acesse a área de configurações do sistema',
  },
  {
    number: 3,
    icon: MessageCircle,
    title: 'WhatsApp para Clientes',
    description: 'Role até encontrar essa seção',
  },
  {
    number: 4,
    icon: Plus,
    title: 'Crie uma Nova Instância',
    description: 'Clique no botão "Criar Instância"',
  },
  {
    number: 5,
    icon: QrCode,
    title: 'Escaneie o QR Code',
    description: 'WhatsApp → Aparelhos conectados → Conectar',
  },
  {
    number: 6,
    icon: CheckCircle2,
    title: 'Pronto!',
    description: 'Aguarde a confirmação de conexão',
    isSuccess: true,
  },
];

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
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-yellow-500/10">
            <MessageCircle className="h-8 w-8 text-yellow-500" />
          </div>
          <DialogTitle className="text-xl text-center">
            WhatsApp Não Conectado
          </DialogTitle>
          <DialogDescription className="text-center text-base mt-2">
            Para enviar comprovantes, siga os passos abaixo:
          </DialogDescription>
        </DialogHeader>

        <div className="bg-muted/30 rounded-lg p-4 mt-4 space-y-3">
          {steps.map((step) => (
            <div key={step.number} className="flex items-start gap-3">
              <div 
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
                  step.isSuccess 
                    ? 'bg-green-500/20 text-green-500' 
                    : 'bg-primary/10 text-primary'
                }`}
              >
                {step.isSuccess ? <CheckCircle2 className="h-4 w-4" /> : step.number}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <step.icon className={`h-4 w-4 shrink-0 ${step.isSuccess ? 'text-green-500' : 'text-muted-foreground'}`} />
                  <span className={`font-medium text-sm ${step.isSuccess ? 'text-green-500' : ''}`}>
                    {step.title}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {step.description}
                </p>
              </div>
            </div>
          ))}
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
