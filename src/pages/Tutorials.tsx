import { useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { GraduationCap, Play, Clock, Filter } from 'lucide-react';

interface TutorialVideo {
  id: string;
  videoId: string;
  title: string;
  description: string;
  category: string;
  duration: string;
}

// Lista de vídeos tutoriais - adicione seus vídeos aqui
const tutorialVideos: TutorialVideo[] = [
  {
    id: "1",
    videoId: "dQw4w9WgXcQ", // Substitua pelo ID real do vídeo
    title: "Primeiros Passos",
    description: "Aprenda a configurar sua conta e começar a usar o CobraFácil",
    category: "Início",
    duration: "5:00"
  },
  {
    id: "2",
    videoId: "dQw4w9WgXcQ", // Substitua pelo ID real do vídeo
    title: "Como Criar um Empréstimo",
    description: "Tutorial completo sobre criação de empréstimos parcelados e de pagamento único",
    category: "Empréstimos",
    duration: "8:30"
  },
  {
    id: "3",
    videoId: "dQw4w9WgXcQ", // Substitua pelo ID real do vídeo
    title: "Cadastrando Clientes",
    description: "Aprenda a cadastrar clientes e gerenciar suas informações",
    category: "Clientes",
    duration: "4:15"
  },
  {
    id: "4",
    videoId: "dQw4w9WgXcQ", // Substitua pelo ID real do vídeo
    title: "Recebendo Pagamentos",
    description: "Como registrar pagamentos e gerenciar parcelas",
    category: "Empréstimos",
    duration: "6:45"
  },
  {
    id: "5",
    videoId: "dQw4w9WgXcQ", // Substitua pelo ID real do vídeo
    title: "Configurando WhatsApp",
    description: "Conecte seu WhatsApp e envie notificações automáticas",
    category: "WhatsApp",
    duration: "7:20"
  },
  {
    id: "6",
    videoId: "dQw4w9WgXcQ", // Substitua pelo ID real do vídeo
    title: "Vendas de Produtos",
    description: "Como registrar vendas parceladas de produtos",
    category: "Vendas",
    duration: "5:50"
  },
  {
    id: "7",
    videoId: "dQw4w9WgXcQ", // Substitua pelo ID real do vídeo
    title: "Entendendo Relatórios",
    description: "Visualize e analise seus relatórios financeiros",
    category: "Relatórios",
    duration: "6:00"
  },
  {
    id: "8",
    videoId: "dQw4w9WgXcQ", // Substitua pelo ID real do vídeo
    title: "Score de Clientes",
    description: "Como funciona o sistema de pontuação de clientes",
    category: "Clientes",
    duration: "4:30"
  },
];

const categories = ["Todos", "Início", "Empréstimos", "Clientes", "Vendas", "WhatsApp", "Relatórios"];

export default function Tutorials() {
  const [selectedCategory, setSelectedCategory] = useState("Todos");
  const [selectedVideo, setSelectedVideo] = useState<TutorialVideo | null>(null);

  const filteredVideos = selectedCategory === "Todos" 
    ? tutorialVideos 
    : tutorialVideos.filter(v => v.category === selectedCategory);

  const getThumbnail = (videoId: string) => 
    `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;

  const getEmbedUrl = (videoId: string) => 
    `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-2">
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
        </div>

        {/* Category Filter */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 flex-wrap">
              <Filter className="w-4 h-4 text-muted-foreground" />
              {categories.map((category) => (
                <Button
                  key={category}
                  variant={selectedCategory === category ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedCategory(category)}
                  className="rounded-full"
                >
                  {category}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Videos Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredVideos.map((video) => (
            <Card 
              key={video.id} 
              className="overflow-hidden hover:shadow-lg transition-all duration-300 cursor-pointer group"
              onClick={() => setSelectedVideo(video)}
            >
              {/* Thumbnail */}
              <div className="relative aspect-video overflow-hidden bg-muted">
                <img
                  src={getThumbnail(video.videoId)}
                  alt={video.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  onError={(e) => {
                    // Fallback para thumbnail de menor qualidade
                    e.currentTarget.src = `https://img.youtube.com/vi/${video.videoId}/hqdefault.jpg`;
                  }}
                />
                {/* Play Button Overlay */}
                <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <div className="w-14 h-14 rounded-full bg-primary flex items-center justify-center">
                    <Play className="w-6 h-6 text-primary-foreground ml-1" fill="currentColor" />
                  </div>
                </div>
                {/* Duration Badge */}
                <Badge 
                  variant="secondary" 
                  className="absolute bottom-2 right-2 bg-black/80 text-white border-0"
                >
                  <Clock className="w-3 h-3 mr-1" />
                  {video.duration}
                </Badge>
              </div>

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
            </Card>
          ))}
        </div>

        {/* Empty State */}
        {filteredVideos.length === 0 && (
          <Card className="p-8">
            <div className="text-center text-muted-foreground">
              <GraduationCap className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum vídeo encontrado para esta categoria.</p>
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
      </div>
    </DashboardLayout>
  );
}
