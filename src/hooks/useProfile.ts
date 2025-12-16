import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface Profile {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  company_name: string | null;
  subscription_plan: string | null;
  subscription_expires_at: string | null;
  is_active: boolean;
  // WhatsApp client notification configuration
  evolution_api_url: string | null;
  evolution_api_key: string | null;
  evolution_instance_name: string | null;
  whatsapp_to_clients_enabled: boolean;
  // WhatsApp QR code connection
  whatsapp_instance_id: string | null;
  whatsapp_connected_at: string | null;
  whatsapp_connected_phone: string | null;
}

export function useProfile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async () => {
    if (!user) {
      setProfile(null);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    if (error) {
      console.error('Error fetching profile:', error);
    }

    setProfile(data);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const isProfileComplete = (): boolean => {
    if (!profile) return false;
    return !!(
      profile.full_name?.trim() &&
      profile.phone?.trim()
    );
  };

  const updateProfile = async (updates: Partial<Profile>) => {
    if (!user) return { error: new Error('User not authenticated') };

    const { error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', user.id);

    if (!error) {
      await fetchProfile();
    }

    return { error };
  };

  return {
    profile,
    loading,
    isProfileComplete: isProfileComplete(),
    updateProfile,
    refetch: fetchProfile,
  };
}
