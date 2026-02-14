import { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MessageCircle, Loader2, Eye, User, Copy, Check, FileText, FileCheck, ExternalLink, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

interface MessagePreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  simpleMessage: string;
  completeMessage: string;
  recipientName: string;
  recipientType: 'self' | 'client';
  onConfirm: (editedMessage: string) => void;
  isSending?: boolean;
  mode?: 'send' | 'copy' | 'whatsapp_link';
  clientPhone?: string;
  showWhatsAppLinkFallback?: boolean;
}

export default function MessagePreviewDialog({
  open,
  onOpenChange,
  simpleMessage,
  completeMessage,
  recipientName,
  recipientType,
  onConfirm,
  isSending = false,
  mode = 'send',
  clientPhone,
  showWhatsAppLinkFallback = false,
}: MessagePreviewDialogProps) {
  const [messageType, setMessageType] = useState<'complete' | 'simple'>('complete');
  const [editedMessage, setEditedMessage] = useState(completeMessage);
  const [copied, setCopied] = useState(false);

  // Refs para armazenar as mensagens capturadas na abertura do dialog
  const capturedCompleteRef = useRef(completeMessage);
  const capturedSimpleRef = useRef(simpleMessage);

  // Captura as mensagens e reseta estado quando o dialog abre
  useEffect(() => {
    if (open) {
      capturedCompleteRef.current = completeMessage;
      capturedSimpleRef.current = simpleMessage;
      setMessageType('complete');
      setEditedMessage(completeMessage);
      setCopied(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Atualiza mensagem quando troca de aba (usa as mensagens capturadas)
  useEffect(() => {
    if (!open) return;
    
    if (messageType === 'complete') {
      setEditedMessage(capturedCompleteRef.current);
    } else {
      setEditedMessage(capturedSimpleRef.current);
    }
  }, [messageType, open]);

  const handleConfirm = () => {
    onConfirm(editedMessage);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(editedMessage);
      setCopied(true);
      toast.success('Texto copiado! Cole no WhatsApp');
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error('Erro ao copiar texto');
    }
  };

  const cleanPhone = clientPhone?.replace(/\D/g, '') || '';
  const phoneHasDDD = cleanPhone.length >= 10;

  const handleOpenWhatsApp = () => {
    if (!clientPhone || !phoneHasDDD) return;
    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(editedMessage)}`;
    window.open(url, '_blank');
    toast.success('WhatsApp aberto! Envie a mensagem.');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-lg sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="w-5 h-5 text-primary" />
            Visualizar Mensagem
          </DialogTitle>
          <DialogDescription className="flex items-center gap-2">
            <User className="w-4 h-4" />
            <span>
              {recipientType === 'self' ? 'Para: ' : 'Cliente: '}
              <strong>{recipientName}</strong>
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {/* Tabs para alternar entre Completa e Simples */}
          <Tabs value={messageType} onValueChange={(v) => setMessageType(v as 'complete' | 'simple')}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="complete" className="flex items-center gap-2">
                <FileCheck className="w-4 h-4" />
                Completa
              </TabsTrigger>
              <TabsTrigger value="simple" className="flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Simples
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <Textarea
            value={editedMessage}
            onChange={(e) => setEditedMessage(e.target.value)}
            className="min-h-[300px] font-mono text-sm resize-y"
            placeholder="Digite a mensagem..."
          />
          <p className="text-xs text-muted-foreground">
            💡 Você pode editar a mensagem antes de {mode === 'copy' ? 'copiar' : 'enviar'}
          </p>
        </div>

        <DialogFooter className="gap-2 flex-col sm:flex-row">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSending}
          >
            Cancelar
          </Button>
          {mode === 'whatsapp_link' ? (
            <>
              {clientPhone && !phoneHasDDD && (
                <div className="w-full flex items-start gap-2 p-3 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 text-sm">
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>
                    O telefone deste cliente não possui DDD. Edite o cadastro do cliente e adicione o DDD (ex: 11) para enviar mensagens pelo WhatsApp.
                  </span>
                </div>
              )}
              <Button
                onClick={handleCopy}
                disabled={!editedMessage.trim()}
                variant="outline"
                className="bg-amber-500 hover:bg-amber-600 text-white border-amber-500"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 mr-2" />
                    Copiado!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 mr-2" />
                    Copiar Texto
                  </>
                )}
              </Button>
              <Button
                onClick={handleOpenWhatsApp}
                disabled={!editedMessage.trim() || !clientPhone || !phoneHasDDD}
                className="bg-green-600 hover:bg-green-700"
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                Abrir no WhatsApp
              </Button>
            </>
          ) : mode === 'copy' ? (
            <Button
              onClick={handleCopy}
              disabled={!editedMessage.trim()}
              className="bg-amber-500 hover:bg-amber-600"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  Copiado!
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 mr-2" />
                  Copiar Texto
                </>
              )}
            </Button>
          ) : (
            <>
              {showWhatsAppLinkFallback && clientPhone && (
                <>
                  {!phoneHasDDD && (
                    <div className="w-full flex items-start gap-2 p-3 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 text-sm">
                      <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                      <span>
                        O telefone deste cliente não possui DDD. Edite o cadastro e adicione o DDD para enviar via link.
                      </span>
                    </div>
                  )}
                  <Button
                    onClick={handleOpenWhatsApp}
                    disabled={!editedMessage.trim() || !phoneHasDDD}
                    variant="outline"
                    className="bg-green-600 hover:bg-green-700 text-white border-green-600"
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Via WhatsApp
                  </Button>
                </>
              )}
              <Button
                onClick={handleConfirm}
                disabled={isSending || !editedMessage.trim()}
                className="bg-green-600 hover:bg-green-700"
              >
                {isSending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <MessageCircle className="w-4 h-4 mr-2" />
                    Enviar Mensagem
                  </>
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
