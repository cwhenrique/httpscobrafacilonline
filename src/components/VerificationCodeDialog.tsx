import { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, ShieldCheck, Clock, RefreshCw, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface VerificationCodeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pendingUpdates: Record<string, unknown>;
  fieldDisplayName: string;
  onSuccess: () => void;
}

export default function VerificationCodeDialog({
  open,
  onOpenChange,
  pendingUpdates,
  fieldDisplayName,
  onSuccess,
}: VerificationCodeDialogProps) {
  const [step, setStep] = useState<'sending' | 'input' | 'verifying' | 'success' | 'error'>('sending');
  const [code, setCode] = useState('');
  const [verificationId, setVerificationId] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [timeLeft, setTimeLeft] = useState(300); // 5 minutes
  const [resendCooldown, setResendCooldown] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [whatsappError, setWhatsappError] = useState<string | null>(null);

  // Request verification code
  const requestCode = useCallback(async () => {
    setStep('sending');
    setCode('');
    setErrorMessage(null);
    setWhatsappError(null);

    try {
      const { data, error } = await supabase.functions.invoke('request-verification-code', {
        body: {
          updates: pendingUpdates,
          userAgent: navigator.userAgent,
        },
      });

      if (error) throw error;

      if (!data?.success) {
        if (data?.error === 'rate_limit_exceeded') {
          setErrorMessage(data.message || 'Muitas tentativas. Aguarde 1 hora.');
          setStep('error');
          return;
        }
        throw new Error(data?.error || 'Erro ao solicitar código');
      }

      if (!data.requiresVerification) {
        // No verification needed, apply updates directly
        onSuccess();
        onOpenChange(false);
        return;
      }

      setVerificationId(data.verificationId);
      setExpiresAt(new Date(data.expiresAt));
      setTimeLeft(300);
      setResendCooldown(60);

      if (!data.whatsappSent) {
        setWhatsappError(data.whatsappError || 'WhatsApp não conectado');
      }

      setStep('input');
    } catch (err: unknown) {
      console.error('Error requesting code:', err);
      setErrorMessage(err instanceof Error ? err.message : 'Erro ao solicitar código');
      setStep('error');
    }
  }, [pendingUpdates, onSuccess, onOpenChange]);

  // Verify code
  const verifyCode = async () => {
    if (code.length !== 6 || !verificationId) return;

    setStep('verifying');
    setErrorMessage(null);

    try {
      const { data, error } = await supabase.functions.invoke('verify-and-update-profile', {
        body: {
          verificationId,
          code,
          userAgent: navigator.userAgent,
        },
      });

      if (error) throw error;

      if (!data?.success) {
        setErrorMessage(data?.error || 'Código inválido');
        setStep('input');
        setCode('');
        return;
      }

      setStep('success');
      toast.success('Dados atualizados com sucesso!');
      
      // Close after showing success
      setTimeout(() => {
        onSuccess();
        onOpenChange(false);
      }, 1500);
    } catch (err: unknown) {
      console.error('Error verifying code:', err);
      setErrorMessage(err instanceof Error ? err.message : 'Erro ao verificar código');
      setStep('input');
      setCode('');
    }
  };

  // Timer countdown
  useEffect(() => {
    if (!open || step !== 'input') return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          setErrorMessage('Código expirado. Solicite um novo.');
          return 0;
        }
        return prev - 1;
      });

      setResendCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => clearInterval(timer);
  }, [open, step]);

  // Request code on open
  useEffect(() => {
    if (open) {
      requestCode();
    } else {
      // Reset state on close
      setStep('sending');
      setCode('');
      setVerificationId(null);
      setExpiresAt(null);
      setTimeLeft(300);
      setResendCooldown(0);
      setErrorMessage(null);
      setWhatsappError(null);
    }
  }, [open, requestCode]);

  // Format time
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-primary" />
            Verificação de Segurança
          </DialogTitle>
          <DialogDescription>
            Para sua segurança, enviamos um código de 6 dígitos para seu WhatsApp.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Sending state */}
          {step === 'sending' && (
            <div className="flex flex-col items-center gap-4 py-8">
              <Loader2 className="w-12 h-12 text-primary animate-spin" />
              <p className="text-muted-foreground text-center">
                Enviando código para seu WhatsApp...
              </p>
            </div>
          )}

          {/* Input state */}
          {step === 'input' && (
            <div className="flex flex-col items-center gap-6">
              <div className="text-center space-y-2">
                <p className="text-sm text-muted-foreground">
                  Alterando: <span className="font-medium text-foreground">{fieldDisplayName}</span>
                </p>
                <div className="flex items-center justify-center gap-2 text-sm">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <span className={timeLeft <= 60 ? 'text-destructive font-medium' : 'text-muted-foreground'}>
                    Expira em {formatTime(timeLeft)}
                  </span>
                </div>
              </div>

              {whatsappError && (
                <div className="flex items-center gap-2 text-amber-600 bg-amber-50 dark:bg-amber-950/20 p-3 rounded-lg text-sm">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  <span>{whatsappError}</span>
                </div>
              )}

              {errorMessage && (
                <div className="flex items-center gap-2 text-destructive bg-destructive/10 p-3 rounded-lg text-sm">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <InputOTP
                value={code}
                onChange={setCode}
                maxLength={6}
                onComplete={verifyCode}
              >
                <InputOTPGroup>
                  <InputOTPSlot index={0} />
                  <InputOTPSlot index={1} />
                  <InputOTPSlot index={2} />
                  <InputOTPSlot index={3} />
                  <InputOTPSlot index={4} />
                  <InputOTPSlot index={5} />
                </InputOTPGroup>
              </InputOTP>

              <div className="flex flex-col gap-3 w-full">
                <Button
                  onClick={verifyCode}
                  disabled={code.length !== 6 || timeLeft === 0}
                  className="w-full"
                >
                  Verificar Código
                </Button>

                <Button
                  variant="outline"
                  onClick={requestCode}
                  disabled={resendCooldown > 0}
                  className="w-full"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  {resendCooldown > 0
                    ? `Reenviar em ${resendCooldown}s`
                    : 'Reenviar Código'}
                </Button>
              </div>
            </div>
          )}

          {/* Verifying state */}
          {step === 'verifying' && (
            <div className="flex flex-col items-center gap-4 py-8">
              <Loader2 className="w-12 h-12 text-primary animate-spin" />
              <p className="text-muted-foreground text-center">
                Verificando código...
              </p>
            </div>
          )}

          {/* Success state */}
          {step === 'success' && (
            <div className="flex flex-col items-center gap-4 py-8">
              <CheckCircle2 className="w-16 h-16 text-green-500" />
              <p className="text-lg font-medium text-center">
                Verificado com sucesso!
              </p>
              <p className="text-muted-foreground text-center text-sm">
                Seus dados foram atualizados.
              </p>
            </div>
          )}

          {/* Error state */}
          {step === 'error' && (
            <div className="flex flex-col items-center gap-4 py-8">
              <AlertTriangle className="w-16 h-16 text-destructive" />
              <p className="text-lg font-medium text-center text-destructive">
                Erro
              </p>
              <p className="text-muted-foreground text-center text-sm">
                {errorMessage}
              </p>
              <Button onClick={() => onOpenChange(false)} variant="outline">
                Fechar
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
