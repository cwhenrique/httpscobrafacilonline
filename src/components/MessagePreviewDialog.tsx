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
import { MessageCircle, Loader2, Eye, User } from 'lucide-react';

interface MessagePreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialMessage: string;
  recipientName: string;
  recipientType: 'self' | 'client';
  onConfirm: (editedMessage: string) => void;
  isSending?: boolean;
}

export default function MessagePreviewDialog({
  open,
  onOpenChange,
  initialMessage,
  recipientName,
  recipientType,
  onConfirm,
  isSending = false,
}: MessagePreviewDialogProps) {
  const [editedMessage, setEditedMessage] = useState(initialMessage);

  // Reset message when dialog opens with new initial message
  useEffect(() => {
    if (open) {
      setEditedMessage(initialMessage);
    }
  }, [open, initialMessage]);

  const handleConfirm = () => {
    onConfirm(editedMessage);
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
          <Textarea
            value={editedMessage}
            onChange={(e) => setEditedMessage(e.target.value)}
            className="min-h-[300px] font-mono text-sm resize-y"
            placeholder="Digite a mensagem..."
          />
          <p className="text-xs text-muted-foreground">
            💡 Você pode editar a mensagem antes de enviar
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
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
