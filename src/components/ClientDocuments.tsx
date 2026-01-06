import React, { useState, useEffect } from 'react';
import { useClientDocuments } from '@/hooks/useClientDocuments';
import { useEmployeeContext } from '@/hooks/useEmployeeContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Upload, File, Trash2, Download, FileText, Image, FileSpreadsheet, Loader2, CheckCircle } from 'lucide-react';
import { formatDate } from '@/lib/calculations';
import { toast } from 'sonner';

interface ClientDocumentsProps {
  clientId: string;
  clientName: string;
  useExternalInput?: boolean;
  pendingFiles?: File[] | null;
  onPendingFilesProcessed?: () => void;
}

export function ClientDocuments({ clientId, clientName, useExternalInput, pendingFiles, onPendingFilesProcessed }: ClientDocumentsProps) {
  const { 
    documents, 
    loading, 
    uploading, 
    uploadProgress,
    currentFileName,
    totalFiles,
    completedFiles,
    uploadComplete,
    uploadMultipleDocuments, 
    deleteDocument, 
    downloadDocument,
    dismissUploadComplete 
  } = useClientDocuments(clientId);
  const { loading: contextLoading } = useEmployeeContext();
  const [deleteDoc, setDeleteDoc] = useState<{ id: string; path: string } | null>(null);
  const [description, setDescription] = useState('');
  
  const isUploadDisabled = uploading || contextLoading;

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    await uploadMultipleDocuments(Array.from(files), description || undefined);
    setDescription('');
    e.target.value = '';
  };

  // Processar arquivos vindos do input externo (fix iOS PWA)
  useEffect(() => {
    if (pendingFiles && pendingFiles.length > 0 && !contextLoading) {
      console.log('[Docs] Context ready, processing pending files:', pendingFiles.length);
      
      const processAll = async () => {
        await uploadMultipleDocuments(pendingFiles, description || undefined);
        setDescription('');
        onPendingFilesProcessed?.();
      };
      processAll();
    }
  }, [pendingFiles, contextLoading, uploadMultipleDocuments, description, onPendingFilesProcessed]);

  const handleDownload = async (filePath: string, fileName: string) => {
    await downloadDocument(filePath, fileName);
  };

  const handleDelete = async () => {
    if (deleteDoc) {
      await deleteDocument(deleteDoc.id, deleteDoc.path);
      setDeleteDoc(null);
    }
  };

  const getFileIcon = (fileType: string | null) => {
    if (!fileType) return <File className="w-5 h-5" />;
    if (fileType.startsWith('image/')) return <Image className="w-5 h-5 text-blue-500" />;
    if (fileType.includes('pdf')) return <FileText className="w-5 h-5 text-red-500" />;
    if (fileType.includes('sheet') || fileType.includes('excel')) return <FileSpreadsheet className="w-5 h-5 text-green-500" />;
    return <File className="w-5 h-5" />;
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div className="space-y-2">
          <Label htmlFor="doc-description">Descrição do Documento (opcional)</Label>
          <Input
            id="doc-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Ex: RG, CPF, Comprovante de residência..."
          />
        </div>
        
        <div className="flex items-center gap-2">
          {useExternalInput ? (
            // Usar label nativo que aponta para input externo (fix iOS PWA - sem .click())
            <label 
              htmlFor="doc-upload-external" 
              className={`flex-1 ${isUploadDisabled ? 'pointer-events-none opacity-50' : ''}`}
            >
              <span className="inline-flex items-center justify-center gap-2 cursor-pointer rounded-md border border-input bg-background px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors w-full">
                {isUploadDisabled ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Upload className="w-4 h-4" />
                )}
                {uploading ? 'Enviando...' : contextLoading ? 'Carregando...' : 'Selecionar Arquivos'}
              </span>
            </label>
          ) : (
            // Fallback: input interno (para uso fora de Dialog)
            <>
              <input
                id="doc-upload-input"
                type="file"
                multiple
                onChange={handleFileSelect}
                className="sr-only"
                accept="image/*,application/pdf"
              />
              <label 
                htmlFor="doc-upload-input" 
                className={`flex-1 ${isUploadDisabled ? 'pointer-events-none opacity-50' : ''}`}
              >
                <span className="inline-flex items-center justify-center gap-2 cursor-pointer rounded-md border border-input bg-background px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors w-full">
                  {isUploadDisabled ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Upload className="w-4 h-4" />
                  )}
                  {uploading ? 'Enviando...' : contextLoading ? 'Carregando...' : 'Selecionar Arquivos'}
                </span>
              </label>
            </>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Aceita: imagens, PDF, Word, Excel. Você pode selecionar múltiplos arquivos.
        </p>
      </div>

      {/* Barra de Progresso */}
      {uploading && (
        <div className="space-y-2 p-4 bg-muted/50 rounded-lg border animate-in fade-in duration-200">
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2 truncate">
              <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
              <span className="truncate">{currentFileName}</span>
            </span>
            <span className="font-medium flex-shrink-0 ml-2">{uploadProgress}%</span>
          </div>
          <Progress value={uploadProgress} className="h-2" />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {uploadProgress < 80 ? 'Fazendo upload...' : 
               uploadProgress < 100 ? 'Salvando documento...' : 
               'Concluído!'}
            </span>
            {totalFiles > 1 && (
              <span>Arquivo {completedFiles + 1} de {totalFiles}</span>
            )}
          </div>
        </div>
      )}

      {/* Mensagem de Sucesso */}
      {uploadComplete && !uploading && (
        <div className="p-4 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg flex items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
          <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-500 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="font-medium text-green-800 dark:text-green-400">
              Documento(s) enviado(s) com sucesso!
            </p>
            <p className="text-sm text-green-600 dark:text-green-500">
              Os documentos já aparecem abaixo.
            </p>
          </div>
          <Button 
            variant="ghost" 
            size="sm"
            onClick={dismissUploadComplete}
            className="text-green-700 hover:text-green-800 hover:bg-green-100 dark:text-green-400 dark:hover:bg-green-900/50"
          >
            OK
          </Button>
        </div>
      )}

      <div className="border-t pt-4">
        <Label className="mb-2 block">Documentos Salvos ({documents.length})</Label>
        
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : documents.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            Nenhum documento enviado para este cliente.
          </p>
        ) : (
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center justify-between gap-2 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  {getFileIcon(doc.file_type)}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{doc.file_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {doc.description && <span className="text-primary">{doc.description} • </span>}
                      {formatFileSize(doc.file_size)} • {formatDate(doc.created_at)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => handleDownload(doc.file_path, doc.file_name)}
                  >
                    <Download className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setDeleteDoc({ id: doc.id, path: doc.file_path })}
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <AlertDialog open={!!deleteDoc} onOpenChange={() => setDeleteDoc(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir documento</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este documento? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
