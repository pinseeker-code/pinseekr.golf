import { Check, ChevronsUpDown, Wifi, Plus, RefreshCw, Radio } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useState, useEffect } from "react";
import { useAppContext } from "@/hooks/useAppContext";
import { fetchRelayDiscovery, type DiscoveredRelay } from '@/lib/relayDiscovery';

interface RelaySelectorProps {
  className?: string;
}

export function RelaySelector(props: RelaySelectorProps) {
  const { className } = props;
  const { config, updateConfig, presetRelays = [] } = useAppContext();
  
  const selectedRelay = config.relayUrl;
  const setSelectedRelay = (relay: string) => {
    updateConfig((current) => ({ ...current, relayUrl: relay }));
  };

  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [discovered, setDiscovered] = useState<DiscoveredRelay[]>([]);

  // Extract host from relay URL for discovery
  const relayHost = (() => {
    try { return new URL(config.relayUrl).host; } catch { return config.relayUrl; }
  })();

  // Auto-discover Pyramid sub-relays on mount/relay change
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const rels = await fetchRelayDiscovery(relayHost);
        if (!mounted) return;
        setDiscovered(rels);
      } catch {
        // ignore
      }
    })();
    return () => { mounted = false; };
  }, [relayHost]);

  const selectedOption = presetRelays.find((option) => option.url === selectedRelay);

  // Function to normalize relay URL by adding wss:// if no protocol is present
  const normalizeRelayUrl = (url: string): string => {
    const trimmed = url.trim();
    if (!trimmed) return trimmed;
    
    // Check if it already has a protocol
    if (trimmed.includes('://')) {
      return trimmed;
    }
    
    // Add wss:// prefix
    return `wss://${trimmed}`;
  };

  // Handle adding a custom relay
  const handleAddCustomRelay = (url: string) => {
    setSelectedRelay?.(normalizeRelayUrl(url));
    setOpen(false);
    setInputValue("");
  };

  // Check if input value looks like a valid relay URL
  const isValidRelayInput = (value: string): boolean => {
    const trimmed = value.trim();
    if (!trimmed) return false;
    
    // Basic validation - should contain at least a domain-like structure
    const normalized = normalizeRelayUrl(trimmed);
    try {
      new URL(normalized);
      return true;
    } catch {
      return false;
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("justify-between", className)}
        >
          <div className="flex items-center gap-2">
            <Wifi className="h-4 w-4" />
            <span className="truncate">
              {selectedOption 
                ? selectedOption.name 
                : selectedRelay 
                  ? selectedRelay.replace(/^wss?:\/\//, '')
                  : "Select relay..."
              }
            </span>
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0">
        <Command>
          <CommandInput 
            placeholder="Search relays or type URL..." 
            value={inputValue}
            onValueChange={setInputValue}
          />
          <CommandList>
            <CommandEmpty>
              {inputValue && isValidRelayInput(inputValue) ? (
                <CommandItem
                  onSelect={() => handleAddCustomRelay(inputValue)}
                  className="cursor-pointer"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  <div className="flex flex-col">
                    <span className="font-medium">Add custom relay</span>
                    <span className="text-xs text-muted-foreground">
                      {normalizeRelayUrl(inputValue)}
                    </span>
                  </div>
                </CommandItem>
              ) : (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  {inputValue ? "Invalid relay URL" : "No relay found."}
                </div>
              )}
            </CommandEmpty>
            <CommandGroup>
              {discovered.length > 0 && (
                <div className="px-3 py-2 border-b">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-semibold">Discovered relays</div>
                    <Button size="sm" variant="ghost" onClick={async () => {
                      const host = relayHost;
                      const rels = await fetchRelayDiscovery(host);
                      setDiscovered(rels);
                    }}>
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
              {presetRelays
                .filter((option) => 
                  !inputValue || 
                  option.name.toLowerCase().includes(inputValue.toLowerCase()) ||
                  option.url.toLowerCase().includes(inputValue.toLowerCase())
                )
                .map((option) => (
                  <CommandItem
                    key={option.url}
                    value={option.url}
                    onSelect={(currentValue) => {
                      setSelectedRelay(normalizeRelayUrl(currentValue));
                      setOpen(false);
                      setInputValue("");
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        selectedRelay === option.url ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <div className="flex flex-col">
                      <span className="font-medium">{option.name}</span>
                      <span className="text-xs text-muted-foreground">{option.url}</span>
                    </div>
                  </CommandItem>
                ))}
              {discovered.map((r) => (
                <CommandItem key={r.url} value={r.url} className="cursor-default" onSelect={() => {}}>
                  <div className="flex items-center gap-2 w-full">
                    <Radio className="h-3 w-3 text-green-500" />
                    <div className="flex flex-col text-left flex-1">
                      <span className="font-medium text-sm">{r.url.replace(/^wss?:\/\//, '')}</span>
                      <span className="text-xs text-muted-foreground">{r.role ?? 'sub-relay'}{r.members_only ? ' · members only' : ''}</span>
                    </div>
                  </div>
                </CommandItem>
              ))}
              {inputValue && isValidRelayInput(inputValue) && (
                <CommandItem
                  onSelect={() => handleAddCustomRelay(inputValue)}
                  className="cursor-pointer border-t"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  <div className="flex flex-col">
                    <span className="font-medium">Add custom relay</span>
                    <span className="text-xs text-muted-foreground">
                      {normalizeRelayUrl(inputValue)}
                    </span>
                  </div>
                </CommandItem>
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}