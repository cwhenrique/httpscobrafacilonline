import { useState, useEffect, useMemo } from 'react';
import { useProfile } from '@/hooks/useProfile';
import { supabase } from '@/integrations/supabase/client';

export interface AffiliateLinks {
  monthly: string;
  quarterly: string;
  annual: string;
  lifetime: string;
}

interface AffiliateData {
  link_mensal: string;
  link_trimestral: string;
  link_anual: string;
}

// Default links (no affiliate)
export const DEFAULT_AFFILIATE_LINKS: AffiliateLinks = {
  monthly: "https://pay.cakto.com.br/ej757ic",
  quarterly: "https://pay.cakto.com.br/3823rxj",
  annual: "https://pay.cakto.com.br/j35f794",
  lifetime: "https://pay.cakto.com.br/PLACEHOLDER_LIFETIME",
};

// Renewal-specific links (with ?SCK=renew)
export const DEFAULT_RENEWAL_LINKS: AffiliateLinks = {
  monthly: "https://pay.cakto.com.br/ej757ic?SCK=renew",
  quarterly: "https://pay.cakto.com.br/eb6ern9?SCK=renew",
  annual: "https://pay.cakto.com.br/fhwfptb?SCK=renew",
  lifetime: "https://pay.cakto.com.br/PLACEHOLDER_LIFETIME?SCK=renew",
};

interface UseAffiliateLinksResult {
  links: AffiliateLinks;
  renewalLinks: AffiliateLinks;
  loading: boolean;
  hasAffiliate: boolean;
}

export function useAffiliateLinks(): UseAffiliateLinksResult {
  const { profile, loading: profileLoading } = useProfile();
  const [affiliateData, setAffiliateData] = useState<AffiliateData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAffiliateLinks = async () => {
      if (profileLoading) return;
      
      if (!profile?.affiliate_email) {
        setAffiliateData(null);
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('affiliates')
          .select('link_mensal, link_trimestral, link_anual')
          .eq('email', profile.affiliate_email)
          .eq('is_active', true)
          .maybeSingle();

        if (error) {
          console.error('Error fetching affiliate links:', error);
          setAffiliateData(null);
        } else {
          setAffiliateData(data);
        }
      } catch (err) {
        console.error('Exception fetching affiliate links:', err);
        setAffiliateData(null);
      } finally {
        setLoading(false);
      }
    };

    fetchAffiliateLinks();
  }, [profile?.affiliate_email, profileLoading]);

  // Build affiliate links from data
  const links = useMemo((): AffiliateLinks => {
    if (affiliateData) {
      return {
        monthly: affiliateData.link_mensal,
        quarterly: affiliateData.link_trimestral,
        annual: affiliateData.link_anual,
        lifetime: DEFAULT_AFFILIATE_LINKS.lifetime,
      };
    }
    return DEFAULT_AFFILIATE_LINKS;
  }, [affiliateData]);

  // Renewal links are the same as regular links for affiliates
  // For non-affiliates, use the renewal-specific defaults
  const renewalLinks = useMemo((): AffiliateLinks => {
    if (affiliateData) {
      return {
        monthly: affiliateData.link_mensal,
        quarterly: affiliateData.link_trimestral,
        annual: affiliateData.link_anual,
        lifetime: DEFAULT_AFFILIATE_LINKS.lifetime,
      };
    }
    return DEFAULT_RENEWAL_LINKS;
  }, [affiliateData]);

  return {
    links,
    renewalLinks,
    loading: loading || profileLoading,
    hasAffiliate: !!affiliateData,
  };
}
