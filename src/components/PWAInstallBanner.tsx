import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Download, X, Smartphone, Share, MoreVertical } from "lucide-react";
import { Link } from "react-router-dom";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

interface PWAInstallBannerProps {
  variant?: "sidebar" | "card";
}

export function PWAInstallBanner({ variant = "card" }: PWAInstallBannerProps) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Check if already dismissed
    const dismissed = localStorage.getItem("pwa-banner-dismissed");
    if (dismissed) {
      setIsDismissed(true);
    }

    // Check if already installed
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
    }

    // Check if iOS
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent);
    setIsIOS(isIOSDevice);

    // Listen for the beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    // Listen for app installed event
    window.addEventListener("appinstalled", () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    });

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === "accepted") {
      setIsInstalled(true);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setIsDismissed(true);
    localStorage.setItem("pwa-banner-dismissed", "true");
  };

  // Don't show if installed or dismissed (except for sidebar which always shows)
  if (isInstalled || (isDismissed && variant !== "sidebar")) {
    return null;
  }

  // Sidebar variant - compact
  if (variant === "sidebar") {
    return (
      <div className="mx-3 mb-4">
        <div className="relative p-3 rounded-xl bg-gradient-to-r from-primary/20 to-primary/5 border border-primary/30">
          <button
            onClick={handleDismiss}
            className="absolute top-2 right-2 p-1 rounded-full hover:bg-primary/20 transition-colors"
            aria-label="Fechar"
          >
            <X className="w-3 h-3 text-primary/70" />
          </button>
          
          <div className="flex items-center gap-3 pr-4">
            <div className="w-9 h-9 rounded-lg bg-primary/20 flex items-center justify-center flex-shrink-0">
              <Smartphone className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-sidebar-foreground">Instale o App</p>
              <p className="text-[10px] text-sidebar-foreground/60 leading-tight">
                {isIOS ? "Adicione à tela inicial" : "Acesso rápido no celular"}
              </p>
            </div>
          </div>
          
          {deferredPrompt ? (
            <Button
              onClick={handleInstallClick}
              size="sm"
              className="w-full mt-2 h-8 text-xs"
            >
              <Download className="w-3 h-3 mr-1" />
              Instalar
            </Button>
          ) : (
            <Link to="/install" className="block mt-2">
              <Button size="sm" variant="outline" className="w-full h-8 text-xs border-primary/30 text-primary hover:bg-primary/10">
                {isIOS ? (
                  <>
                    <Share className="w-3 h-3 mr-1" />
                    Ver instruções
                  </>
                ) : (
                  <>
                    <MoreVertical className="w-3 h-3 mr-1" />
                    Ver instruções
                  </>
                )}
              </Button>
            </Link>
          )}
        </div>
      </div>
    );
  }

  // Card variant - dashboard
  return (
    <Card className="shadow-soft border-primary/30 bg-gradient-to-r from-primary/10 to-primary/5 relative overflow-hidden">
      <button
        onClick={handleDismiss}
        className="absolute top-3 right-3 p-1.5 rounded-full hover:bg-primary/20 transition-colors z-10"
        aria-label="Fechar"
      >
        <X className="w-4 h-4 text-primary/70" />
      </button>
      
      <CardContent className="p-4 md:p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center flex-shrink-0">
            <Smartphone className="w-6 h-6 text-primary" />
          </div>
          
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-foreground mb-1">
              Instale o CobraFácil no seu celular
            </h3>
            <p className="text-sm text-muted-foreground">
              {isIOS 
                ? "Adicione à tela inicial para acesso rápido, funciona offline e como um app nativo!"
                : "Tenha acesso rápido direto da tela inicial, funciona offline e como um app nativo!"
              }
            </p>
          </div>
          
          <div className="flex gap-2 w-full sm:w-auto">
            {deferredPrompt ? (
              <Button onClick={handleInstallClick} className="flex-1 sm:flex-none">
                <Download className="w-4 h-4 mr-2" />
                Instalar Agora
              </Button>
            ) : (
              <Link to="/install" className="flex-1 sm:flex-none">
                <Button variant="outline" className="w-full border-primary/30 text-primary hover:bg-primary/10">
                  {isIOS ? (
                    <>
                      <Share className="w-4 h-4 mr-2" />
                      Ver instruções
                    </>
                  ) : (
                    <>
                      <MoreVertical className="w-4 h-4 mr-2" />
                      Ver instruções
                    </>
                  )}
                </Button>
              </Link>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
