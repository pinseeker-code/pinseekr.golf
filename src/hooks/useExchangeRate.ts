import { useState, useEffect, useCallback } from 'react';
import type { Currency } from '@/lib/golf/expenseTypes';

interface ExchangeRates {
  btcToUsd: number;
  usdToCad: number;
  usdToEur: number;
  usdToGbp: number;
  usdToAud: number;
  usdToMxn: number;
}

interface UseExchangeRateReturn {
  rates: ExchangeRates | null;
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  convertToSats: (amount: number, currency: Currency) => number;
  convertFromSats: (sats: number, currency: Currency) => number;
  formatCurrency: (amount: number, currency: Currency) => string;
  refresh: () => Promise<void>;
}

// Default rates as fallback (will be updated from API)
const DEFAULT_RATES: ExchangeRates = {
  btcToUsd: 100000, // 1 BTC = $100,000 (fallback)
  usdToCad: 1.36,
  usdToEur: 0.92,
  usdToGbp: 0.79,
  usdToAud: 1.55,
  usdToMxn: 17.5,
};

const CACHE_KEY = 'pinseekr_exchange_rates';
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export function useExchangeRate(): UseExchangeRateReturn {
  const [rates, setRates] = useState<ExchangeRates | null>(() => {
    // Try to load from cache
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const { rates, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < CACHE_DURATION) {
          return rates;
        }
      }
    } catch {
      // Ignore cache errors
    }
    return DEFAULT_RATES;
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchRates = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Fetch BTC price from CoinGecko (free, no API key required)
      const btcResponse = await fetch(
        'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd,cad,eur,gbp,aud,mxn',
        { signal: AbortSignal.timeout(5000) }
      );

      if (!btcResponse.ok) {
        throw new Error('Failed to fetch BTC price');
      }

      const btcData = await btcResponse.json();
      const btcPrices = btcData.bitcoin;

      const newRates: ExchangeRates = {
        btcToUsd: btcPrices.usd || DEFAULT_RATES.btcToUsd,
        usdToCad: btcPrices.cad / btcPrices.usd || DEFAULT_RATES.usdToCad,
        usdToEur: btcPrices.eur / btcPrices.usd || DEFAULT_RATES.usdToEur,
        usdToGbp: btcPrices.gbp / btcPrices.usd || DEFAULT_RATES.usdToGbp,
        usdToAud: btcPrices.aud / btcPrices.usd || DEFAULT_RATES.usdToAud,
        usdToMxn: btcPrices.mxn / btcPrices.usd || DEFAULT_RATES.usdToMxn,
      };

      setRates(newRates);
      setLastUpdated(new Date());

      // Cache the rates
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify({
          rates: newRates,
          timestamp: Date.now(),
        }));
      } catch {
        // Ignore cache write errors
      }
    } catch (err) {
      console.warn('Failed to fetch exchange rates, using fallback:', err);
      setError('Using cached rates');
      // Keep using existing rates or defaults
      if (!rates) {
        setRates(DEFAULT_RATES);
      }
    } finally {
      setLoading(false);
    }
  }, [rates]);

  // Fetch rates on mount
  useEffect(() => {
    fetchRates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Convert any currency amount to sats
  const convertToSats = useCallback((amount: number, currency: Currency): number => {
    if (!rates || amount === 0) return 0;
    
    if (currency === 'sats') {
      return Math.round(amount);
    }

    // Convert to USD first
    let usdAmount = amount;
    switch (currency) {
      case 'CAD':
        usdAmount = amount / rates.usdToCad;
        break;
      case 'EUR':
        usdAmount = amount / rates.usdToEur;
        break;
      case 'GBP':
        usdAmount = amount / rates.usdToGbp;
        break;
      case 'AUD':
        usdAmount = amount / rates.usdToAud;
        break;
      case 'MXN':
        usdAmount = amount / rates.usdToMxn;
        break;
      case 'USD':
      default:
        usdAmount = amount;
    }

    // Convert USD to sats (100,000,000 sats = 1 BTC)
    const btcAmount = usdAmount / rates.btcToUsd;
    const sats = btcAmount * 100_000_000;
    
    return Math.round(sats);
  }, [rates]);

  // Convert sats to any currency
  const convertFromSats = useCallback((sats: number, currency: Currency): number => {
    if (!rates || sats === 0) return 0;
    
    if (currency === 'sats') {
      return sats;
    }

    // Convert sats to USD
    const btcAmount = sats / 100_000_000;
    const usdAmount = btcAmount * rates.btcToUsd;

    // Convert USD to target currency
    switch (currency) {
      case 'CAD':
        return usdAmount * rates.usdToCad;
      case 'EUR':
        return usdAmount * rates.usdToEur;
      case 'GBP':
        return usdAmount * rates.usdToGbp;
      case 'AUD':
        return usdAmount * rates.usdToAud;
      case 'MXN':
        return usdAmount * rates.usdToMxn;
      case 'USD':
      default:
        return usdAmount;
    }
  }, [rates]);

  // Format currency for display
  const formatCurrency = useCallback((amount: number, currency: Currency): string => {
    if (currency === 'sats') {
      return `${Math.round(amount).toLocaleString()} sats`;
    }

    const formatter = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

    return formatter.format(amount);
  }, []);

  return {
    rates,
    loading,
    error,
    lastUpdated,
    convertToSats,
    convertFromSats,
    formatCurrency,
    refresh: fetchRates,
  };
}
