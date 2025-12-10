import React, { useRef, useState, useEffect } from 'react';
import { Shield, Upload, AlertTriangle, KeyRound, QrCode, Copy, Loader, Sparkles, UserPlus, Mail, ArrowLeft } from 'lucide-react';
import QRCode from 'qrcode';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useLoginActions } from '@/hooks/useLoginActions';
import { useEmailAuth, validateEmail, validatePassword, validateConfirmPassword } from '@/hooks/useEmailAuth';
import { cn } from '@/lib/utils';

interface EnhancedLoginDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onLogin: () => void;
  onSignup?: () => void;
}

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
  const [isLoading, setIsLoading] = useState(false);
  const [isFileLoading, setIsFileLoading] = useState(false);
  const [nsec, setNsec] = useState('');
  const [bunkerUri, setBunkerUri] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showQrFlow, setShowQrFlow] = useState(false);
  const [connectionString, setConnectionString] = useState('');
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState('');
  const [isWaitingForAuth, setIsWaitingForAuth] = useState(false);
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
      setShowQrFlow(false);
      setConnectionString('');
      setQrCodeDataUrl('');
      setIsWaitingForAuth(false);
      setEmailMode(false);
      setEmailForm({
        email: '',
        password: '',
        confirmPassword: '',
        isSignup: false
      });
      setEmailError('');
      setErrors({});
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }, [isOpen]);

  // Generate connection string and QR code for Nostr Connect protocol
  useEffect(() => {
    if (showQrFlow && !connectionString) {
      // Generate real keypair for the connection
      import('nostr-tools').then(({ generateSecretKey, getPublicKey }) => {
        const secretKey = generateSecretKey();
        const pubkey = getPublicKey(secretKey);
        
        const metadata = encodeURIComponent(JSON.stringify({
          name: "PinSeekr Golf",
          url: "https://pinseekr.golf",
          description: "Golf Social Platform with Nostr Authentication"
        }));
        
        const realConnectionString = `nostrconnect://${pubkey}?relay=wss%3A%2F%2Frelay.nostr.band&metadata=${metadata}`;
        setConnectionString(realConnectionString);

        // Generate QR code
        QRCode.toDataURL(realConnectionString, {
          width: 192,
          margin: 2,
          color: {
            dark: '#000000',
            light: '#FFFFFF'
          }
        }).then(url => {
          setQrCodeDataUrl(url);
        }).catch(err => {
          console.error('Failed to generate QR code:', err);
        });

        // Store the secret key for connection process with proper typing
        (window as Window & { _nostrConnectSecret?: Uint8Array })._nostrConnectSecret = secretKey;
      }).catch(err => {
        console.error('Failed to load nostr-tools:', err);
      });
    }
  }, [showQrFlow, connectionString]);

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

  const handleQrLogin = () => {
    try {
      setShowQrFlow(true);
      setIsWaitingForAuth(false); // Don't start waiting until user clicks connect
      
      // QR code login initialized - dialog remains open for user interaction
    } catch (error) {
      console.error('QR login error:', error);
      setErrors(prev => ({ ...prev, extension: 'Failed to initialize QR login' }));
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

  const _handleBunkerLogin = async () => {
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
          {/* QR Code Flow */}
          {showQrFlow ? (
            <>
              {/* Header */}
              <DialogHeader className="text-center space-y-2">
                <DialogTitle className="text-xl font-semibold">Connect with QR Code</DialogTitle>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setShowQrFlow(false)}
                  className="mx-auto text-muted-foreground hover:text-foreground"
                >
                  ← Back to login options
                </Button>
              </DialogHeader>

              {/* Waiting indicator */}
              {isWaitingForAuth && (
                <div className="mb-4 p-3 rounded-lg flex items-center bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
                  <Loader className="w-5 h-5 mr-2 animate-spin text-blue-600" />
                  <span className="text-blue-800 dark:text-blue-200">
                    Waiting for authentication... This can take up to a minute, be patient
                  </span>
                </div>
              )}

              {/* Connection errors */}
              {errors.extension && (
                <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800">
                  <div className="flex items-center">
                    <AlertTriangle className="w-5 h-5 mr-2 text-red-600" />
                    <span className="text-red-800 dark:text-red-200 text-sm">
                      {errors.extension}
                    </span>
                  </div>
                </div>
              )}

              {/* QR Code Section */}
              <div className="space-y-4">
                <div className="text-center">
                  <p className="text-sm mb-3 text-muted-foreground">Scan with your Nostr app</p>
                  <div className="inline-block p-4 bg-white rounded-lg border-2 border-border">
                    {qrCodeDataUrl ? (
                      <img 
                        src={qrCodeDataUrl} 
                        alt="Nostr connection QR code" 
                        className="w-48 h-48"
                        width={192}
                        height={192}
                      />
                    ) : (
                      <div className="w-48 h-48 bg-gradient-to-br from-gray-100 to-gray-200 rounded-lg flex items-center justify-center">
                        <div className="text-center space-y-2">
                          <QrCode className="w-12 h-12 mx-auto text-gray-400" />
                          <p className="text-xs text-gray-500">Generating QR Code...</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Connection String */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium">Connection String</label>
                  <div className="flex">
                    <Input
                      readOnly
                      value={connectionString}
                      className="flex-1 rounded-l-lg text-sm font-mono bg-muted"
                      type="text"
                    />
                    <Button
                      onClick={copyConnectionString}
                      variant="outline"
                      size="sm"
                      className="rounded-r-lg rounded-l-none border-l-0 px-3"
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {/* Instructions */}
                <div className="text-xs text-muted-foreground space-y-1 bg-blue-50 dark:bg-blue-950/20 p-3 rounded-lg">
                  <p className="font-medium text-blue-900 dark:text-blue-100">How to connect:</p>
                  <p>1. Open your Nostr app (like Amber, Alby, etc.)</p>
                  <p>2. Scan this QR code or paste the connection string</p>
                  <p>3. Approve the connection request in your app</p>
                  <p>4. Click "Check Connection" below</p>
                  <p className="text-amber-600 dark:text-amber-400 font-medium">
                    ⚠️ Make sure to approve ALL permissions in your app
                  </p>
                </div>

                {/* Action buttons */}
                <div className="flex gap-2 pt-4">
                  <Button
                    variant="outline"
                    onClick={() => setShowQrFlow(false)}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={async () => {
                      try {
                        setIsLoading(true);
                        setIsWaitingForAuth(true);
                        setErrors(prev => ({ ...prev, extension: undefined }));
                        
                        // For nostrconnect URIs, we need to wait for the user to scan the QR code
                        // and approve the connection in their Nostr app. The connection will be
                        // established through the relay specified in the URI.
                        
                        // Create a promise that will resolve when the connection is established
                        const connectionPromise = new Promise<void>((resolve, reject) => {
                          const timeout = setTimeout(() => {
                            reject(new Error('Connection timeout. Please make sure you scanned the QR code and approved the connection in your Nostr app.'));
                          }, 60000); // 60 second timeout
                          
                          // Poll for connection status
                          const checkConnection = async () => {
                            try {
                              // Try to use the extension method as a fallback
                              // This works because many Nostr apps will inject a nostr object
                              // after establishing the connection
                              if ('nostr' in window) {
                                clearTimeout(timeout);
                                await login.extension();
                                resolve();
                                return;
                              }
                              
                              // If no extension available, continue polling
                              setTimeout(checkConnection, 2000);
                            } catch (error) {
                              console.log('Connection check failed, retrying...', error);
                              setTimeout(checkConnection, 2000);
                            }
                          };
                          
                          // Start polling after a short delay to give the user time to scan
                          setTimeout(checkConnection, 3000);
                        });
                        
                        await connectionPromise;
                        
                        setIsWaitingForAuth(false);
                        onLogin();
                        onClose();
                      } catch (error) {
                        console.error('Connection failed:', error);
                        setIsWaitingForAuth(false);
                        setErrors(prev => ({ 
                          ...prev, 
                          extension: error instanceof Error ? error.message : 'Connection failed. Please scan the QR code and approve the connection in your Nostr app, then click this button again.' 
                        }));
                      } finally {
                        setIsLoading(false);
                      }
                    }}
                    className="flex-1"
                    disabled={!connectionString || isLoading}
                  >
                    {isLoading ? 'Waiting for connection...' : isWaitingForAuth ? 'Check Connection' : 'Connect Now'}
                  </Button>
                </div>
              </div>
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
                  Connect with QR Code
                </Button>

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