import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Upload, Trash2, Loader2, ImageIcon } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface CompanyLogoUploadProps {
  currentLogoUrl: string | null;
  onLogoChange: (url: string | null) => void;
}

export default function CompanyLogoUpload({ currentLogoUrl, onLogoChange }: CompanyLogoUploadProps) {
  const { user } = useAuth();
  const [isUploading, setIsUploading] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Por favor, selecione uma imagem');
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error('A imagem deve ter no máximo 2MB');
      return;
    }

    setIsUploading(true);
    try {
      // Generate unique filename
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/logo-${Date.now()}.${fileExt}`;

      // Delete old logo if exists
      if (currentLogoUrl) {
        const oldPath = currentLogoUrl.split('/company-logos/')[1];
        if (oldPath) {
          await supabase.storage.from('company-logos').remove([oldPath]);
        }
      }

      // Upload new logo
      const { error: uploadError } = await supabase.storage
        .from('company-logos')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('company-logos')
        .getPublicUrl(fileName);

      // Update profile
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ company_logo_url: publicUrl })
        .eq('id', user.id);

      if (updateError) throw updateError;

      onLogoChange(publicUrl);
      toast.success('Logo atualizada com sucesso!');
    } catch (error: any) {
      console.error('Error uploading logo:', error);
      toast.error('Erro ao enviar logo: ' + (error.message || 'Tente novamente'));
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveLogo = async () => {
    if (!user || !currentLogoUrl) return;

    setIsRemoving(true);
    try {
      // Extract path from URL
      const path = currentLogoUrl.split('/company-logos/')[1];
      if (path) {
        await supabase.storage.from('company-logos').remove([path]);
      }

      // Update profile
      const { error } = await supabase
        .from('profiles')
        .update({ company_logo_url: null })
        .eq('id', user.id);

      if (error) throw error;

      onLogoChange(null);
      toast.success('Logo removida com sucesso!');
    } catch (error: any) {
      console.error('Error removing logo:', error);
      toast.error('Erro ao remover logo');
    } finally {
      setIsRemoving(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Logo Preview */}
      <div className="flex items-center gap-4">
        <div className="w-24 h-24 rounded-lg border-2 border-dashed border-muted-foreground/30 flex items-center justify-center overflow-hidden bg-muted/50">
          {currentLogoUrl ? (
            <img 
              src={currentLogoUrl} 
              alt="Logo da empresa" 
              className="w-full h-full object-contain"
            />
          ) : (
            <ImageIcon className="w-8 h-8 text-muted-foreground/50" />
          )}
        </div>
        <div className="flex-1 space-y-2">
          <p className="text-sm text-muted-foreground">
            Esta logo será usada nos PDFs de comprovantes e contratos.
          </p>
          <p className="text-xs text-muted-foreground">
            Recomendado: PNG transparente, até 2MB
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileSelect}
        />
        <Button
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
        >
          {isUploading ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Upload className="w-4 h-4 mr-2" />
          )}
          {isUploading ? 'Enviando...' : 'Enviar Logo'}
        </Button>
        {currentLogoUrl && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleRemoveLogo}
            disabled={isRemoving}
            className="text-destructive hover:text-destructive"
          >
            {isRemoving ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Trash2 className="w-4 h-4 mr-2" />
            )}
            {isRemoving ? 'Removendo...' : 'Remover'}
          </Button>
        )}
      </div>
    </div>
  );
}
