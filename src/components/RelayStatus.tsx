import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAppContext } from '@/hooks/useAppContext';
import { RotateCcw } from 'lucide-react';
import { useToast } from '@/hooks/useToast';

export default function RelayStatus() {
  const { config, presetRelays, updateConfig } = useAppContext();
  const { toast } = useToast();

  const handleReset = () => {
    updateConfig((current) => ({ ...current, relayUrl: 'wss://relay.pinseekr.golf' }));
    toast({
      title: 'Reset to defaults',
      description: 'Primary relay set to wss://relay.pinseekr.golf. Reload the page to apply.',
    });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Relay Status</CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={handleReset}
            className="gap-2"
          >
            <RotateCcw className="h-4 w-4" />
            Reset
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 text-sm">
          <div>
            <strong>Primary relay:</strong> <code className="text-xs bg-muted px-1 rounded">{config?.relayUrl}</code>
          </div>
          <div>
            <strong>Fallback relays:</strong>
            <ul className="list-disc pl-5 mt-1">
              {presetRelays?.filter(r => r.url !== config?.relayUrl).map((r) => (
                <li key={r.url}>
                  <code className="text-xs">{r.url}</code>
                  <span className="text-muted-foreground ml-2">({r.name})</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
