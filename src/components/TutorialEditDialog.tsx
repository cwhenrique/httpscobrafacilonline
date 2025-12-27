import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Save, Youtube, ExternalLink } from 'lucide-react';
import { TutorialVideo, useTutorials } from '@/hooks/useTutorials';
import { toast } from 'sonner';

interface TutorialEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tutorials: TutorialVideo[];
}

interface TutorialEditItem {
  id: string;
  youtube_link: string;
  duration: string;
}

// Extract YouTube video ID from various URL formats
const extractVideoId = (url: string): string | null => {
  if (!url) return null;
  
  // Already just an ID
  if (/^[a-zA-Z0-9_-]{11}$/.test(url)) {
    return url;
  }
  
  // Various YouTube URL formats
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  
  return null;
};

export function TutorialEditDialog({ open, onOpenChange, tutorials }: TutorialEditDialogProps) {
  const { updateTutorial } = useTutorials();
  const [editItems, setEditItems] = useState<TutorialEditItem[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (tutorials && open) {
      setEditItems(tutorials.map(t => ({
        id: t.id,
        youtube_link: t.youtube_video_id ? `https://youtube.com/watch?v=${t.youtube_video_id}` : '',
        duration: t.duration || ''
      })));
    }
  }, [tutorials, open]);

  const handleLinkChange = (id: string, value: string) => {
    setEditItems(prev => prev.map(item => 
      item.id === id ? { ...item, youtube_link: value } : item
    ));
  };

  const handleDurationChange = (id: string, value: string) => {
    setEditItems(prev => prev.map(item => 
      item.id === id ? { ...item, duration: value } : item
    ));
  };

  const handleSave = async () => {
    setIsSaving(true);
    let successCount = 0;
    let errorCount = 0;

    for (const item of editItems) {
      const tutorial = tutorials.find(t => t.id === item.id);
      if (!tutorial) continue;

      const videoId = extractVideoId(item.youtube_link);
      const currentVideoId = tutorial.youtube_video_id;
      const currentDuration = tutorial.duration;

      // Only update if something changed
      if (videoId !== currentVideoId || item.duration !== currentDuration) {
        try {
          await updateTutorial.mutateAsync({
            id: item.id,
            youtube_video_id: videoId || '',
            duration: item.duration || undefined
          });
          successCount++;
        } catch {
          errorCount++;
        }
      }
    }

    setIsSaving(false);

    if (successCount > 0 && errorCount === 0) {
      toast.success(`${successCount} aula(s) atualizada(s) com sucesso!`);
      onOpenChange(false);
    } else if (errorCount > 0) {
      toast.error(`Erro ao atualizar ${errorCount} aula(s). Verifique suas permissões.`);
    }
  };

  const getTutorialByOrder = (orderNumber: number) => {
    return tutorials.find(t => t.order_number === orderNumber);
  };

  const getEditItem = (id: string) => {
    return editItems.find(item => item.id === id);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Youtube className="h-5 w-5 text-red-500" />
            Configurar Aulas do Aplicativo
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="h-[60vh] pr-4">
          <div className="space-y-4">
            {tutorials.map((tutorial) => {
              const editItem = getEditItem(tutorial.id);
              const hasVideo = editItem?.youtube_link && extractVideoId(editItem.youtube_link);

              return (
                <div 
                  key={tutorial.id} 
                  className="p-4 border rounded-lg bg-card space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="font-mono">
                        {String(tutorial.order_number).padStart(2, '0')}
                      </Badge>
                      <span className="font-medium">{tutorial.title}</span>
                    </div>
                    {hasVideo && (
                      <Badge className="bg-green-500/10 text-green-500 border-green-500/20">
                        Configurado
                      </Badge>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <div className="md:col-span-3 space-y-1.5">
                      <Label htmlFor={`link-${tutorial.id}`} className="text-xs text-muted-foreground">
                        Link do YouTube
                      </Label>
                      <div className="relative">
                        <Input
                          id={`link-${tutorial.id}`}
                          value={editItem?.youtube_link || ''}
                          onChange={(e) => handleLinkChange(tutorial.id, e.target.value)}
                          placeholder="https://youtube.com/watch?v=..."
                          className="pr-10"
                        />
                        {hasVideo && (
                          <a
                            href={editItem?.youtube_link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        )}
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor={`duration-${tutorial.id}`} className="text-xs text-muted-foreground">
                        Duração
                      </Label>
                      <Input
                        id={`duration-${tutorial.id}`}
                        value={editItem?.duration || ''}
                        onChange={(e) => handleDurationChange(tutorial.id, e.target.value)}
                        placeholder="5:30"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? 'Salvando...' : 'Salvar Alterações'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
