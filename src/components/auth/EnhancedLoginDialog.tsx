import React, { useRef, useState, useEffect } from 'react';
import { Shield, Upload, AlertTriangle, KeyRound, QrCode, Copy, Loader, Sparkles, Puzzle } from 'lucide-react';
import QRCode from 'qrcode';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useLoginActions } from '@/hooks/useLoginActions';
import { useNostr } from '@nostrify/react';
import { cn } from '@/lib/utils';

interface EnhancedLoginDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onLogin: () => void;
  onSignup?: () => void;
}

// NIP-46 relays - use the same relays that Amber and other signers connect to
const NIP46_RELAYS = [
  'wss://relay.nsec.app',      // Primary NIP-46 relay (most signers use this)
  'wss://relay.damus.io',      // Popular relay
  'wss://nos.lol',             // Popular relay  
  'wss://relay.pinseekr.golf', // Our relay
];

type LoginTab = 'extension' | 'privatekey' | 'remote';

const validateNsec = (nsec: string) => {
  return /^nsec1[a-zA-Z0-9]{58}$/.test(nsec);
};

const validateBunkerUri = (uri: string) => {
  return uri.startsWith('bunker://');
};

export const EnhancedLoginDialog: React.FC<EnhancedLoginDialogProps> = ({ 
  isOpen, 
  onClose, 
  onLogin,
  onSignup
}) => {
  const { nostr } = useNostr();
  const [activeTab, setActiveTab] = useState<LoginTab>('extension');
  const [isLoading, setIsLoading] = useState(false);
  const [isFileLoading, setIsFileLoading] = useState(false);
  const [nsec, setNsec] = useState('');
  const [bunkerUri, setBunkerUri] = useState('');
  const [showQrCode, setShowQrCode] = useState(false);
  const [connectionString, setConnectionString] = useState('');
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState('');
  const [isWaitingForAuth, setIsWaitingForAuth] = useState(false);
  const [_connectSecret, setConnectSecret] = useState('');
  const [_clientSecretKey, setClientSecretKey] = useState<Uint8Array | null>(null);
  const [errors, setErrors] = useState<{
    nsec?: string;
    bunker?: string;
    file?: string;
    extension?: string;
  }>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const login = useLoginActions();

  // Reset all state when dialog opens/closes
  useEffect(() => {
    if (isOpen) {
      setActiveTab('extension');
      setIsLoading(false);
      setIsFileLoading(false);
      setNsec('');
      setBunkerUri('');
      setShowQrCode(false);
      setConnectionString('');
      setQrCodeDataUrl('');
      setIsWaitingForAuth(false);
      setConnectSecret('');
      setClientSecretKey(null);
      setErrors({});
      // Abort any in-progress connection attempts
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }, [isOpen]);

  // Generate connection string, QR code, and START LISTENING immediately (Grimoire pattern)
  useEffect(() => {
    if (showQrCode && !connectionString) {
      const initializeConnection = async () => {
        try {
          const { generateSecretKey, getPublicKey, nip19 } = await import('nostr-tools');
          const nostrifyModule = await import('@nostrify/nostrify');
          const { NSecSigner, NConnectSigner, NSchema } = nostrifyModule;
          
          // 1. Generate client keypair
          const secretKey = generateSecretKey();
          const pubkey = getPublicKey(secretKey);
          
          // 2. Generate random secret
          const randomBytes = new Uint8Array(8);
          crypto.getRandomValues(randomBytes);
          const secret = Array.from(randomBytes).map(b => b.toString(16).padStart(2, '0')).join('');
          
          setConnectSecret(secret);
          setClientSecretKey(secretKey);
          
          // 3. Build nostrconnect:// URI
          const params = new URLSearchParams();
          NIP46_RELAYS.forEach(relay => params.append('relay', relay));
          params.append('secret', secret);
          params.append('name', 'pinseekr.golf');
          params.append('url', 'https://pinseekr.golf');
          params.append('perms', 'sign_event,nip44_encrypt,nip44_decrypt,get_public_key');
          
          const realConnectionString = `nostrconnect://${pubkey}?${params.toString()}`;
          setConnectionString(realConnectionString);
          console.log('[NIP-46] Generated nostrconnect URI:', realConnectionString);

          // 4. Generate QR code
          const qrUrl = await QRCode.toDataURL(realConnectionString, {
            width: 280,
            margin: 4,
            color: { dark: '#000000', light: '#FFFFFF' }
          });
          setQrCodeDataUrl(qrUrl);

          // 5. START LISTENING IMMEDIATELY (before user scans)
          setIsWaitingForAuth(true);
          setIsLoading(true);
          
          const controller = new AbortController();
          abortControllerRef.current = controller;
          
          const clientSigner = new NSecSigner(secretKey);
          console.log('[NIP-46] Listening for connect response (auto-started)...');
          console.log('[NIP-46] Client pubkey:', pubkey);
          
          // Set 2 minute timeout
          const timeout = setTimeout(() => {
            controller.abort();
          }, 120000);

          // Subscribe to kind 24133 events
          const subscription = nostr.req(
            [{ kinds: [24133], '#p': [pubkey], limit: 10 }],
            { signal: controller.signal }
          );

          for await (const msg of subscription) {
            if (msg[0] === 'CLOSED') {
              console.log('[NIP-46] Subscription closed');
              break;
            }
            
            if (msg[0] === 'EVENT') {
              const event = msg[2];
              console.log('[NIP-46] Received event from:', event.pubkey);
              
              try {
                const decrypted = await clientSigner.nip44.decrypt(event.pubkey, event.content);
                console.log('[NIP-46] Decrypted response:', decrypted);
                
                const response = NSchema.json().pipe(NSchema.connectResponse()).parse(decrypted);
                console.log('[NIP-46] Parsed response:', response);
                
                if (response.result === secret || response.result === 'ack') {
                  console.log('[NIP-46] Connection confirmed! Remote signer pubkey:', event.pubkey);
                  clearTimeout(timeout);
                  
                  // Create bunker URI
                  const clientNsec = nip19.nsecEncode(secretKey);
                  const bunkerUriResult = `bunker://${event.pubkey}?relay=wss%3A%2F%2Frelay.nsec.app&secret=${encodeURIComponent(clientNsec)}`;
                  
                  // Get user pubkey via established connection
                  const signer = new NConnectSigner({
                    relay: nostr,
                    pubkey: event.pubkey,
                    signer: clientSigner,
                    timeout: 30000
                  });
                  
                  const userPubkey = await signer.getPublicKey();
                  console.log('[NIP-46] User pubkey:', userPubkey);
                  
                  // Login
                  await login.bunker(bunkerUriResult);
                  
                  setIsWaitingForAuth(false);
                  setIsLoading(false);
                  onLogin();
                  onClose();
                  return;
                }
              } catch (err) {
                console.log('[NIP-46] Failed to process event:', err);
              }
            }
          }
          
          throw new Error('Connection timed out. Please try again.');
          
        } catch (error) {
          if ((error as Error).name === 'AbortError') {
            console.log('[NIP-46] Connection cancelled');
          } else {
            console.error('[NIP-46] Connection failed:', error);
            setErrors(prev => ({ 
              ...prev, 
              extension: error instanceof Error ? error.message : 'Connection failed. Please try again.' 
            }));
          }
          setIsWaitingForAuth(false);
          setIsLoading(false);
        }
      };
      
      initializeConnection();
    }
  }, [showQrCode, connectionString, nostr, login, onLogin, onClose]);

  const handleExtensionLogin = async () => {
    setIsLoading(true);
    setErrors(prev => ({ ...prev, extension: undefined }));

    try {
      if (!('nostr' in window)) {
        throw new Error('No Nostr extension found. Install nos2x, Alby, or similar.');
      }
      await login.extension();
      onLogin();
      onClose();
    } catch (e: unknown) {
      const error = e as Error;
      console.error('Extension login failed:', error);
      setErrors(prev => ({
        ...prev,
        extension: error instanceof Error ? error.message : 'Extension login failed'
      }));
    } finally {
      setIsLoading(false);
    }
  };

  const copyConnectionString = async () => {
    try {
      await navigator.clipboard.writeText(connectionString);
    } catch (err) {
      console.error('Failed to copy connection string:', err);
    }
  };

  const executeLogin = (key: string) => {
    setIsLoading(true);
    setErrors({});

    setTimeout(() => {
      try {
        login.nsec(key);
        onLogin();
        onClose();
      } catch {
        setErrors({ nsec: "Failed to login with this key. Please check that it's correct." });
        setIsLoading(false);
      }
    }, 50);
  };

  const handleKeyLogin = () => {
    if (!nsec.trim()) {
      setErrors(prev => ({ ...prev, nsec: 'Please enter your private key' }));
      return;
    }

    if (!validateNsec(nsec)) {
      setErrors(prev => ({ ...prev, nsec: 'Invalid format. Must be nsec1... or 64-char hex.' }));
      return;
    }
    executeLogin(nsec);
  };

  const handleBunkerLogin = async () => {
    if (!bunkerUri.trim()) {
      setErrors(prev => ({ ...prev, bunker: 'Please enter a bunker URL' }));
      return;
    }

    if (!validateBunkerUri(bunkerUri)) {
      setErrors(prev => ({ ...prev, bunker: 'Invalid format. Must start with bunker://' }));
      return;
    }

    setIsLoading(true);
    setErrors(prev => ({ ...prev, bunker: undefined }));

    try {
      await login.bunker(bunkerUri);
      onLogin();
      onClose();
      setBunkerUri('');
    } catch {
      setErrors(prev => ({
        ...prev,
        bunker: 'Failed to connect. Please check the URL.'
      }));
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsFileLoading(true);
    setErrors({});

    const reader = new FileReader();
    reader.onload = (event) => {
      setIsFileLoading(false);
      const content = event.target?.result as string;
      if (content) {
        const trimmedContent = content.trim();
        if (validateNsec(trimmedContent)) {
          executeLogin(trimmedContent);
        } else {
          setErrors({ file: 'File does not contain a valid secret key.' });
        }
      } else {
        setErrors({ file: 'Could not read file content.' });
      }
    };
    reader.onerror = () => {
      setIsFileLoading(false);
      setErrors({ file: 'Failed to read file.' });
    };
    reader.readAsText(file);
  };

  const handleGenerateQrCode = () => {
    setShowQrCode(true);
    setErrors(prev => ({ ...prev, bunker: undefined }));
  };

  const tabs: { id: LoginTab; icon: React.ReactNode; label: string }[] = [
    { id: 'extension', icon: <Puzzle className="w-4 h-4" />, label: 'Extension' },
    { id: 'privatekey', icon: <KeyRound className="w-4 h-4" />, label: 'Private Key' },
    { id: 'remote', icon: <QrCode className="w-4 h-4" />, label: 'Remote' },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[400px] p-0 overflow-hidden rounded-xl gap-0">
        <div className="p-6 space-y-5">
          {/* Header */}
          <DialogHeader className="text-center space-y-1">
            <DialogTitle className="text-xl font-semibold">Log in to Pinseekr</DialogTitle>
            <p className="text-sm text-muted-foreground">
              Choose a login method to access your Nostr identity
            </p>
          </DialogHeader>

          {/* Generate Identity Button */}
          {onSignup && (
            <Button
              variant="outline"
              onClick={() => {
                onClose();
                onSignup();
              }}
              className="w-full h-11 font-medium"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              Generate Identity
            </Button>
          )}

          {/* Tab Navigation */}
          <div className="flex border rounded-lg p-1 bg-muted/30">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  setErrors({});
                  // Reset QR state when switching away from remote tab
                  if (tab.id !== 'remote' && showQrCode) {
                    if (abortControllerRef.current) {
                      abortControllerRef.current.abort();
                    }
                    setShowQrCode(false);
                    setConnectionString('');
                    setQrCodeDataUrl('');
                    setIsWaitingForAuth(false);
                    setIsLoading(false);
                  }
                }}
                className={cn(
                  "flex-1 flex items-center justify-center p-2.5 rounded-md transition-colors",
                  activeTab === tab.id
                    ? "bg-background shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
                title={tab.label}
              >
                {tab.icon}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="space-y-4">
            {/* Extension Tab */}
            {activeTab === 'extension' && (
              <>
                <p className="text-sm text-muted-foreground">
                  Log in using a browser extension like nos2x, Alby, or similar NIP-07 compatible extensions.
                </p>
                
                {errors.extension && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>{errors.extension}</AlertDescription>
                  </Alert>
                )}
                
                <Button
                  onClick={handleExtensionLogin}
                  disabled={isLoading}
                  className="w-full h-11"
                >
                  <Shield className="w-4 h-4 mr-2" />
                  {isLoading ? 'Connecting...' : 'Connect with Extension'}
                </Button>
              </>
            )}

            {/* Private Key Tab */}
            {activeTab === 'privatekey' && (
              <>
                {/* Security Warning */}
                <div className="p-3 rounded-lg bg-red-950/30 border border-red-800">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 mt-0.5 text-red-500 flex-shrink-0" />
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-red-400">Security Warning</p>
                      <p className="text-xs text-red-300/80">
                        Entering your private key is not recommended. Your key will be stored in browser localStorage and could be exposed. Consider using an extension or remote signer instead.
                      </p>
                    </div>
                  </div>
                </div>

                <p className="text-sm text-muted-foreground">
                  Log in by pasting your private key (nsec or hex format). Only use this on trusted devices.
                </p>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium">Private Key</label>
                  <Input
                    type="password"
                    value={nsec}
                    onChange={(e) => {
                      setNsec(e.target.value);
                      if (errors.nsec) setErrors(prev => ({ ...prev, nsec: undefined }));
                    }}
                    placeholder="nsec1... or hex private key"
                    className={cn(
                      "h-10 text-sm font-mono",
                      errors.nsec ? 'border-red-500' : ''
                    )}
                  />
                  <p className="text-xs text-muted-foreground">
                    Supports nsec or 64-character hex private key
                  </p>
                  {errors.nsec && (
                    <p className="text-sm text-red-500">{errors.nsec}</p>
                  )}
                  {errors.file && (
                    <p className="text-sm text-red-500">{errors.file}</p>
                  )}
                </div>
                
                <div className="flex gap-2">
                  <Button
                    onClick={handleKeyLogin}
                    disabled={isLoading || !nsec.trim()}
                    className="flex-1 h-11"
                  >
                    <KeyRound className="w-4 h-4 mr-2" />
                    {isLoading ? 'Logging in...' : 'Log in with Private Key'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isLoading || isFileLoading}
                    className="h-11 px-3"
                    title="Upload key file"
                  >
                    <Upload className="w-4 h-4" />
                  </Button>
                </div>
              </>
            )}

            {/* Remote/QR Tab */}
            {activeTab === 'remote' && (
              <>
                {!showQrCode ? (
                  <>
                    <p className="text-sm text-muted-foreground">
                      Log in using NIP-46 remote signing. Scan the QR code with a signer app or paste a bunker URL.
                    </p>
                    
                    <Button
                      onClick={handleGenerateQrCode}
                      variant="outline"
                      className="w-full h-11"
                    >
                      <QrCode className="w-4 h-4 mr-2" />
                      Generate QR Code
                    </Button>
                    
                    <div className="text-center">
                      <span className="text-xs text-primary uppercase tracking-wide font-medium">
                        Or enter Bunker URL
                      </span>
                    </div>
                    
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Bunker URL</label>
                      <Input
                        value={bunkerUri}
                        onChange={(e) => {
                          setBunkerUri(e.target.value);
                          if (errors.bunker) setErrors(prev => ({ ...prev, bunker: undefined }));
                        }}
                        placeholder="bunker://..."
                        className={cn(
                          "h-10 text-sm font-mono",
                          errors.bunker ? 'border-red-500' : ''
                        )}
                      />
                      {errors.bunker && (
                        <p className="text-sm text-red-500">{errors.bunker}</p>
                      )}
                    </div>
                    
                    <Button
                      onClick={handleBunkerLogin}
                      disabled={isLoading || !bunkerUri.trim()}
                      variant="outline"
                      className="w-full h-11"
                    >
                      {isLoading ? 'Connecting...' : 'Connect with Bunker URL'}
                    </Button>
                  </>
                ) : (
                  <>
                    {/* QR Code Display */}
                    <div className="flex flex-col items-center gap-4">
                      <div className="p-3 bg-white rounded-xl shadow-sm border">
                        {qrCodeDataUrl ? (
                          <img 
                            src={qrCodeDataUrl} 
                            alt="Nostr Connect QR Code" 
                            className="w-56 h-56"
                            width={224}
                            height={224}
                          />
                        ) : (
                          <div className="w-56 h-56 bg-gradient-to-br from-gray-100 to-gray-200 rounded-lg flex items-center justify-center">
                            <div className="text-center space-y-2">
                              <Loader className="w-6 h-6 mx-auto text-gray-400 animate-spin" />
                              <p className="text-xs text-gray-500">Generating...</p>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Status indicator */}
                      {isWaitingForAuth && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Loader className="w-4 h-4 animate-spin" />
                          <span>Waiting for approval...</span>
                        </div>
                      )}

                      {/* Copy connection string */}
                      {connectionString && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={copyConnectionString}
                          className="text-xs text-muted-foreground hover:text-foreground"
                        >
                          <Copy className="w-3 h-3 mr-1" />
                          Copy connection string
                        </Button>
                      )}
                    </div>

                    {errors.extension && (
                      <Alert variant="destructive">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription>{errors.extension}</AlertDescription>
                      </Alert>
                    )}

                    <Button
                      variant="outline"
                      onClick={() => {
                        if (abortControllerRef.current) {
                          abortControllerRef.current.abort();
                        }
                        setShowQrCode(false);
                        setConnectionString('');
                        setQrCodeDataUrl('');
                        setIsWaitingForAuth(false);
                        setIsLoading(false);
                      }}
                      className="w-full h-11"
                    >
                      Back
                    </Button>
                  </>
                )}
              </>
            )}
          </div>
        </div>

        {/* Hidden file input */}
        <input
          type="file"
          accept=".txt"
          className="hidden"
          ref={fileInputRef}
          onChange={handleFileUpload}
        />
      </DialogContent>
    </Dialog>
  );
};
