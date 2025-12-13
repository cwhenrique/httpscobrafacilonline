import { useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

// Avatar URLs using DiceBear API - Professional styles (notionists & personas)
const maleAvatars = [
  'https://api.dicebear.com/9.x/notionists/svg?seed=Roberto&backgroundColor=f5f5f5',
  'https://api.dicebear.com/9.x/notionists/svg?seed=Carlos&backgroundColor=e8f5e9',
  'https://api.dicebear.com/9.x/notionists/svg?seed=Fernando&backgroundColor=e3f2fd',
  'https://api.dicebear.com/9.x/notionists/svg?seed=Marcos&backgroundColor=fff3e0',
  'https://api.dicebear.com/9.x/personas/svg?seed=Jose&backgroundColor=f5f5f5',
  'https://api.dicebear.com/9.x/personas/svg?seed=Antonio&backgroundColor=e8f5e9',
  'https://api.dicebear.com/9.x/personas/svg?seed=Paulo&backgroundColor=e3f2fd',
  'https://api.dicebear.com/9.x/personas/svg?seed=Ricardo&backgroundColor=fff3e0',
];

const femaleAvatars = [
  'https://api.dicebear.com/9.x/notionists/svg?seed=Patricia&backgroundColor=fce4ec',
  'https://api.dicebear.com/9.x/notionists/svg?seed=Sandra&backgroundColor=f3e5f5',
  'https://api.dicebear.com/9.x/notionists/svg?seed=Claudia&backgroundColor=e8f5e9',
  'https://api.dicebear.com/9.x/notionists/svg?seed=Fernanda&backgroundColor=e3f2fd',
  'https://api.dicebear.com/9.x/personas/svg?seed=Lucia&backgroundColor=fce4ec',
  'https://api.dicebear.com/9.x/personas/svg?seed=Mariana&backgroundColor=f3e5f5',
  'https://api.dicebear.com/9.x/personas/svg?seed=Beatriz&backgroundColor=e8f5e9',
  'https://api.dicebear.com/9.x/personas/svg?seed=Carolina&backgroundColor=e3f2fd',
];

interface AvatarSelectorProps {
  selectedAvatar: string | null;
  onSelect: (avatarUrl: string) => void;
}

export function AvatarSelector({ selectedAvatar, onSelect }: AvatarSelectorProps) {
  const [gender, setGender] = useState<'male' | 'female'>('male');

  const avatars = gender === 'male' ? maleAvatars : femaleAvatars;

  return (
    <div className="space-y-4">
      <Tabs value={gender} onValueChange={(v) => setGender(v as 'male' | 'female')} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="male">Masculino</TabsTrigger>
          <TabsTrigger value="female">Feminino</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="grid grid-cols-4 gap-3">
        {avatars.map((avatarUrl, index) => (
          <button
            key={index}
            type="button"
            onClick={() => onSelect(avatarUrl)}
            className={cn(
              "relative rounded-full p-1 transition-all hover:scale-105 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
              selectedAvatar === avatarUrl && "ring-2 ring-primary ring-offset-2"
            )}
          >
            <Avatar className="w-14 h-14 sm:w-16 sm:h-16">
              <AvatarImage src={avatarUrl} alt={`Avatar ${index + 1}`} />
              <AvatarFallback>AV</AvatarFallback>
            </Avatar>
            {selectedAvatar === avatarUrl && (
              <div className="absolute -bottom-1 -right-1 bg-primary text-primary-foreground rounded-full p-0.5">
                <Check className="w-3 h-3" />
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
