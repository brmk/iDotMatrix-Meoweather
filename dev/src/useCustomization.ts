import type { Customization } from '@src/customization/schema';
import { useCallback, useEffect, useState } from 'react';

export type SaveStatus = 'saved' | 'unsaved' | 'saving' | 'error';

export interface UseCustomizationResult {
  customization: Customization | null;
  saveStatus: SaveStatus;
  markUnsaved: () => void;
  save: (patch: Partial<Customization>) => Promise<Customization | null>;
  reset: () => Promise<Customization | null>;
}

export function useCustomization(): UseCustomizationResult {
  const [customization, setCustomization] = useState<Customization | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');

  useEffect(() => {
    fetch('/api/customization')
      .then((r) => r.json() as Promise<Customization>)
      .then((c) => {
        setCustomization(c);
        setSaveStatus('saved');
      })
      .catch(console.error);
  }, []);

  const markUnsaved = useCallback(() => setSaveStatus('unsaved'), []);

  const save = useCallback(async (patch: Partial<Customization>): Promise<Customization | null> => {
    setSaveStatus('saving');
    try {
      const res = await fetch('/api/customization', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error(await res.text());
      const saved = (await res.json()) as Customization;
      setCustomization(saved);
      setSaveStatus('saved');
      return saved;
    } catch (e) {
      console.error(e);
      setSaveStatus('error');
      return null;
    }
  }, []);

  const reset = useCallback(async (): Promise<Customization | null> => {
    setSaveStatus('saving');
    try {
      const res = await fetch('/api/customization/reset', { method: 'POST' });
      if (!res.ok) throw new Error(await res.text());
      const defaults = (await res.json()) as Customization;
      setCustomization(defaults);
      setSaveStatus('saved');
      return defaults;
    } catch (e) {
      console.error(e);
      setSaveStatus('error');
      return null;
    }
  }, []);

  return { customization, saveStatus, markUnsaved, save, reset };
}
