import { useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

// Avatar URLs using DiceBear API for consistent cartoon-style avatars
const maleAvatars = [
  'https://api.dicebear.com/7.x/adventurer/svg?seed=Felix&backgroundColor=b6e3f4',
  'https://api.dicebear.com/7.x/adventurer/svg?seed=John&backgroundColor=c0aede',
  'https://api.dicebear.com/7.x/adventurer/svg?seed=Mike&backgroundColor=d1d4f9',
  'https://api.dicebear.com/7.x/adventurer/svg?seed=Carlos&backgroundColor=ffd5dc',
  'https://api.dicebear.com/7.x/adventurer/svg?seed=Pedro&backgroundColor=ffdfbf',
  'https://api.dicebear.com/7.x/adventurer/svg?seed=Lucas&backgroundColor=c1e1c1',
  'https://api.dicebear.com/7.x/lorelei/svg?seed=Bruno&backgroundColor=b6e3f4',
  'https://api.dicebear.com/7.x/lorelei/svg?seed=Diego&backgroundColor=c0aede',
];

const femaleAvatars = [
  'https://api.dicebear.com/7.x/adventurer/svg?seed=Maria&backgroundColor=ffd5dc',
  'https://api.dicebear.com/7.x/adventurer/svg?seed=Ana&backgroundColor=ffdfbf',
  'https://api.dicebear.com/7.x/adventurer/svg?seed=Julia&backgroundColor=c0aede',
  'https://api.dicebear.com/7.x/adventurer/svg?seed=Carla&backgroundColor=b6e3f4',
  'https://api.dicebear.com/7.x/adventurer/svg?seed=Paula&backgroundColor=d1d4f9',
  'https://api.dicebear.com/7.x/adventurer/svg?seed=Lucia&backgroundColor=c1e1c1',
  'https://api.dicebear.com/7.x/lorelei/svg?seed=Sofia&backgroundColor=ffd5dc',
  'https://api.dicebear.com/7.x/lorelei/svg?seed=Laura&backgroundColor=ffdfbf',
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
