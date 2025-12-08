import { generateSecretKey, getPublicKey, nip19 } from 'nostr-tools';
import { NSecSigner } from '@nostrify/nostrify';

export interface EmailUser {
  id: string;
  email: string;
  pubkey: string;
  nsec: string;
  signer: NSecSigner;
  createdAt: number;
  accountType: 'email';
}

interface StoredEmailUser {
  id: string;
  email: string;
  pubkey: string;
  encryptedNsec: string;
  createdAt: number;
  accountType: 'email';
}

// Simple encryption/decryption using password (for demo purposes)
// In production, you'd use proper key derivation (PBKDF2/Argon2) and encryption (AES-GCM)
function simpleEncrypt(text: string, password: string): string {
  // This is a very basic XOR cipher for demo purposes
  // DO NOT use in production - use proper encryption libraries
  let result = '';
  for (let i = 0; i < text.length; i++) {
    result += String.fromCharCode(
      text.charCodeAt(i) ^ password.charCodeAt(i % password.length)
    );
  }
  return btoa(result);
}

function simpleDecrypt(encrypted: string, password: string): string {
  try {
    const text = atob(encrypted);
    let result = '';
    for (let i = 0; i < text.length; i++) {
      result += String.fromCharCode(
        text.charCodeAt(i) ^ password.charCodeAt(i % password.length)
      );
    }
    return result;
  } catch {
    throw new Error('Invalid password or corrupted data');
  }
}

// Get stored email users from localStorage
function getStoredUsers(): StoredEmailUser[] {
  try {
    const stored = localStorage.getItem('email_users');
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

// Save email users to localStorage
function saveStoredUsers(users: StoredEmailUser[]): void {
  localStorage.setItem('email_users', JSON.stringify(users));
}

// Generate a new email user with Nostr keypair
export async function generateEmailUser(email: string, password: string): Promise<EmailUser> {
  // Check if user already exists
  const existingUsers = getStoredUsers();
  const existing = existingUsers.find(u => u.email.toLowerCase() === email.toLowerCase());
  
  if (existing) {
    throw new Error('An account with this email already exists');
  }

  // Generate new Nostr keypair
  const secretKey = generateSecretKey();
  const pubkey = getPublicKey(secretKey);
  const nsec = nip19.nsecEncode(secretKey);

  // Create the email user
  const user: EmailUser = {
    id: `email_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    email: email.toLowerCase().trim(),
    pubkey,
    nsec,
    signer: new NSecSigner(secretKey),
    createdAt: Date.now(),
    accountType: 'email',
  };

  // Store encrypted user data
  const storedUser: StoredEmailUser = {
    id: user.id,
    email: user.email,
    pubkey: user.pubkey,
    encryptedNsec: simpleEncrypt(nsec, password),
    createdAt: user.createdAt,
    accountType: 'email',
  };

  // Save to localStorage
  const updatedUsers = [...existingUsers, storedUser];
  saveStoredUsers(updatedUsers);

  // Set current session
  localStorage.setItem('email_user_session', JSON.stringify({
    userId: user.id,
    email: user.email,
    pubkey: user.pubkey,
  }));

  return user;
}

// Login with email and password
export async function loginEmailUser(email: string, password: string): Promise<EmailUser> {
  const users = getStoredUsers();
  const stored = users.find(u => u.email.toLowerCase() === email.toLowerCase());

  if (!stored) {
    throw new Error('No account found with this email address');
  }

  try {
    // Decrypt the nsec
    const nsec = simpleDecrypt(stored.encryptedNsec, password);
    const decoded = nip19.decode(nsec);
    
    if (decoded.type !== 'nsec') {
      throw new Error('Invalid stored key data');
    }

    const secretKey = decoded.data;
    const pubkey = getPublicKey(secretKey);

    // Verify pubkey matches stored data
    if (pubkey !== stored.pubkey) {
      throw new Error('Invalid password');
    }

    const user: EmailUser = {
      id: stored.id,
      email: stored.email,
      pubkey: stored.pubkey,
      nsec,
      signer: new NSecSigner(secretKey),
      createdAt: stored.createdAt,
      accountType: 'email',
    };

    // Set current session
    localStorage.setItem('email_user_session', JSON.stringify({
      userId: user.id,
      email: user.email,
      pubkey: user.pubkey,
    }));

    return user;
  } catch (error) {
    if (error instanceof Error && error.message === 'Invalid password or corrupted data') {
      throw new Error('Invalid password');
    }
    throw new Error('Failed to decrypt account data');
  }
}

// Get current email user session
export function getCurrentEmailUser(): { userId: string; email: string; pubkey: string } | null {
  try {
    const session = localStorage.getItem('email_user_session');
    return session ? JSON.parse(session) : null;
  } catch {
    return null;
  }
}

// Check if user is logged in with email
export function isEmailUserLoggedIn(): boolean {
  return getCurrentEmailUser() !== null;
}

// Logout email user
export function logoutEmailUser(): void {
  localStorage.removeItem('email_user_session');
}

// Get email user's export data (for account upgrade)
export function getEmailUserExportData(email: string, password: string): { nsec: string; pubkey: string } {
  const users = getStoredUsers();
  const stored = users.find(u => u.email.toLowerCase() === email.toLowerCase());

  if (!stored) {
    throw new Error('Account not found');
  }

  try {
    const nsec = simpleDecrypt(stored.encryptedNsec, password);
    return {
      nsec,
      pubkey: stored.pubkey,
    };
  } catch {
    throw new Error('Invalid password');
  }
}