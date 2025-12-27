import { useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { GraduationCap, Play, Clock, Settings, VideoOff, LayoutGrid, GalleryHorizontal } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useTutorials, useIsAdmin } from '@/hooks/useTutorials';
import { TutorialEditDialog } from '@/components/TutorialEditDialog';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";

export default function Tutorials() {
  const { tutorials, isLoading } = useTutorials();
  const { isAdmin } = useIsAdmin();
  const [viewMode, setViewMode] = useState<"carousel" | "panorama">("carousel");
  const [selectedVideo, setSelectedVideo] = useState<{ id: string; title: string; videoId: string } | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  const sortedTutorials = tutorials?.sort((a, b) => a.order_number - b.order_number) || [];

  const getThumbnail = (videoId: string | null) => {
    if (!videoId) return null;
    return `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
  };

  const getEmbedUrl = (videoId: string) => 
    `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`;

  const VideoCard = ({ video, compact = false }: { video: typeof sortedTutorials[0]; compact?: boolean }) => {
    const thumbnail = getThumbnail(video.youtube_video_id);
    const hasVideo = !!video.youtube_video_id;

    return (
      <Card 
        className={`overflow-hidden transition-all duration-300 group ${
          hasVideo 
            ? 'hover:shadow-lg cursor-pointer' 
            : 'opacity-70'
        }`}
        onClick={() => hasVideo && setSelectedVideo({
          id: video.id,
          title: video.title,
          videoId: video.youtube_video_id!
        })}
      >
        {/* Thumbnail */}
        <div className="relative aspect-video overflow-hidden bg-muted">
          {thumbnail ? (
            <img
              src={thumbnail}
              alt={video.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              onError={(e) => {
                e.currentTarget.src = `https://img.youtube.com/vi/${video.youtube_video_id}/hqdefault.jpg`;
              }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-muted">
              <VideoOff className="h-12 w-12 text-muted-foreground" />
            </div>
          )}

          {/* Capa com título do vídeo */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent flex flex-col justify-end p-4">
            <h3 className="text-white font-bold text-lg leading-tight drop-shadow-lg line-clamp-2">
              {video.title}
            </h3>
          </div>

          {/* Play Button Overlay */}
          {hasVideo && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              <div className="w-14 h-14 rounded-full bg-primary flex items-center justify-center shadow-lg">
                <Play className="w-6 h-6 text-primary-foreground ml-1" fill="currentColor" />
              </div>
            </div>
          )}

          {/* Order number badge */}
          <Badge 
            variant="secondary" 
            className="absolute top-2 left-2 font-mono bg-primary text-primary-foreground border-0 text-sm px-2.5 py-1"
          >
            Aula {String(video.order_number).padStart(2, '0')}
          </Badge>

          {/* Duration Badge */}
          {video.duration && (
            <Badge 
              variant="secondary" 
              className="absolute top-2 right-2 bg-black/80 text-white border-0"
            >
              <Clock className="w-3 h-3 mr-1" />
              {video.duration}
            </Badge>
          )}

          {/* No video indicator */}
          {!hasVideo && (
            <Badge 
              className="absolute bottom-16 right-2"
              variant="destructive"
            >
              Em breve
            </Badge>
          )}
        </div>

        {!compact && (
          <>
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="text-base line-clamp-2">{video.title}</CardTitle>
              </div>
              <Badge variant="outline" className="w-fit text-xs">
                {video.category}
              </Badge>
            </CardHeader>

            <CardContent className="pt-0">
              <CardDescription className="line-clamp-2">
                {video.description}
              </CardDescription>
            </CardContent>
          </>
        )}
      </Card>
    );
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <Skeleton className="h-10 w-64" />
            <Skeleton className="h-10 w-32" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <Skeleton key={i} className="h-64 w-full rounded-lg" />
            ))}
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-xl">
              <GraduationCap className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-display font-bold">Aulas do Aplicativo</h1>
              <p className="text-muted-foreground">
                Aprenda a usar todas as funcionalidades do CobraFácil
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* View Mode Toggle */}
            <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
              <Button 
                variant={viewMode === "carousel" ? "default" : "ghost"} 
                size="sm"
                onClick={() => setViewMode("carousel")}
                className="gap-2"
              >
                <GalleryHorizontal className="h-4 w-4" />
                <span className="hidden sm:inline">Carrossel</span>
              </Button>
              <Button 
                variant={viewMode === "panorama" ? "default" : "ghost"} 
                size="sm"
                onClick={() => setViewMode("panorama")}
                className="gap-2"
              >
                <LayoutGrid className="h-4 w-4" />
                <span className="hidden sm:inline">Panorama</span>
              </Button>
            </div>

            {isAdmin && (
              <Button variant="outline" onClick={() => setIsEditDialogOpen(true)}>
                <Settings className="h-4 w-4 mr-2" />
                Editar
              </Button>
            )}
          </div>
        </div>

        {/* Carousel View */}
        {viewMode === "carousel" && (
          <div className="px-8">
            <Carousel
              opts={{
                align: "start",
                loop: true,
              }}
              className="w-full"
            >
              <CarouselContent className="-ml-2 md:-ml-4">
                {sortedTutorials.map((video) => (
                  <CarouselItem key={video.id} className="pl-2 md:pl-4 basis-full sm:basis-1/2 lg:basis-1/3 xl:basis-1/4">
                    <VideoCard video={video} compact />
                  </CarouselItem>
                ))}
              </CarouselContent>
              <CarouselPrevious className="-left-4" />
              <CarouselNext className="-right-4" />
            </Carousel>
          </div>
        )}

        {/* Panorama View (Grid) */}
        {viewMode === "panorama" && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {sortedTutorials.map((video) => (
              <VideoCard key={video.id} video={video} />
            ))}
          </div>
        )}

        {/* Empty State */}
        {sortedTutorials.length === 0 && (
          <Card className="p-8">
            <div className="text-center text-muted-foreground">
              <GraduationCap className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Nenhuma aula disponível no momento.</p>
            </div>
          </Card>
        )}

        {/* Video Player Modal */}
        <Dialog open={!!selectedVideo} onOpenChange={() => setSelectedVideo(null)}>
          <DialogContent className="max-w-4xl p-0 overflow-hidden">
            <DialogHeader className="p-4 pb-0">
              <DialogTitle className="flex items-center gap-2">
                <Play className="w-5 h-5 text-primary" />
                {selectedVideo?.title}
              </DialogTitle>
            </DialogHeader>
            <div className="aspect-video">
              {selectedVideo && (
                <iframe
                  src={getEmbedUrl(selectedVideo.videoId)}
                  title={selectedVideo.title}
                  className="w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Edit Dialog (Admin only) */}
        {isAdmin && tutorials && (
          <TutorialEditDialog
            open={isEditDialogOpen}
            onOpenChange={setIsEditDialogOpen}
            tutorials={tutorials}
          />
        )}
      </div>
    </DashboardLayout>
  );
}
