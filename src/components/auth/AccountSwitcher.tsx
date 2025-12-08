// NOTE: This file is stable and usually should not be modified.
// It is important that all functionality in this file is preserved, and should only be modified if explicitly requested.

import { ChevronDown, LogOut, Settings, Zap, Wifi, WifiOff } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu.tsx';
import { Button as BitcoinConnectButton } from '@getalby/bitcoin-connect-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar.tsx';
import { useLoggedInAccounts } from '@/hooks/useLoggedInAccounts';
import { genUserName } from '@/lib/genUserName';
import { Link } from 'react-router-dom';
import { useOfflineRound } from '@/hooks/useOfflineRound';

export function AccountSwitcher() {
  const { currentUser, removeLogin } = useLoggedInAccounts();
  const { connected, outboxCount } = useOfflineRound();

  if (!currentUser) return null;

  const displayName = currentUser.metadata.name ?? genUserName(currentUser.pubkey);

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button className='flex items-center gap-3 p-3 rounded-full transition-all w-full text-foreground bg-purple-100 text-purple-700 hover:bg-purple-600 hover:text-white active:bg-purple-700 dark:bg-purple-900/30 dark:text-purple-300 dark:hover:bg-purple-600 dark:hover:text-white'>
          <div className="relative">
            <Avatar className='w-10 h-10'>
              <AvatarImage src={currentUser.metadata.picture} alt={displayName} />
              <AvatarFallback>{displayName.charAt(0)}</AvatarFallback>
            </Avatar>
            {/* Online status indicator dot */}
            <span
              className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white dark:border-gray-900 ${connected ? 'bg-green-500' : 'bg-red-500 animate-pulse'}`}
              aria-label={connected ? 'Online' : 'Offline'}
            />
          </div>
          <div className='flex-1 text-left hidden md:block truncate'>
            <p className='font-medium text-sm truncate'>{displayName}</p>
          </div>
          <ChevronDown className='w-4 h-4 text-muted-foreground' />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className='w-56 p-2 animate-scale-in'>
        {/* Connection status */}
        <div className='flex items-center gap-2 px-2 py-1.5 text-sm text-muted-foreground'>
          {connected ? (
            <><Wifi className='w-4 h-4 text-green-500' /><span>Online</span></>
          ) : (
            <><WifiOff className='w-4 h-4 text-red-500' /><span>Offline</span></>
          )}
          {outboxCount > 0 && (
            <span className='ml-auto text-xs px-1.5 py-0.5 bg-amber-500 text-white rounded-full'>
              {outboxCount} pending
            </span>
          )}
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/account" className='flex items-center gap-2 cursor-pointer p-2 rounded-md'>
            <Settings className='w-4 h-4' />
            <span>Account Info</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <div className='px-2 py-1.5'>
          <div className='flex items-center gap-2 mb-2'>
            <Zap className='w-4 h-4 text-amber-500' />
            <span className='font-medium text-sm'>Lightning Wallet</span>
          </div>
          <BitcoinConnectButton />
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => removeLogin(currentUser.id)}
          className='flex items-center gap-2 cursor-pointer p-2 rounded-md text-red-500'
        >
          <LogOut className='w-4 h-4' />
          <span>Log out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
