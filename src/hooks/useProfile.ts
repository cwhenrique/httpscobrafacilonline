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
  trial_expires_at: string | null;
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
  // Voice assistant
  voice_assistant_enabled: boolean;
  // Payment link
  payment_link: string | null;
  // PIX key
  pix_key: string | null;
  pix_key_type: string | null;
  // PIX pre-message
  pix_pre_message: string | null;
  // Billing signature name
  billing_signature_name: string | null;
  // Company logo for PDFs
  company_logo_url: string | null;
  // Employee management feature
  employees_feature_enabled: boolean;
  max_employees: number;
  // Cash flow feature
  cash_flow_initial_balance: number | null;
  // Affiliate
  affiliate_email: string | null;
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

    try {
      // Usar edge function para atualização auditada
      const { data, error } = await supabase.functions.invoke('update-profile-audited', {
        body: {
          updates,
          userAgent: navigator.userAgent,
        },
      });

      if (error) {
        console.error('Error updating profile via edge function:', error);
        return { error };
      }

      if (data?.error) {
        return { error: new Error(data.error) };
      }

      await fetchProfile();
      return { error: null };
    } catch (err) {
      console.error('Exception updating profile:', err);
      return { error: err as Error };
    }
  };

  return {
    profile,
    loading,
    isProfileComplete: isProfileComplete(),
    updateProfile,
    refetch: fetchProfile,
  };
}
