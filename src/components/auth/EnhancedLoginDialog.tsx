import React, { useRef, useState, useEffect } from 'react';
import { Shield, Upload, AlertTriangle, KeyRound, QrCode, Copy, Loader, Sparkles, UserPlus, Mail, ArrowLeft, Link2 } from 'lucide-react';
import QRCode from 'qrcode';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useLoginActions } from '@/hooks/useLoginActions';
import { useEmailAuth, validateEmail, validatePassword, validateConfirmPassword } from '@/hooks/useEmailAuth';
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
  const [isLoading, setIsLoading] = useState(false);
  const [isFileLoading, setIsFileLoading] = useState(false);
  const [nsec, setNsec] = useState('');
  const [bunkerUri, setBunkerUri] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showBunkerInput, setShowBunkerInput] = useState(false);
  const [showQrFlow, setShowQrFlow] = useState(false);
  const [connectionString, setConnectionString] = useState('');
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState('');
  const [isWaitingForAuth, setIsWaitingForAuth] = useState(false);
  const [_connectSecret, setConnectSecret] = useState('');
  const [_clientSecretKey, setClientSecretKey] = useState<Uint8Array | null>(null);
  const [emailMode, setEmailMode] = useState(false);
  const [emailForm, setEmailForm] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    isSignup: false
  });
  const [emailError, setEmailError] = useState('');
  const [errors, setErrors] = useState<{
    nsec?: string;
    bunker?: string;
    file?: string;
    extension?: string;
  }>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const login = useLoginActions();
  const emailAuth = useEmailAuth();

  // Reset all state when dialog opens/closes
  useEffect(() => {
    if (isOpen) {
      setIsLoading(false);
      setIsFileLoading(false);
      setNsec('');
      setBunkerUri('');
      setShowAdvanced(false);
      setShowBunkerInput(false);
      setShowQrFlow(false);
      setConnectionString('');
      setQrCodeDataUrl('');
      setIsWaitingForAuth(false);
      setConnectSecret('');
      setClientSecretKey(null);
      setEmailMode(false);
      setEmailForm({
        email: '',
        password: '',
        confirmPassword: '',
        isSignup: false
      });
      setEmailError('');
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
  // Key insight: We must be listening BEFORE the user scans the QR code
  useEffect(() => {
    if (showQrFlow && !connectionString) {
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
          // This is the key difference from the old flow
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
                  const bunkerUri = `bunker://${event.pubkey}?relay=wss%3A%2F%2Frelay.nsec.app&secret=${encodeURIComponent(clientNsec)}`;
                  
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
                  await login.bunker(bunkerUri);
                  
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
  }, [showQrFlow, connectionString, nostr, login, onLogin, onClose]);

  // handleQrLogin just toggles the QR flow view; listening starts automatically in the useEffect
  const handleQrLogin = () => {
    setShowQrFlow(true);
    setErrors(prev => ({ ...prev, extension: undefined }));
  };

  const handleExtensionLogin = async () => {
    setIsLoading(true);
    setErrors(prev => ({ ...prev, extension: undefined }));

    try {
      if (!('nostr' in window)) {
        throw new Error('Nostr extension not found. Please install a Nostr extension like nos2x or Alby.');
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
      setErrors(prev => ({ ...prev, nsec: 'Please enter your secret key' }));
      return;
    }

    if (!validateNsec(nsec)) {
      setErrors(prev => ({ ...prev, nsec: 'Invalid secret key format. Must be a valid nsec starting with nsec1.' }));
      return;
    }
    executeLogin(nsec);
  };

  const handleBunkerLogin = async () => {
    if (!bunkerUri.trim()) {
      setErrors(prev => ({ ...prev, bunker: 'Please enter a bunker URI' }));
      return;
    }

    if (!validateBunkerUri(bunkerUri)) {
      setErrors(prev => ({ ...prev, bunker: 'Invalid bunker URI format. Must start with bunker://' }));
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
        bunker: 'Failed to connect to bunker. Please check the URI.'
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

  const handleEmailAuth = async () => {
    setEmailError('');
    setIsLoading(true);

    try {
      // Validate email
      const emailError = validateEmail(emailForm.email);
      if (emailError) {
        setEmailError(emailError);
        return;
      }

      // Validate password
      const passwordError = validatePassword(emailForm.password, emailForm.isSignup);
      if (passwordError) {
        setEmailError(passwordError);
        return;
      }

      // Validate confirm password for signup
      if (emailForm.isSignup) {
        const confirmError = validateConfirmPassword(emailForm.password, emailForm.confirmPassword);
        if (confirmError) {
          setEmailError(confirmError);
          return;
        }
      }

      // Perform authentication
      let emailUser;
      if (emailForm.isSignup) {
        emailUser = await emailAuth.signup(emailForm.email, emailForm.password);
      } else {
        emailUser = await emailAuth.login(emailForm.email, emailForm.password);
      }

      // Log the user into the Nostr system using their auto-generated nsec
      login.nsec(emailUser.nsec);

      // Success - close dialog and trigger login
      onLogin();
      onClose();
    } catch (error) {
      setEmailError(error instanceof Error ? error.message : 'Authentication failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const hasExtension = 'nostr' in window;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[400px] max-h-[90vh] p-0 overflow-hidden rounded-2xl">
        <div className="max-h-[90vh] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
          <div className="p-8 space-y-6 pb-12">
          {/* QR Code Flow - Grimoire-style layout */}
          {showQrFlow ? (
            <>
              {/* Header */}
              <DialogHeader className="text-center space-y-2">
                <DialogTitle className="text-xl font-semibold">Connect with QR Code</DialogTitle>
                <p className="text-sm text-muted-foreground">
                  Scan with your Nostr signer app (Amber, nsec.app, etc.)
                </p>
              </DialogHeader>

              {/* Connection errors */}
              {errors.extension && (
                <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 mt-0.5 text-red-600 flex-shrink-0" />
                    <span className="text-red-800 dark:text-red-200 text-sm">
                      {errors.extension}
                    </span>
                  </div>
                </div>
              )}

              {/* QR Code Section - Centered and prominent */}
              <div className="flex flex-col items-center gap-4">
                <div className="p-3 bg-white rounded-xl shadow-sm border">
                  {qrCodeDataUrl ? (
                    <img 
                      src={qrCodeDataUrl} 
                      alt="Nostr Connect QR Code" 
                      className="w-64 h-64"
                      width={256}
                      height={256}
                    />
                  ) : (
                    <div className="w-64 h-64 bg-gradient-to-br from-gray-100 to-gray-200 rounded-lg flex items-center justify-center">
                      <div className="text-center space-y-2">
                        <Loader className="w-8 h-8 mx-auto text-gray-400 animate-spin" />
                        <p className="text-xs text-gray-500">Generating...</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Status indicator */}
                {isWaitingForAuth && (
                  <div className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400">
                    <Loader className="w-4 h-4 animate-spin" />
                    <span>Waiting for connection approval...</span>
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

              {/* Instructions */}
              <div className="text-xs text-muted-foreground space-y-1.5 p-3 rounded-lg bg-muted/50">
                <p className="font-medium text-foreground">How to connect:</p>
                <ol className="list-decimal list-inside space-y-1">
                  <li>Open Amber, nsec.app, or another NIP-46 signer</li>
                  <li>Scan this QR code or paste the connection string</li>
                  <li>Approve the "pinseekr.golf" connection request</li>
                </ol>
              </div>

              {/* Back button */}
              <Button
                variant="outline"
                onClick={() => {
                  if (abortControllerRef.current) {
                    abortControllerRef.current.abort();
                  }
                  setShowQrFlow(false);
                  setConnectionString('');
                  setQrCodeDataUrl('');
                  setIsWaitingForAuth(false);
                  setIsLoading(false);
                }}
                className="w-full"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to login options
              </Button>
            </>
          ) : (
            <>
              {/* Header */}
              <DialogHeader className="text-center space-y-2">
                <DialogTitle className="text-2xl font-bold">Welcome</DialogTitle>
                <p className="text-muted-foreground">
                  Connect to your golf account
                </p>
              </DialogHeader>

              {/* Primary Sign In Method - Always show Nostr button */}
              <div className="space-y-4">
                {errors.extension && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>{errors.extension}</AlertDescription>
                  </Alert>
                )}
                
                <Button
                  className="w-full h-12 rounded-xl font-medium text-base"
                  onClick={handleExtensionLogin}
                  disabled={isLoading}
                >
                  <Shield className="w-5 h-5 mr-2" />
                  {isLoading ? 'Signing in...' : 'Sign in with Nostr'}
                </Button>

                {/* Keychat recommendation - shown when no extension */}
                {!hasExtension && (
                  <div className="p-3 rounded-lg bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800">
                    <div className="flex items-start gap-3">
                      <Shield className="w-5 h-5 text-purple-600 mt-0.5 flex-shrink-0" />
                      <div className="space-y-1 flex-1">
                        <p className="text-sm font-medium text-purple-800 dark:text-purple-200">
                          No Nostr extension detected
                        </p>
                        <p className="text-xs text-purple-700 dark:text-purple-300">
                          Try <a href="https://www.keychat.io/#download1" target="_blank" rel="noopener noreferrer" className="underline font-medium hover:text-purple-900 dark:hover:text-purple-100">Keychat</a> - works great as a mobile signer for Nostr apps.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Separator */}
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <Separator className="w-full" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="bg-background px-4 text-muted-foreground">
                    Or continue with
                  </span>
                </div>
              </div>

              {/* Alternative Methods */}
              <div className="space-y-3">
                {/* QR Code Login Option */}
                <Button
                  variant="outline"
                  className="w-full h-12 rounded-xl font-medium"
                  onClick={handleQrLogin}
                  disabled={isLoading}
                >
                  <QrCode className="w-4 h-4 mr-2" />
                  Connect with QR Code (First Time)
                </Button>

                {/* Bunker URI Login Option - for returning users */}
                <Button
                  variant="outline"
                  className="w-full h-12 rounded-xl font-medium"
                  onClick={() => setShowBunkerInput(!showBunkerInput)}
                >
                  <Link2 className="w-4 h-4 mr-2" />
                  Login with Bunker URI
                </Button>

                {showBunkerInput && (
                  <div className="space-y-3 p-4 bg-muted/30 rounded-xl border">
                    <p className="text-xs text-muted-foreground">
                      Paste your bunker:// URI from Amber or another NIP-46 signer.
                    </p>
                    <div className="space-y-2">
                      <Input
                        type="text"
                        value={bunkerUri}
                        onChange={(e) => {
                          setBunkerUri(e.target.value);
                          if (errors.bunker) setErrors(prev => ({ ...prev, bunker: undefined }));
                        }}
                        className={cn(
                          "h-10 rounded-lg font-mono text-xs",
                          errors.bunker ? 'border-red-500' : ''
                        )}
                        placeholder="bunker://..."
                        autoComplete="off"
                      />
                      {errors.bunker && (
                        <p className="text-sm text-red-500">{errors.bunker}</p>
                      )}
                    </div>
                    <Button
                      size="sm"
                      onClick={handleBunkerLogin}
                      disabled={isLoading || !bunkerUri.trim()}
                      className="w-full rounded-lg"
                    >
                      {isLoading ? 'Connecting...' : 'Connect to Bunker'}
                    </Button>
                  </div>
                )}

                {/* Secret Key option - always available */}
                <Button
                  variant="outline"
                  className="w-full h-12 rounded-xl font-medium"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                >
                  <KeyRound className="w-4 h-4 mr-2" />
                  Use Secret Key Instead
                </Button>

                {showAdvanced && (
                  <div className="space-y-3 p-4 bg-muted/30 rounded-xl border">
                    <div className="space-y-2">
                      <Input
                        type="password"
                        value={nsec}
                        onChange={(e) => {
                          setNsec(e.target.value);
                          if (errors.nsec) setErrors(prev => ({ ...prev, nsec: undefined }));
                        }}
                        className={cn(
                          "h-10 rounded-lg",
                          errors.nsec ? 'border-red-500' : ''
                        )}
                        placeholder="nsec1..."
                        autoComplete="off"
                      />
                      {errors.nsec && (
                        <p className="text-sm text-red-500">{errors.nsec}</p>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        size="sm"
                        onClick={handleKeyLogin}
                        disabled={isLoading || !nsec.trim()}
                        className="rounded-lg"
                      >
                        {isLoading ? 'Signing in...' : 'Sign In'}
                      </Button>
                      
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isLoading || isFileLoading}
                        className="rounded-lg"
                      >
                        <Upload className="w-3 h-3 mr-1" />
                        {isFileLoading ? 'Reading...' : 'Upload'}
                      </Button>
                    </div>

                    {errors.file && (
                      <p className="text-sm text-red-500">{errors.file}</p>
                    )}
                  </div>
                )}
              </div>

              {/* Hidden file input */}
              <input
                type="file"
                accept=".txt"
                className="hidden"
                ref={fileInputRef}
                onChange={handleFileUpload}
              />

              {/* New User Section */}
              {onSignup && (
                <>
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <Separator className="w-full" />
                    </div>
                    <div className="relative flex justify-center text-sm">
                      <span className="bg-background px-4 text-muted-foreground">
                        New to Nostr?
                      </span>
                    </div>
                  </div>

                  <div className="relative p-4 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-blue-950/50 dark:to-indigo-950/50 border border-blue-200 dark:border-blue-800">
                    <div className="text-center space-y-3">
                      <div className="flex justify-center items-center gap-2">
                        <Sparkles className="w-5 h-5 text-blue-600" />
                        <span className="font-semibold text-blue-800 dark:text-blue-200">
                          Get Started
                        </span>
                      </div>
                      <p className="text-sm text-blue-700 dark:text-blue-300">
                        Create your decentralized identity. It's free and you own your data.
                      </p>
                      <Button
                        onClick={() => {
                          onClose();
                          onSignup();
                        }}
                        className="w-full h-12 rounded-xl font-medium text-base bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg border-0"
                      >
                        <UserPlus className="w-4 h-4 mr-2" />
                        Create Nostr Identity
                      </Button>
                    </div>
                  </div>
                </>
              )}

              {/* Email Authentication Option - Non-prominent */}
              {!emailMode && (
                <div className="border-t pt-4 mt-6">
                  <div className="text-center text-xs text-muted-foreground mb-3">
                    Prefer a simple start?
                  </div>
                  <Button
                    onClick={() => {
                      setEmailMode(true);
                      setEmailForm(prev => ({ ...prev, isSignup: true }));
                    }}
                    variant="ghost"
                    className="w-full text-sm text-muted-foreground hover:text-foreground"
                  >
                    <Mail className="w-4 h-4 mr-2" />
                    Continue with Email Instead
                  </Button>
                </div>
              )}
            </>
          )}

          {/* Email Form */}
          {emailMode && !showQrFlow && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <Button
                  onClick={() => setEmailMode(false)}
                  variant="ghost"
                  size="sm"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <h3 className="text-lg font-semibold">Email Login</h3>
              </div>

              {emailError && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>{emailError}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    value={emailForm.email}
                    onChange={(e) => {
                      console.log('Email changed:', e.target.value);
                      setEmailForm(prev => ({ ...prev, email: e.target.value }));
                    }}
                    placeholder="your@email.com"
                    autoComplete="email"
                    className="h-12 rounded-xl"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={emailForm.password}
                    onChange={(e) => {
                      console.log('Password changed:', e.target.value);
                      setEmailForm(prev => ({ ...prev, password: e.target.value }));
                    }}
                    placeholder="Enter your password"
                    autoComplete={emailForm.isSignup ? "new-password" : "current-password"}
                    className="h-12 rounded-xl"
                  />
                </div>

                {emailForm.isSignup && (
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirm Password</Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      value={emailForm.confirmPassword}
                      onChange={(e) => setEmailForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                      placeholder="Confirm your password"
                      autoComplete="new-password"
                      className="h-12 rounded-xl"
                    />
                  </div>
                )}

                <Button
                  onClick={() => {
                    console.log('Button clicked - Form state:', emailForm);
                    handleEmailAuth();
                  }}
                  className="w-full h-12 rounded-xl font-medium"
                  disabled={isLoading || !emailForm.email.trim() || !emailForm.password.trim()}
                >
                  {isLoading ? 'Processing...' : (emailForm.isSignup ? 'Sign Up' : 'Log In')}
                  {/* Debug info */}
                  <span className="ml-2 text-xs opacity-50">
                    {emailForm.email.length}/{emailForm.password.length}
                  </span>
                </Button>

                <div className="text-center">
                  <Button
                    onClick={() => setEmailForm(prev => ({ 
                      ...prev, 
                      isSignup: !prev.isSignup,
                      confirmPassword: ''
                    }))}
                    variant="ghost"
                    className="text-sm"
                  >
                    {emailForm.isSignup ? 'Already have an account? Log in' : 'Need an account? Sign up'}
                  </Button>
                </div>
                {/* Informational note about local storage vs Nostr */}
                <div className="text-xs text-muted-foreground mt-2 space-y-1">
                  <p>
                    Note: email/password accounts are stored only on this device. To access your account from other devices, sign in using Nostr (recommended).
                  </p>
                  <p>
                    Learn more about Nostr: <a href="https://njump.me/" target="_blank" rel="noopener noreferrer" className="underline">https://njump.me/</a>
                  </p>
                </div>
              </div>
            </div>
          )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};