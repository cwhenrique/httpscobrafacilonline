import { useState, useEffect } from 'react';
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
import { MessageCircle, Loader2, Eye, User, Copy, Check, FileText, FileCheck } from 'lucide-react';
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
  mode?: 'send' | 'copy';
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
}: MessagePreviewDialogProps) {
  const [messageType, setMessageType] = useState<'complete' | 'simple'>('complete');
  const [editedMessage, setEditedMessage] = useState(completeMessage);
  const [copied, setCopied] = useState(false);

  // Reset message when dialog opens or message type changes
  useEffect(() => {
    if (open) {
      setMessageType('complete');
      setEditedMessage(completeMessage);
      setCopied(false);
    }
  }, [open, completeMessage]);

  // Update message when switching tabs
  useEffect(() => {
    if (messageType === 'complete') {
      setEditedMessage(completeMessage);
    } else {
      setEditedMessage(simpleMessage);
    }
  }, [messageType, completeMessage, simpleMessage]);

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
          {mode === 'copy' ? (
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
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
