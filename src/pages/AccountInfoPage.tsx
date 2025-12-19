import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';

import { Copy, Download, Eye, EyeOff, Mail, Key, Shield, ExternalLink, Info, Sparkles, X } from 'lucide-react';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useToast } from '@/hooks/useToast';
import { getEmailUserExportData } from '@/lib/emailAuthService';
import { EditProfileForm } from '@/components/EditProfileForm';
import MobileContainer from '@/components/MobileContainer';
import { nip19 } from 'nostr-tools';
import { useNavigate } from 'react-router-dom';

export function AccountInfoPage() {
  const { user, isEmailUser, emailUserData } = useCurrentUser();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [showKeys, setShowKeys] = useState(false);
  const [exportPassword, setExportPassword] = useState('');
  const [showExportForm, setShowExportForm] = useState(false);
  const [exportedKeys, setExportedKeys] = useState<{ nsec: string; pubkey: string } | null>(null);

  if (!user) {
    return (
      <MobileContainer className="py-8">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Please log in to view your account information.</p>
          </CardContent>
        </Card>
      </MobileContainer>
    );
  }

  const handleExportKeys = async () => {
    if (!isEmailUser || !emailUserData) {
      toast({
        title: "Error",
        description: "Key export is only available for email accounts.",
        variant: "destructive",
      });
      return;
    }

    try {
      const keys = getEmailUserExportData(emailUserData.email, exportPassword);
      setExportedKeys(keys);
      toast({
        title: "Keys exported successfully!",
        description: "Your Nostr keys have been revealed. Keep them safe!",
      });
    } catch (error) {
      toast({
        title: "Export failed",
        description: error instanceof Error ? error.message : "Failed to export keys",
        variant: "destructive",
      });
    }
  };

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: "Copied!",
        description: `${label} copied to clipboard`,
      });
    } catch {
      toast({
        title: "Copy failed",
        description: "Could not copy to clipboard",
        variant: "destructive",
      });
    }
  };

  const downloadKeys = () => {
    if (!exportedKeys) return;

    const keyData = {
      email: emailUserData?.email,
      publicKey: exportedKeys.pubkey,
      secretKey: exportedKeys.nsec,
      exportedAt: new Date().toISOString(),
      note: "Keep your secret key (nsec) private and secure. Anyone with this key can control your Nostr identity."
    };

    const blob = new Blob([JSON.stringify(keyData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nostr-keys-${emailUserData?.email || 'account'}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: "Keys downloaded!",
      description: "Your Nostr keys have been saved to your device.",
    });
  };

  return (
    <MobileContainer className="py-8">
      <div className="space-y-6">
      {/* Close Button */}
      <div className="flex justify-end">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(-1)}
          className="rounded-full"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </Button>
      </div>

      {/* Account Overview */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                {isEmailUser ? <Mail className="h-5 w-5" /> : <Key className="h-5 w-5" />}
                Account Information
              </CardTitle>
              <CardDescription>
                Manage your account settings and Nostr identity
              </CardDescription>
            </div>
            <Badge variant={isEmailUser ? "secondary" : "default"}>
              {isEmailUser ? "Email Account" : "Nostr Account"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {isEmailUser && emailUserData && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Email:</span>
                <span className="text-sm text-muted-foreground">{emailUserData.email}</span>
              </div>
            </div>
          )}
          
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Public Key (npub):</span>
              <div className="flex items-center gap-2">
                <code className="text-xs bg-muted px-2 py-1 rounded max-w-48 truncate">
                  {nip19.npubEncode(user.pubkey)}
                </code>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => copyToClipboard(nip19.npubEncode(user.pubkey), "Public key (npub)")}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          {isEmailUser && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                Your email account has an auto-generated Nostr identity. You can export your keys to use with other Nostr apps.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Nostr Onboarding for Email Users */}
      {isEmailUser && (
        <Card className="border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-blue-600" />
              Welcome to Nostr!
            </CardTitle>
            <CardDescription>
              Your email account comes with a decentralized Nostr identity
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3">
              <div className="flex items-start gap-3">
                <Shield className="h-5 w-5 mt-0.5 text-blue-600" />
                <div>
                  <h4 className="font-medium">You Own Your Identity</h4>
                  <p className="text-sm text-muted-foreground">
                    Your Nostr keys give you complete control over your social identity across the decentralized web.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Key className="h-5 w-5 mt-0.5 text-blue-600" />
                <div>
                  <h4 className="font-medium">Portable Across Apps</h4>
                  <p className="text-sm text-muted-foreground">
                    Use the same identity on any Nostr{' '}
                    <a 
                      href="https://nostrapps.com/" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 underline"
                    >
                      app
                    </a>
                    {' '}- social networks, marketplaces, and more.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <ExternalLink className="h-5 w-5 mt-0.5 text-blue-600" />
                <div>
                  <h4 className="font-medium">No Platform Lock-in</h4>
                  <p className="text-sm text-muted-foreground">
                    Export your keys anytime to move to other Nostr clients or keep backups.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Profile Management */}
      <Card>
        <CardHeader>
          <CardTitle>Profile Information</CardTitle>
          <CardDescription>
            Update your profile information visible to others
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EditProfileForm />
        </CardContent>
      </Card>

      {/* Key Export for Email Users */}
      {isEmailUser && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="h-5 w-5" />
              Export Nostr Keys
            </CardTitle>
            <CardDescription>
              Download your Nostr keys to use with other apps or create backups
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!showExportForm ? (
              <div className="space-y-4">
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    Exporting your keys allows you to use your Nostr identity in other apps. Keep your secret key secure!
                  </AlertDescription>
                </Alert>
                <Button onClick={() => setShowExportForm(true)}>
                  <Key className="h-4 w-4 mr-2" />
                  Export Keys
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label htmlFor="exportPassword" className="text-sm font-medium">
                    Enter your account password to export keys:
                  </label>
                  <div className="flex gap-2">
                    <input
                      id="exportPassword"
                      type="password"
                      value={exportPassword}
                      onChange={(e) => setExportPassword(e.target.value)}
                      className="flex-1 px-3 py-2 border rounded-md"
                      placeholder="Your password"
                    />
                    <Button onClick={handleExportKeys} disabled={!exportPassword.trim()}>
                      Export
                    </Button>
                  </div>
                </div>

                {exportedKeys && (
                  <div className="space-y-4 p-4 bg-muted rounded-lg">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium">Your Exported Keys</h4>
                      <Button size="sm" onClick={downloadKeys}>
                        <Download className="h-4 w-4 mr-2" />
                        Download
                      </Button>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium">Public Key (npub):</span>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => copyToClipboard(nip19.npubEncode(exportedKeys.pubkey), "Public key (npub)")}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                        <code className="text-xs bg-background p-2 rounded block break-all">
                          {nip19.npubEncode(exportedKeys.pubkey)}
                        </code>
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium">Secret Key (nsec):</span>
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setShowKeys(!showKeys)}
                            >
                              {showKeys ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </Button>
                            {showKeys && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => copyToClipboard(exportedKeys.nsec, "Secret key")}
                              >
                                <Copy className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                        <code className={`text-xs bg-background p-2 rounded block break-all ${!showKeys ? 'blur-sm' : ''}`}>
                          {exportedKeys.nsec}
                        </code>
                        {!showKeys && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Click the eye icon to reveal your secret key
                          </p>
                        )}
                      </div>
                    </div>

                    <Alert variant="destructive">
                      <Shield className="h-4 w-4" />
                      <AlertDescription>
                        <strong>Keep your secret key private!</strong> Anyone with this key can control your Nostr identity. 
                        Store it securely and never share it publicly.
                      </AlertDescription>
                    </Alert>
                  </div>
                )}

                <Button
                  variant="ghost"
                  onClick={() => {
                    setShowExportForm(false);
                    setExportPassword('');
                    setExportedKeys(null);
                    setShowKeys(false);
                  }}
                >
                  Cancel
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  </MobileContainer>
);
}

export default AccountInfoPage;