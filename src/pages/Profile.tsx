import { useEffect, useState, useCallback } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/hooks/useProfile';
import { useWhatsAppAutoReconnect } from '@/hooks/useWhatsAppAutoReconnect';
import { useAffiliateLinks } from '@/hooks/useAffiliateLinks';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { toDataURL as qrToDataURL } from 'qrcode';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import VerificationCodeDialog from '@/components/VerificationCodeDialog';
import { 
  User, 
  Mail, 
  Phone, 
  Building, 
  Calendar, 
  Edit, 
  CheckCircle,
  DollarSign,
  Users,
  TrendingUp,
  Save,
  X,
  Loader2,
  Lock,
  MessageCircle,
  Send,
  KeyRound,
  Eye,
  EyeOff,
  Crown,
  Clock,
  Infinity,
  AlertCircle,
  Link as LinkIcon,
  QrCode,
  Pencil,
  Check,
  ImageIcon,
  Wifi,
  WifiOff,
  RefreshCw,
  Unplug,
  Timer,
  Smartphone,
  Camera,
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import CompanyLogoUpload from '@/components/CompanyLogoUpload';


interface WhatsAppStatus {
  connected: boolean;
  status: string;
  instanceName?: string;
  phoneNumber?: string;
  connectedAt?: string;
  needsNewQR?: boolean;
  waitingForScan?: boolean;
  message?: string;
}

export default function Profile() {
  const { user } = useAuth();
  const { profile, loading, updateProfile, refetch } = useProfile();
  const { links: affiliateLinks, renewalLinks } = useAffiliateLinks();
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const [formData, setFormData] = useState({
    full_name: '',
    phone: '',
    company_name: '',
    payment_link: '',
    pix_key: '',
    pix_key_type: 'cpf',
    pix_pre_message: '',
    billing_signature_name: '',
  });
  const [passwordData, setPasswordData] = useState({
    newPassword: '',
    confirmPassword: '',
  });
  const [changingPassword, setChangingPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [stats, setStats] = useState({
    totalClients: 0,
    totalLoans: 0,
    totalLent: 0,
    totalReceived: 0,
  });
  const [loadingStats, setLoadingStats] = useState(true);
  
  // Estados de edição individual
  const [isEditingPix, setIsEditingPix] = useState(false);
  const [isEditingBillingName, setIsEditingBillingName] = useState(false);
  const [isEditingPaymentLink, setIsEditingPaymentLink] = useState(false);
  const [savingPix, setSavingPix] = useState(false);
  const [savingBillingName, setSavingBillingName] = useState(false);
  const [savingPaymentLink, setSavingPaymentLink] = useState(false);
  const [isRenewalDialogOpen, setIsRenewalDialogOpen] = useState(false);
  
  // Estados para verificação 2FA
  const [verificationDialogOpen, setVerificationDialogOpen] = useState(false);
  const [pendingVerificationUpdates, setPendingVerificationUpdates] = useState<Record<string, unknown>>({});
  const [verificationFieldName, setVerificationFieldName] = useState('');

  // WhatsApp para Clientes states
  const [whatsappStatus, setWhatsappStatus] = useState<WhatsAppStatus | null>(null);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [qrImageSrc, setQrImageSrc] = useState<string | null>(null);
  const [generatingQr, setGeneratingQr] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [sendToClientsEnabled, setSendToClientsEnabled] = useState(false);
  const [qrTimeRemaining, setQrTimeRemaining] = useState(90);
  const [qrExpired, setQrExpired] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [resettingInstance, setResettingInstance] = useState(false);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [pairingPhone, setPairingPhone] = useState('');
  const [requestingPairing, setRequestingPairing] = useState(false);
  

  const pollForQrCode = useCallback(
    async (maxAttempts = 20) => {
      if (!user?.id) return;
      for (let i = 0; i < maxAttempts; i++) {
        try {
          const { data, error } = await supabase.functions.invoke('whatsapp-get-qrcode', {
            body: { userId: user.id, forceReset: false },
          });

          if (!error && (data?.qrCode || data?.code)) {
            setQrCode((data.qrCode ?? data.code) as string);
            setQrTimeRemaining(90);
            return;
          }
        } catch (e) {
          // ignore and retry
        }

        await new Promise((r) => setTimeout(r, 2000));
      }

      toast.error('Não conseguimos obter o QR Code agora. Tente "Gerar Novo QR Code".', {
        duration: 8000,
      });
    },
    [user?.id]
  );

  const handleSelectPlan = (link: string) => {
    window.open(link, '_blank');
    setIsRenewalDialogOpen(false);
  };

  useEffect(() => {
    if (user) {
      fetchStats();
      // ✅ Verificação passiva (sem tentar reconectar) - evita loops de reconexão
      checkWhatsAppStatus(false);
    }
  }, [user]);

  useEffect(() => {
    if (profile) {
      setFormData({
        full_name: profile.full_name || '',
        phone: formatPhone(profile.phone || ''),
        company_name: profile.company_name || '',
        payment_link: profile.payment_link || '',
        pix_key: profile.pix_key || '',
        pix_key_type: profile.pix_key_type || 'cpf',
        pix_pre_message: profile.pix_pre_message || '',
        billing_signature_name: profile.billing_signature_name || '',
      });
      setSendToClientsEnabled(profile.whatsapp_to_clients_enabled || false);
    }
  }, [profile]);

  // Poll for connection status when QR modal is open (works for both QR and pairing code)
  useEffect(() => {
    if (!showQrModal) return;
    // Only poll when we have a QR code OR a pairing code active
    if (!qrCode && !pairingCode) return;
    
    const interval = setInterval(() => {
      checkWhatsAppStatus().then(status => {
        if (status?.connected) {
          setShowQrModal(false);
          setQrCode(null);
          setPairingCode(null);
          setSendToClientsEnabled(true);
          toast.success('WhatsApp conectado com sucesso!');
        }
      });
    }, 3000);

    return () => clearInterval(interval);
  }, [showQrModal, qrCode, pairingCode]);

  const isProbablyBase64PngPayload = (value: string) => {
    // Evolution API pode retornar:
    // - base64 puro (sem prefixo)
    // - data URL
    // - string "code" (conteúdo do QR)
    if (!value) return false;
    if (value.startsWith('data:image/')) return true;
    // Base64 costuma ser longo e não contém caracteres como '@' (comum no "code")
    if (value.includes('@') || value.includes(' ')) return false;
    return value.length > 200 && /^[A-Za-z0-9+/=]+$/.test(value);
  };

  // Build an image src for the QR modal (supports base64 OR Evolution "code")
  useEffect(() => {
    let cancelled = false;

    const build = async () => {
      if (!qrCode) {
        setQrImageSrc(null);
        return;
      }

      // 1) data URL already
      if (qrCode.startsWith('data:')) {
        setQrImageSrc(qrCode);
        return;
      }

      // 2) pure base64 payload
      if (isProbablyBase64PngPayload(qrCode)) {
        setQrImageSrc(`data:image/png;base64,${qrCode}`);
        return;
      }

      // 3) Evolution "code" string -> generate QR image
      try {
        const dataUrl = await qrToDataURL(qrCode, { width: 256, margin: 1 });
        if (!cancelled) setQrImageSrc(dataUrl);
      } catch (e) {
        console.error('Erro ao gerar imagem do QR Code:', e);
        if (!cancelled) setQrImageSrc(null);
      }
    };

    build();
    return () => {
      cancelled = true;
    };
  }, [qrCode]);

  // QR Code expiration timer - 90 seconds
  useEffect(() => {
    if (!qrCode || generatingQr) return;
    
    setQrTimeRemaining(90);
    setQrExpired(false);
    
    const timer = setInterval(() => {
      setQrTimeRemaining(prev => {
        if (prev <= 1) {
          setQrExpired(true);
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    return () => clearInterval(timer);
  }, [qrCode, generatingQr]);

  const checkWhatsAppStatus = useCallback(async (attemptReconnect = false): Promise<WhatsAppStatus | null> => {
    if (!user?.id) return null;
    
    setCheckingStatus(true);
    try {
      const { data, error } = await supabase.functions.invoke('whatsapp-check-status', {
        body: { userId: user.id, attemptReconnect }
      });

      if (error) {
        console.error('Error checking WhatsApp status:', error);
        return null;
      }

      setWhatsappStatus(data);
      
      if (attemptReconnect && data?.reconnected) {
        toast.success('Conexão restaurada automaticamente!');
      }
      
      return data;
    } catch (error) {
      console.error('Error checking status:', error);
      return null;
    } finally {
      setCheckingStatus(false);
    }
  }, [user?.id]);

  // Check if user has a paid plan (computed value for hooks)
  const hasPaidPlan = (() => {
    if (!profile?.subscription_plan) return false;
    const paidPlans = ['monthly', 'quarterly', 'annual', 'lifetime', 'mensal', 'trimestral', 'anual', 'vitalicio'];
    return paidPlans.some(plan => 
      profile.subscription_plan?.toLowerCase().includes(plan)
    );
  })();

  // Helper function for event handlers
  const isPaidPlan = (): boolean => hasPaidPlan;

  // Auto-reconnect WhatsApp every 2 minutes
  useWhatsAppAutoReconnect({
    userId: user?.id,
    instanceId: profile?.whatsapp_instance_id,
    enabled: hasPaidPlan && !!profile?.whatsapp_instance_id,
    intervalMs: 2 * 60 * 1000, // 2 minutes
    onStatusChange: (status) => {
      if (status) {
        setWhatsappStatus(status);
      }
    },
  });

  const handleReconnectWhatsApp = async () => {
    if (!user?.id) return;
    
    if (!isPaidPlan()) {
      toast.error('WhatsApp disponível apenas para planos pagos');
      return;
    }
    
    setReconnecting(true);
    toast.info('Tentando reconectar...');
    
    try {
      const status = await checkWhatsAppStatus(true);
      
      if (status?.connected) {
        toast.success('WhatsApp reconectado com sucesso!');
      } else {
        toast.error('Não foi possível reconectar automaticamente. Tente escanear o QR Code novamente.');
      }
    } catch (error) {
      console.error('Error reconnecting:', error);
      toast.error('Erro ao tentar reconectar');
    } finally {
      setReconnecting(false);
    }
  };

  const handleConnectWhatsApp = async () => {
    if (!user?.id) return;
    
    if (!isPaidPlan()) {
      toast.error('WhatsApp disponível apenas para planos pagos');
      return;
    }
    
    setGeneratingQr(true);
    setShowQrModal(true);
    setQrCode(null);
    setPairingCode(null);
    
    try {
      const { data, error } = await supabase.functions.invoke('whatsapp-create-instance', {
        body: { userId: user.id }
      });

      if (error) {
        console.error('Error from whatsapp-create-instance:', error);
        // Don't show error - just let user use pairing code flow
        return;
      }

      // Handle server offline
      if (data.serverOffline) {
        toast.error('Servidor WhatsApp em manutenção. Tente novamente em 5 minutos.', {
          duration: 8000,
        });
        setShowQrModal(false);
        return;
      }

      if (data.alreadyConnected) {
        toast.success('WhatsApp já está conectado!');
        setShowQrModal(false);
        await checkWhatsAppStatus();
        return;
      }

      if (data.qrCode || data.code) {
        setQrCode((data.qrCode ?? data.code) as string);
        setPairingCode(null);
      }
      // For any other case (usePairingCode, pendingQr, no QR available), 
      // the modal will show the pairing code flow automatically
    } catch (error) {
      console.error('Error connecting WhatsApp:', error);
      // Don't show error toast - pairing code flow is still available
    } finally {
      setGeneratingQr(false);
    }
  };

  const handleRefreshQrCode = async (forceReset = false) => {
    if (!user?.id) return;
    
    if (!isPaidPlan()) {
      toast.error('WhatsApp disponível apenas para planos pagos');
      return;
    }
    
    setGeneratingQr(true);
    setQrExpired(false);
    
    try {
      const { data, error } = await supabase.functions.invoke('whatsapp-get-qrcode', {
        body: { userId: user.id, forceReset }
      });

      if (error) {
        toast.error('Erro ao atualizar QR Code');
        return;
      }

      if (data.alreadyConnected) {
        toast.success('WhatsApp já está conectado!');
        setShowQrModal(false);
        await checkWhatsAppStatus();
        return;
      }

      if (data.qrCode || data.code) {
        setQrCode((data.qrCode ?? data.code) as string);
        setQrTimeRemaining(90);
      } else {
        toast.error(data.error || 'Não foi possível gerar o QR Code');
      }
    } catch (error) {
      console.error('Error refreshing QR:', error);
      toast.error('Erro ao atualizar QR Code');
    } finally {
      setGeneratingQr(false);
    }
  };

  const handleRequestPairingCode = async () => {
    if (!user?.id || !pairingPhone.trim()) {
      toast.error('Digite seu número de WhatsApp com DDD (ex: 5511999999999)');
      return;
    }
    
    setRequestingPairing(true);
    try {
      const { data, error } = await supabase.functions.invoke('whatsapp-get-pairing-code', {
        body: { userId: user.id, phoneNumber: pairingPhone.replace(/\D/g, '') }
      });

      if (error) {
        toast.error('Erro ao obter código de pareamento');
        return;
      }

      if (data?.alreadyConnected) {
        toast.success('WhatsApp já está conectado!');
        setShowQrModal(false);
        setPairingCode(null);
        await checkWhatsAppStatus();
        return;
      }

      if (data?.pairingCode) {
        setPairingCode(data.pairingCode);
        toast.success('Código gerado! Digite-o no seu WhatsApp.');
      } else {
        toast.error(data?.error || 'Não foi possível gerar o código. Tente novamente.');
      }
    } catch (error) {
      console.error('Error getting pairing code:', error);
      toast.error('Erro ao obter código de pareamento');
    } finally {
      setRequestingPairing(false);
    }
  };

  const handleResetInstance = async () => {
    if (!user?.id) return;
    
    setResettingInstance(true);
    toast.info('Recriando instância do WhatsApp... Isso pode levar alguns segundos.');
    
    try {
      const { data, error } = await supabase.functions.invoke('whatsapp-force-reset', {
        body: { userId: user.id }
      });

      if (error) {
        console.error('Error force resetting instance:', error);
        toast.error('Erro ao recriar instância');
        return;
      }

      if (data.success && (data.qrCode || data.code)) {
        setQrCode((data.qrCode ?? data.code) as string);
        setShowQrModal(true);
        toast.success('Instância recriada! Escaneie o novo QR Code.');
      } else if (data.success) {
        toast.success(data.message || 'Instância recriada!');
        await handleConnectWhatsApp();
      } else {
        toast.error(data.error || 'Erro ao recriar instância');
      }

      await checkWhatsAppStatus();
    } catch (error) {
      console.error('Error resetting instance:', error);
      toast.error('Erro ao reiniciar instância');
    } finally {
      setResettingInstance(false);
    }
  };

  const handleDisconnectWhatsApp = async () => {
    if (!user?.id) return;
    
    setDisconnecting(true);
    
    try {
      const { error } = await supabase.functions.invoke('whatsapp-disconnect', {
        body: { userId: user.id }
      });

      if (error) {
        toast.error('Erro ao desconectar WhatsApp');
        return;
      }

      toast.success('WhatsApp desconectado');
      setWhatsappStatus(null);
      setSendToClientsEnabled(false);
      await checkWhatsAppStatus();
    } catch (error) {
      console.error('Error disconnecting:', error);
      toast.error('Erro ao desconectar');
    } finally {
      setDisconnecting(false);
    }
  };

  const handleToggleSendToClients = async (enabled: boolean) => {
    setSendToClientsEnabled(enabled);
    
    const { error } = await updateProfile({
      whatsapp_to_clients_enabled: enabled,
    });

    if (error) {
      toast.error('Erro ao salvar configuração');
      setSendToClientsEnabled(!enabled);
    }
  };


  const formatPhoneDisplay = (phone: string) => {
    if (!phone) return '';
    const numbers = phone.replace(/\D/g, '');
    const localNumber = numbers.startsWith('55') ? numbers.slice(2) : numbers;
    if (localNumber.length === 11) {
      return `(${localNumber.slice(0, 2)}) ${localNumber.slice(2, 7)}-${localNumber.slice(7)}`;
    }
    return phone;
  };

  const getConnectedDays = (connectedAt: string | undefined) => {
    if (!connectedAt) return null;
    const connected = new Date(connectedAt);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - connected.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const isConnected = whatsappStatus?.connected === true;

  const fetchStats = async () => {
    if (!user) return;

    const [clientsResult, loansResult] = await Promise.all([
      supabase.from('clients').select('id', { count: 'exact' }).eq('user_id', user.id),
      supabase.from('loans').select('principal_amount, total_paid').eq('user_id', user.id),
    ]);

    const totalClients = clientsResult.count || 0;
    const loans = loansResult.data || [];
    const totalLoans = loans.length;
    const totalLent = loans.reduce((sum, loan) => sum + Number(loan.principal_amount), 0);
    const totalReceived = loans.reduce((sum, loan) => sum + Number(loan.total_paid || 0), 0);

    setStats({ totalClients, totalLoans, totalLent, totalReceived });
    setLoadingStats(false);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    }).format(new Date(dateString));
  };

  const formatPhone = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 2) return numbers;
    if (numbers.length <= 7) return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
    if (numbers.length <= 11) return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7)}`;
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`;
  };

  const getInitials = (name: string | null) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const handleSave = async () => {
    if (!formData.full_name.trim()) {
      toast.error('Nome é obrigatório');
      return;
    }

    const phoneNumbers = formData.phone.replace(/\D/g, '');
    if (!phoneNumbers || phoneNumbers.length < 10) {
      toast.error('Telefone inválido');
      return;
    }

    setSaving(true);
    const { error } = await updateProfile({
      full_name: formData.full_name.trim(),
      phone: phoneNumbers,
      company_name: formData.company_name.trim() || null,
      payment_link: formData.payment_link.trim() || null,
      pix_key: formData.pix_key.trim() || null,
      pix_key_type: formData.pix_key.trim() ? formData.pix_key_type : null,
      billing_signature_name: formData.billing_signature_name.trim() || null,
    });

    if (error) {
      toast.error('Erro ao salvar perfil');
    } else {
      toast.success('Perfil atualizado com sucesso!');
      setIsEditing(false);
      refetch();
    }
    setSaving(false);
  };

  const handleCancel = () => {
    setFormData({
      full_name: profile?.full_name || '',
      phone: formatPhone(profile?.phone || ''),
      company_name: profile?.company_name || '',
      payment_link: profile?.payment_link || '',
      pix_key: profile?.pix_key || '',
      pix_key_type: profile?.pix_key_type || 'cpf',
      pix_pre_message: profile?.pix_pre_message || '',
      billing_signature_name: profile?.billing_signature_name || '',
    });
    setIsEditing(false);
  };


  const handleChangePassword = async () => {
    if (!passwordData.newPassword) {
      toast.error('Digite a nova senha');
      return;
    }

    if (passwordData.newPassword.length < 6) {
      toast.error('A senha deve ter pelo menos 6 caracteres');
      return;
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error('As senhas não coincidem');
      return;
    }

    setChangingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: passwordData.newPassword,
      });

      if (error) throw error;

      toast.success('Senha alterada com sucesso!');
      setPasswordData({ newPassword: '', confirmPassword: '' });
    } catch (error: any) {
      console.error('Error changing password:', error);
      toast.error(`Erro ao alterar senha: ${error.message}`);
    }
    setChangingPassword(false);
  };

  // Funções de save individuais
  const handleSavePix = async () => {
    const updates = {
      pix_key: formData.pix_key.trim() || null,
      pix_key_type: formData.pix_key.trim() ? formData.pix_key_type : null,
      pix_pre_message: formData.pix_pre_message.trim() || null,
    };
    
    const pixChanged = updates.pix_key !== (profile?.pix_key || null);
    const typeChanged = updates.pix_key_type !== (profile?.pix_key_type || null);
    const preMessageChanged = updates.pix_pre_message !== (profile?.pix_pre_message || null);
    
    if (pixChanged || typeChanged || preMessageChanged) {
      setSavingPix(true);
      const { error } = await updateProfile(updates);
      if (error) {
        toast.error('Erro ao salvar chave PIX');
      } else {
        toast.success('Chave PIX atualizada com sucesso!');
        setIsEditingPix(false);
        refetch();
      }
      setSavingPix(false);
    } else {
      // Sem mudanças, apenas fechar
      setIsEditingPix(false);
    }
  };

  const handleCancelPix = () => {
    setFormData(prev => ({
      ...prev,
      pix_key: profile?.pix_key || '',
      pix_key_type: profile?.pix_key_type || 'cpf',
      pix_pre_message: profile?.pix_pre_message || '',
    }));
    setIsEditingPix(false);
  };

  const handleSaveBillingName = async () => {
    setSavingBillingName(true);
    const { error } = await updateProfile({
      billing_signature_name: formData.billing_signature_name.trim() || null,
    });
    if (error) {
      toast.error('Erro ao salvar nome');
    } else {
      toast.success('Nome nas cobranças atualizado!');
      setIsEditingBillingName(false);
      refetch();
    }
    setSavingBillingName(false);
  };

  const handleCancelBillingName = () => {
    setFormData(prev => ({
      ...prev,
      billing_signature_name: profile?.billing_signature_name || '',
    }));
    setIsEditingBillingName(false);
  };

  const handleSavePaymentLink = async () => {
    const updates = {
      payment_link: formData.payment_link.trim() || null,
    };
    
    // Verificar se é primeiro cadastro (não tinha link antes)
    const isFirstTimeSetup = !profile?.payment_link || profile.payment_link.trim() === '';
    const linkChanged = updates.payment_link !== (profile?.payment_link || null);
    
    if (linkChanged) {
      if (isFirstTimeSetup && updates.payment_link) {
        // Primeiro cadastro: salvar direto sem verificação
        setSavingPaymentLink(true);
        const { error } = await updateProfile(updates);
        if (error) {
          toast.error('Erro ao salvar link de pagamento');
        } else {
          toast.success('Link de pagamento cadastrado com sucesso!');
          setIsEditingPaymentLink(false);
          refetch();
        }
        setSavingPaymentLink(false);
      } else {
        // Alteração ou remoção: exige verificação por código
        setPendingVerificationUpdates(updates);
        setVerificationFieldName('Link de Pagamento');
        setVerificationDialogOpen(true);
      }
    } else {
      // Sem mudanças, apenas fechar
      setIsEditingPaymentLink(false);
    }
  };

  const handlePaymentLinkVerificationSuccess = () => {
    setIsEditingPaymentLink(false);
    refetch();
  };

  const handleCancelPaymentLink = () => {
    setFormData(prev => ({
      ...prev,
      payment_link: profile?.payment_link || '',
    }));
    setIsEditingPaymentLink(false);
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="space-y-6 max-w-4xl">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-64 w-full" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in max-w-4xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-display font-bold">Meu Perfil</h1>
            <p className="text-muted-foreground">Informações da sua conta</p>
          </div>
          {!isEditing ? (
            <Button onClick={() => setIsEditing(true)} variant="outline">
              <Edit className="w-4 h-4 mr-2" />
              Editar Perfil
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button onClick={handleCancel} variant="outline" disabled={saving}>
                <X className="w-4 h-4 mr-2" />
                Cancelar
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                Salvar
              </Button>
            </div>
          )}
        </div>

        {/* Profile Card */}
        <Card className="shadow-soft overflow-hidden">
          <div className="h-24 gradient-primary" />
          <CardContent className="relative pt-0">
            <div className="flex flex-col sm:flex-row sm:items-end gap-4 -mt-12">
              <Avatar className="w-24 h-24 border-4 border-background shadow-lg">
                <AvatarFallback className="text-2xl font-bold bg-primary text-primary-foreground">
                  {getInitials(formData.full_name || profile?.full_name)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 pb-2">
                <div className="flex items-center gap-2 flex-wrap">
                  {isEditing ? (
                    <Input
                      value={formData.full_name}
                      onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                      placeholder="Seu nome completo"
                      className="max-w-xs text-xl font-bold h-auto py-1"
                    />
                  ) : (
                    <h2 className="text-xl font-bold">{profile?.full_name || 'Usuário'}</h2>
                  )}
                  <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30">
                    <CheckCircle className="w-3 h-3 mr-1" />
                    Ativo
                  </Badge>
                </div>
                {isEditing ? (
                  <Input
                    value={formData.company_name}
                    onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                    placeholder="Nome da empresa (opcional)"
                    className="max-w-xs mt-2 h-auto py-1 text-sm"
                  />
                ) : (
                  profile?.company_name && (
                    <p className="text-muted-foreground">{profile.company_name}</p>
                  )
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Info Cards */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="shadow-soft">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <User className="w-4 h-4 text-primary" />
                Informações Pessoais
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-muted">
                  <Mail className="w-4 h-4 text-muted-foreground" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-xs text-muted-foreground">Email</p>
                    <Lock className="w-3 h-3 text-muted-foreground" />
                  </div>
                  <p className="font-medium">{profile?.email || user?.email}</p>
                  <p className="text-xs text-muted-foreground">Não pode ser alterado</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-muted">
                  <Phone className="w-4 h-4 text-muted-foreground" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground">WhatsApp</p>
                  {isEditing ? (
                    <Input
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: formatPhone(e.target.value) })}
                      placeholder="(00) 00000-0000"
                      className="mt-1"
                    />
                  ) : (
                    <p className="font-medium">
                      {profile?.phone ? (
                        `(${profile.phone.slice(0, 2)}) ${profile.phone.slice(2, 7)}-${profile.phone.slice(7)}`
                      ) : (
                        <span className="text-muted-foreground">Não informado</span>
                      )}
                    </p>
                  )}
                </div>
              </div>

              {(profile?.company_name || isEditing) && !isEditing && (
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-muted">
                    <Building className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Empresa</p>
                    <p className="font-medium">{profile?.company_name || 'Não informado'}</p>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-muted">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Membro desde</p>
                  <p className="font-medium">
                    {user?.created_at ? formatDate(user.created_at) : 'N/A'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-soft">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-primary" />
                Estatísticas da Conta
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {loadingStats ? (
                <>
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </>
              ) : (
                <>
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-blue-500/10">
                      <Users className="w-4 h-4 text-blue-500" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Total de Clientes</p>
                      <p className="font-bold text-lg">{stats.totalClients}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-amber-500/10">
                      <DollarSign className="w-4 h-4 text-amber-500" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Total Emprestado</p>
                      <p className="font-bold text-lg">{formatCurrency(stats.totalLent)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-green-500/10">
                      <TrendingUp className="w-4 h-4 text-green-500" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Total Recebido</p>
                      <p className="font-bold text-lg">{formatCurrency(stats.totalReceived)}</p>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Subscription Card */}
        <Card className="shadow-soft border-primary/30">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Crown className="w-4 h-4 text-amber-500" />
              Assinatura
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10">
                <Crown className="w-4 h-4 text-amber-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Plano Atual</p>
                <p className="font-bold text-lg capitalize">
                  {profile?.subscription_plan === 'lifetime' && 'Vitalício'}
                  {profile?.subscription_plan === 'annual' && 'Anual'}
                  {profile?.subscription_plan === 'monthly' && 'Mensal'}
                  {profile?.subscription_plan === 'trial' && 'Teste'}
                  {!profile?.subscription_plan && 'Não definido'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${
                profile?.subscription_plan === 'lifetime' 
                  ? 'bg-green-500/10' 
                  : profile?.subscription_expires_at && new Date(profile.subscription_expires_at) < new Date()
                    ? 'bg-red-500/10'
                    : 'bg-blue-500/10'
              }`}>
                {profile?.subscription_plan === 'lifetime' ? (
                  <Infinity className="w-4 h-4 text-green-500" />
                ) : profile?.subscription_expires_at && new Date(profile.subscription_expires_at) < new Date() ? (
                  <AlertCircle className="w-4 h-4 text-red-500" />
                ) : (
                  <Clock className="w-4 h-4 text-blue-500" />
                )}
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Válido até</p>
                <p className={`font-bold text-lg ${
                  profile?.subscription_expires_at && new Date(profile.subscription_expires_at) < new Date()
                    ? 'text-red-500'
                    : ''
                }`}>
                  {profile?.subscription_plan === 'lifetime' ? (
                    <span className="text-green-500">♾️ Acesso Vitalício</span>
                  ) : profile?.subscription_expires_at ? (
                    formatDate(profile.subscription_expires_at)
                  ) : (
                    'N/A'
                  )}
                </p>
              </div>
            </div>

            {/* Days Remaining / Days Active */}
            {profile?.subscription_plan === 'lifetime' && user?.created_at && (
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-500/10">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Membro Ativo Há</p>
                  <p className="font-bold text-lg text-green-500">
                    {Math.floor((new Date().getTime() - new Date(user.created_at).getTime()) / (1000 * 60 * 60 * 24))} dias
                  </p>
                </div>
              </div>
            )}

            {profile?.subscription_plan !== 'lifetime' && profile?.subscription_expires_at && (() => {
              const expiresAt = new Date(profile.subscription_expires_at);
              const today = new Date();
              const diffTime = expiresAt.getTime() - today.getTime();
              const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
              
              return (
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${
                    diffDays > 30 
                      ? 'bg-green-500/10' 
                      : diffDays > 7 
                        ? 'bg-amber-500/10' 
                        : 'bg-red-500/10'
                  }`}>
                    <Clock className={`w-4 h-4 ${
                      diffDays > 30 
                        ? 'text-green-500' 
                        : diffDays > 7 
                          ? 'text-amber-500' 
                          : 'text-red-500'
                    }`} />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Dias Restantes</p>
                    <p className={`font-bold text-lg ${
                      diffDays > 30 
                        ? 'text-green-500' 
                        : diffDays > 7 
                          ? 'text-amber-500' 
                          : 'text-red-500'
                    }`}>
                      {diffDays > 0 ? `${diffDays} dias` : 'Expirado'}
                    </p>
                  </div>
                </div>
              );
            })()}

            {profile?.subscription_expires_at && 
             new Date(profile.subscription_expires_at) < new Date() && 
             profile?.subscription_plan !== 'lifetime' && (
              <div className="pt-2 border-t border-border">
                <p className="text-sm text-red-500 mb-3">
                  Sua assinatura expirou. Renove para continuar usando o sistema.
                </p>
                <Button 
                  onClick={() => setIsRenewalDialogOpen(true)}
                  className="gap-2 bg-amber-500 hover:bg-amber-600"
                >
                  <Crown className="w-4 h-4" />
                  Renovar Assinatura
                </Button>
              </div>
            )}

            {/* Botão para renovar a qualquer momento (usuários ativos) */}
            {profile?.subscription_plan && 
             profile?.subscription_plan !== 'lifetime' && 
             profile?.subscription_expires_at && 
             new Date(profile.subscription_expires_at) >= new Date() && (
              <div className="pt-2 border-t border-border">
                <Button 
                  onClick={() => setIsRenewalDialogOpen(true)}
                  variant="outline"
                  className="gap-2"
                >
                  <Crown className="w-4 h-4" />
                  Renovar Agora
                </Button>
                <p className="text-xs text-muted-foreground mt-2">
                  Renove antecipadamente e os dias serão acumulados ao seu plano atual.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Renewal Plan Dialog */}
        <Dialog open={isRenewalDialogOpen} onOpenChange={setIsRenewalDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Crown className="w-5 h-5 text-amber-500" />
                Escolha seu plano
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3 mt-4">
              {/* Plano Mensal */}
              <button
                onClick={() => handleSelectPlan(renewalLinks.monthly)}
                className="w-full p-4 border rounded-lg hover:border-primary hover:bg-primary/5 transition-all text-left"
              >
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-semibold">Mensal</p>
                    <p className="text-sm text-muted-foreground">Renovação mês a mês</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-lg">R$ 55,90</p>
                    <p className="text-xs text-muted-foreground">/mês</p>
                  </div>
                </div>
              </button>

              {/* Plano Trimestral */}
              <button
                onClick={() => handleSelectPlan(renewalLinks.quarterly)}
                className="w-full p-4 border rounded-lg hover:border-primary hover:bg-primary/5 transition-all text-left"
              >
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-semibold">Trimestral</p>
                    <p className="text-sm text-muted-foreground">Economia de 11%</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-lg">R$ 149,00</p>
                    <p className="text-xs text-muted-foreground">/3 meses</p>
                  </div>
                </div>
              </button>

              {/* Plano Anual */}
              <button
                onClick={() => handleSelectPlan(renewalLinks.annual)}
                className="w-full p-4 border border-amber-500 rounded-lg hover:bg-amber-500/10 transition-all text-left relative"
              >
                <Badge className="absolute -top-2 right-2 bg-amber-500 hover:bg-amber-500">
                  MAIS VENDIDO
                </Badge>
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-semibold">Anual</p>
                    <p className="text-sm text-muted-foreground">Economia de R$ 191</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-lg">R$ 479,00</p>
                    <p className="text-xs text-muted-foreground">/ano</p>
                  </div>
                </div>
              </button>
            </div>
          </DialogContent>
        </Dialog>

        {/* PIX Key Card */}
        <Card className="shadow-soft">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <QrCode className="w-4 h-4 text-green-500" />
              Chave PIX para Cobranças
            </CardTitle>
            {!isEditingPix ? (
              <Button variant="ghost" size="icon" onClick={() => setIsEditingPix(true)} className="h-8 w-8">
                <Pencil className="w-4 h-4" />
              </Button>
            ) : (
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" onClick={handleSavePix} disabled={savingPix} className="h-8 w-8">
                  {savingPix ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4 text-green-500" />}
                </Button>
                <Button variant="ghost" size="icon" onClick={handleCancelPix} disabled={savingPix} className="h-8 w-8">
                  <X className="w-4 h-4 text-red-500" />
                </Button>
              </div>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Configure sua chave PIX. Ela será incluída automaticamente nas mensagens de cobrança com o valor exato da parcela.
            </p>
            
            {isEditingPix ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="pix_key_type">Tipo da Chave</Label>
                  <Select
                    value={formData.pix_key_type}
                    onValueChange={(value) => setFormData({ ...formData, pix_key_type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cpf">CPF</SelectItem>
                      <SelectItem value="cnpj">CNPJ</SelectItem>
                      <SelectItem value="telefone">Telefone</SelectItem>
                      <SelectItem value="email">Email</SelectItem>
                      <SelectItem value="aleatoria">Chave Aleatória</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pix_key">Chave PIX</Label>
                  <Input
                    id="pix_key"
                    value={formData.pix_key}
                    onChange={(e) => setFormData({ ...formData, pix_key: e.target.value })}
                    placeholder={
                      formData.pix_key_type === 'cpf' ? '000.000.000-00' :
                      formData.pix_key_type === 'cnpj' ? '00.000.000/0001-00' :
                      formData.pix_key_type === 'telefone' ? '11999998888' :
                      formData.pix_key_type === 'email' ? 'seu@email.com' :
                      'sua-chave-aleatoria'
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pix_pre_message">Mensagem do PIX (opcional)</Label>
                  <Textarea
                    id="pix_pre_message"
                    value={formData.pix_pre_message}
                    onChange={(e) => setFormData({ ...formData, pix_pre_message: e.target.value.slice(0, 500) })}
                    placeholder="Ex: Clique no link e coloque seu nome completo e valor"
                    rows={2}
                    maxLength={500}
                  />
                  <p className="text-xs text-muted-foreground">
                    Esta mensagem aparecerá junto com a chave PIX em todas as cobranças. ({formData.pix_pre_message.length}/500)
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-green-500/10">
                    <QrCode className="w-4 h-4 text-green-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground">Chave Cadastrada</p>
                    {profile?.pix_key ? (
                      <div>
                        <p className="font-medium">
                          {profile.pix_key}
                        </p>
                        <p className="text-xs text-muted-foreground capitalize">
                          Tipo: {profile.pix_key_type || 'Não definido'}
                        </p>
                      </div>
                    ) : (
                      <p className="text-muted-foreground">Nenhuma chave cadastrada</p>
                    )}
                  </div>
                </div>
                {profile?.pix_pre_message && (
                  <div className="bg-muted/50 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground mb-1">📢 Mensagem do PIX</p>
                    <p className="text-sm">{profile.pix_pre_message}</p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Billing Signature Name Card */}
        <Card className="shadow-soft">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Edit className="w-4 h-4 text-primary" />
              Nome nas Cobranças
            </CardTitle>
            {!isEditingBillingName ? (
              <Button variant="ghost" size="icon" onClick={() => setIsEditingBillingName(true)} className="h-8 w-8">
                <Pencil className="w-4 h-4" />
              </Button>
            ) : (
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" onClick={handleSaveBillingName} disabled={savingBillingName} className="h-8 w-8">
                  {savingBillingName ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4 text-green-500" />}
                </Button>
                <Button variant="ghost" size="icon" onClick={handleCancelBillingName} disabled={savingBillingName} className="h-8 w-8">
                  <X className="w-4 h-4 text-red-500" />
                </Button>
              </div>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Este nome será exibido no final das mensagens de cobrança enviadas aos seus clientes via WhatsApp.
            </p>
            
            {isEditingBillingName ? (
              <div className="space-y-2">
                <Label htmlFor="billing_signature_name">Nome/Assinatura</Label>
                <Input
                  id="billing_signature_name"
                  value={formData.billing_signature_name}
                  onChange={(e) => setFormData({ ...formData, billing_signature_name: e.target.value })}
                  placeholder="Ex: João Empréstimos, Maria Créditos..."
                />
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Edit className="w-4 h-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground">Nome Configurado</p>
                  {profile?.billing_signature_name ? (
                    <p className="font-medium">{profile.billing_signature_name}</p>
                  ) : (
                    <p className="text-muted-foreground">
                      {profile?.company_name ? `Usando: ${profile.company_name}` : 'Nenhum nome cadastrado'}
                    </p>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Payment Link Card */}
        <Card className="shadow-soft">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <LinkIcon className="w-4 h-4 text-primary" />
              Link de Pagamento (Opcional)
            </CardTitle>
            {!isEditingPaymentLink ? (
              <Button variant="ghost" size="icon" onClick={() => setIsEditingPaymentLink(true)} className="h-8 w-8">
                <Pencil className="w-4 h-4" />
              </Button>
            ) : (
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" onClick={handleSavePaymentLink} disabled={savingPaymentLink} className="h-8 w-8">
                  {savingPaymentLink ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4 text-green-500" />}
                </Button>
                <Button variant="ghost" size="icon" onClick={handleCancelPaymentLink} disabled={savingPaymentLink} className="h-8 w-8">
                  <X className="w-4 h-4 text-red-500" />
                </Button>
              </div>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Configure um link de pagamento adicional (PagSeguro, Mercado Pago, etc). Será incluído nas mensagens junto com a chave PIX.
            </p>
            
            {isEditingPaymentLink ? (
              <div className="space-y-2">
                <Label htmlFor="payment_link">Link de Pagamento</Label>
                <Input
                  id="payment_link"
                  value={formData.payment_link}
                  onChange={(e) => setFormData({ ...formData, payment_link: e.target.value })}
                  placeholder="https://seu-link-de-pagamento.com"
                  type="url"
                />
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-muted">
                  <LinkIcon className="w-4 h-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground">Link Cadastrado</p>
                  {profile?.payment_link ? (
                    <a 
                      href={profile.payment_link} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="font-medium text-primary hover:underline truncate block"
                    >
                      {profile.payment_link}
                    </a>
                  ) : (
                    <p className="text-muted-foreground">Nenhum link cadastrado</p>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Company Logo Card */}
        <Card className="shadow-soft">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-primary" />
              Logo da Empresa
            </CardTitle>
          </CardHeader>
          <CardContent>
            <CompanyLogoUpload
              currentLogoUrl={profile?.company_logo_url || null}
              onLogoChange={() => refetch()}
            />
          </CardContent>
        </Card>

        {/* WhatsApp para Clientes */}
        <Card className="shadow-soft border-primary/20">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-500/10">
                  <MessageCircle className="w-5 h-5 text-green-500" />
                </div>
                <div>
                  <CardTitle className="text-base">WhatsApp para Clientes</CardTitle>
                  <CardDescription>
                    Envie mensagens diretamente aos seus clientes pelo seu WhatsApp
                  </CardDescription>
                </div>
              </div>
              {isPaidPlan() ? (
                checkingStatus ? (
                  <Badge variant="outline" className="bg-muted">
                    <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                    Verificando...
                  </Badge>
                ) : isConnected ? (
                  <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30">
                    <Wifi className="w-3 h-3 mr-1" />
                    Conectado
                  </Badge>
                ) : (
                  <Badge variant="outline" className="bg-muted text-muted-foreground">
                    <WifiOff className="w-3 h-3 mr-1" />
                    Não Conectado
                  </Badge>
                )
              ) : (
                <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30">
                  <Lock className="w-3 h-3 mr-1" />
                  Bloqueado
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {!isPaidPlan() ? (
              /* Trial/Non-paid User - Locked State */
              <div className="p-6 rounded-lg bg-muted/50 text-center border border-amber-500/20">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-amber-500/10 flex items-center justify-center">
                  <Lock className="w-8 h-8 text-amber-500" />
                </div>
                <h3 className="font-semibold text-lg mb-2">🔒 Funcionalidade Exclusiva para Assinantes</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  A conexão WhatsApp está disponível apenas para planos:
                </p>
                <ul className="text-sm text-muted-foreground mb-6 space-y-1">
                  <li>• Mensal</li>
                  <li>• Trimestral</li>
                  <li>• Anual</li>
                  <li>• Vitalício</li>
                </ul>
                <Button 
                  className="bg-green-600 hover:bg-green-700"
                  onClick={() => window.open(affiliateLinks.monthly, '_blank')}
                >
                  <Crown className="w-4 h-4 mr-2" />
                  Assinar Agora
                </Button>
                <p className="text-xs text-muted-foreground mt-3">
                  Após o pagamento, a funcionalidade será liberada automaticamente.
                </p>
              </div>
            ) : isConnected ? (
              <>
                {/* Connected State */}
                <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    </div>
                    <div>
                      <p className="font-medium text-green-600">WhatsApp Conectado</p>
                      {whatsappStatus?.phoneNumber && (
                        <p className="text-sm text-muted-foreground">
                          Número: {formatPhoneDisplay(whatsappStatus.phoneNumber)}
                        </p>
                      )}
                    </div>
                  </div>
                  {whatsappStatus?.connectedAt && (
                    <p className="text-xs text-muted-foreground">
                      Conectado há {getConnectedDays(whatsappStatus.connectedAt)} dias
                    </p>
                  )}
                  <div className="mt-2 p-2 rounded bg-green-500/5 border border-green-500/10">
                    <p className="text-xs text-green-600 flex items-center gap-1">
                      <Wifi className="w-3 h-3" />
                      Conexão persistente ativa - permanece conectado mesmo com navegador fechado
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div>
                    <p className="font-medium text-sm">Enviar para clientes</p>
                    <p className="text-xs text-muted-foreground">Permite enviar cobranças e comprovantes</p>
                  </div>
                  <Switch
                    checked={sendToClientsEnabled}
                    onCheckedChange={handleToggleSendToClients}
                  />
                </div>

                <div className="flex flex-col sm:flex-row gap-2">
                  <Button 
                    variant="outline" 
                    onClick={handleResetInstance}
                    disabled={resettingInstance}
                    className="flex-1 text-amber-600 border-amber-500/30 hover:bg-amber-500/10"
                  >
                    {resettingInstance ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Recriando...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Recriar Instância
                      </>
                    )}
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={handleDisconnectWhatsApp}
                    disabled={disconnecting}
                    className="flex-1 text-destructive hover:text-destructive"
                  >
                    {disconnecting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Desconectando...
                      </>
                    ) : (
                      <>
                        <Unplug className="w-4 h-4 mr-2" />
                        Desconectar
                      </>
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground text-center">
                  Se sua conexão estiver instável ou desconectando, use "Recriar Instância" para gerar uma nova conexão.
                </p>
              </>
            ) : (
              <>
                {/* Disconnected State */}
                <div className="p-4 rounded-lg bg-muted/50 text-center">
                  <QrCode className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
                  <p className="font-medium mb-1">Conecte seu WhatsApp</p>
                  <p className="text-sm text-muted-foreground mb-4">
                    Escaneie um QR Code para conectar seu WhatsApp e enviar mensagens diretamente aos seus clientes.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-2 justify-center">
                    <Button onClick={handleConnectWhatsApp} className="bg-green-600 hover:bg-green-700">
                      <QrCode className="w-4 h-4 mr-2" />
                      Conectar WhatsApp
                    </Button>
                    {whatsappStatus?.status === 'close' || whatsappStatus?.status === 'disconnected' ? (
                      <Button 
                        variant="outline" 
                        onClick={handleReconnectWhatsApp}
                        disabled={reconnecting}
                      >
                        {reconnecting ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Reconectando...
                          </>
                        ) : (
                          <>
                            <RefreshCw className="w-4 h-4 mr-2" />
                            Tentar Reconectar
                          </>
                        )}
                      </Button>
                    ) : null}
                  </div>
                </div>

                {/* Status: connecting (waiting for QR scan) */}
                {whatsappStatus?.status === 'connecting' && (
                  <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/30">
                    <div className="flex items-start gap-2">
                      <Loader2 className="w-4 h-4 text-blue-500 mt-0.5 shrink-0 animate-spin" />
                      <div>
                        <p className="text-sm font-medium text-blue-600">Aguardando leitura do QR Code...</p>
                        <p className="text-xs text-muted-foreground">
                          Escaneie o QR Code no WhatsApp do seu celular para conectar.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Status: close (connection lost) */}
                {whatsappStatus?.status === 'close' && (
                  <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-amber-600">Conexão perdida</p>
                        <p className="text-xs text-muted-foreground">
                          Sua conexão anterior foi desconectada. Tente reconectar ou escaneie o QR Code novamente.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Button to reset instance if having problems */}
                {(whatsappStatus?.needsNewQR || whatsappStatus?.status === 'connecting') && (
                  <div className="flex justify-center">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={handleResetInstance}
                      disabled={resettingInstance}
                      className="text-amber-600 border-amber-500/30 hover:bg-amber-500/10"
                    >
                      {resettingInstance ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Reiniciando...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="w-4 h-4 mr-2" />
                          Reiniciar e Gerar Novo QR
                        </>
                      )}
                    </Button>
                  </div>
                )}

                <p className="text-xs text-muted-foreground text-center">
                  Com o WhatsApp conectado, você poderá enviar notificações de cobrança e comprovantes diretamente para os telefones dos seus clientes.
                </p>
              </>
            )}
          </CardContent>
        </Card>

        {/* Change Password Card */}
        <Card className="shadow-soft">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-amber-500" />
              Alterar Senha
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Digite uma nova senha para sua conta. A senha deve ter pelo menos 6 caracteres.
            </p>
            
            <div className="space-y-2">
              <Label htmlFor="newPassword">Nova Senha</Label>
              <div className="relative">
                <Input
                  id="newPassword"
                  type={showNewPassword ? 'text' : 'password'}
                  value={passwordData.newPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                  placeholder="Digite a nova senha"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmar Nova Senha</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={passwordData.confirmPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                  placeholder="Confirme a nova senha"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <Button 
              onClick={handleChangePassword} 
              disabled={changingPassword || !passwordData.newPassword || !passwordData.confirmPassword}
              className="gap-2"
            >
              {changingPassword ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Alterando...
                </>
              ) : (
                <>
                  <KeyRound className="w-4 h-4" />
                  Alterar Senha
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Verification Code Dialog for sensitive changes */}
      <VerificationCodeDialog
        open={verificationDialogOpen}
        onOpenChange={(open) => {
          setVerificationDialogOpen(open);
          if (!open) {
            setPendingVerificationUpdates({});
            setVerificationFieldName('');
          }
        }}
        pendingUpdates={pendingVerificationUpdates}
        fieldDisplayName={verificationFieldName}
        onSuccess={() => {
          // Link de Pagamento ainda usa 2FA
          if (verificationFieldName === 'Link de Pagamento') {
            handlePaymentLinkVerificationSuccess();
          }
        }}
      />

      {/* QR Code Modal */}
      <Dialog open={showQrModal} onOpenChange={setShowQrModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-green-500" />
              Conectar WhatsApp
            </DialogTitle>
            <DialogDescription>
              Conecte seu WhatsApp para enviar mensagens aos clientes
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col items-center py-4">
            {/* Timer and Progress Bar */}
            {qrCode && !generatingQr && (
              <div className="w-full mb-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Timer className={`w-4 h-4 ${qrExpired ? 'text-destructive' : qrTimeRemaining <= 15 ? 'text-amber-500' : 'text-green-500'}`} />
                    <span className={`text-sm font-medium ${qrExpired ? 'text-destructive' : qrTimeRemaining <= 15 ? 'text-amber-500' : 'text-muted-foreground'}`}>
                      {qrExpired ? 'QR Code expirado!' : `${qrTimeRemaining}s restantes`}
                    </span>
                  </div>
                  {!qrExpired && (
                    <span className="text-xs text-muted-foreground">Escaneie com calma</span>
                  )}
                </div>
                <Progress 
                  value={(qrTimeRemaining / 90) * 100} 
                  className={`h-2 ${qrExpired ? '[&>div]:bg-destructive' : qrTimeRemaining <= 15 ? '[&>div]:bg-amber-500' : '[&>div]:bg-green-500'}`}
                />
              </div>
            )}

            {/* QR Code Display */}
            {generatingQr ? (
              <div className="w-64 h-64 flex items-center justify-center bg-muted rounded-lg">
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  <span className="text-sm text-muted-foreground">Gerando QR Code...</span>
                </div>
              </div>
            ) : qrCode ? (
              <div className="relative">
                <div className={`p-4 bg-white rounded-lg transition-all ${qrExpired ? 'opacity-30 blur-sm' : ''}`}>
                  <img 
                    src={qrImageSrc || ''}
                    alt="QR Code" 
                    className="w-56 h-56"
                  />
                </div>
                
                {/* Expired Overlay */}
                {qrExpired && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/80 rounded-lg">
                    <AlertCircle className="w-12 h-12 text-destructive mb-3" />
                    <p className="font-medium text-destructive text-center">QR Code expirado!</p>
                    <p className="text-sm text-muted-foreground text-center mt-1">Clique abaixo para gerar um novo</p>
                    <Button 
                      onClick={() => handleRefreshQrCode()}
                      disabled={generatingQr}
                      className="mt-4 bg-green-600 hover:bg-green-700"
                    >
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Gerar Novo QR Code
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <div className="w-full flex flex-col items-center justify-center bg-muted rounded-lg p-6">
                <Smartphone className="w-12 h-12 text-green-500 mb-3" />
                <p className="text-foreground font-medium text-center mb-1">Conectar via Código de Pareamento</p>
                <p className="text-xs text-muted-foreground text-center mb-4">
                  Digite seu número de WhatsApp para receber um código de 8 dígitos.
                </p>
                
                {pairingCode ? (
                  <div className="flex flex-col items-center gap-3 w-full">
                    <div className="bg-background border-2 border-green-500 rounded-xl px-6 py-4">
                      <p className="text-3xl font-mono font-bold tracking-widest text-center">{pairingCode}</p>
                    </div>
                    <p className="text-sm text-muted-foreground text-center">
                      No seu WhatsApp, vá em <strong>Configurações → Aparelhos conectados → Conectar dispositivo → Conectar com número de telefone</strong> e digite este código.
                    </p>
                    <Button variant="outline" size="sm" onClick={() => { setPairingCode(null); setPairingPhone(''); }}>
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Gerar Novo Código
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3 w-full">
                    <Input
                      placeholder="5511999999999"
                      value={pairingPhone}
                      onChange={(e) => setPairingPhone(e.target.value)}
                      className="text-center text-lg"
                    />
                    <Button
                      onClick={handleRequestPairingCode}
                      disabled={requestingPairing || !pairingPhone.trim()}
                      className="w-full bg-green-600 hover:bg-green-700"
                    >
                      {requestingPairing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <MessageCircle className="w-4 h-4 mr-2" />}
                      Gerar Código de Pareamento
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* Instructions */}
            {(
              <div className="mt-6 w-full space-y-3">
                {/* Warning about device conflicts */}
                <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                    <p className="text-xs text-amber-600">
                      <strong>Importante:</strong> Se você tiver outras sessões do WhatsApp Web ativas, feche-as primeiro para evitar desconexões.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                  <div className="p-2 rounded-full bg-green-500/10">
                    <Smartphone className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">1. Abra o WhatsApp</p>
                    <p className="text-xs text-muted-foreground">No seu celular</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                  <div className="p-2 rounded-full bg-green-500/10">
                    <LinkIcon className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">2. Aparelhos conectados</p>
                    <p className="text-xs text-muted-foreground">Menu ⋮ → Aparelhos conectados</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                  <div className="p-2 rounded-full bg-green-500/10">
                    <KeyRound className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">3. Conectar com número de telefone</p>
                    <p className="text-xs text-muted-foreground">Toque em "Conectar um aparelho" e depois em "Conectar com número de telefone"</p>
                  </div>
                </div>
              </div>
            )}

            {/* Connection Status */}
            {!qrExpired && qrCode && !generatingQr && (
              <div className="flex items-center gap-2 mt-4 px-4 py-2 rounded-full bg-green-500/10 text-green-600">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm font-medium">Aguardando conexão...</span>
              </div>
            )}

            {/* Refresh Button (when not expired) */}
            {!qrExpired && qrCode && !generatingQr && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => handleRefreshQrCode()}
                disabled={generatingQr}
                className="mt-3 text-muted-foreground hover:text-foreground"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Atualizar QR Code
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
