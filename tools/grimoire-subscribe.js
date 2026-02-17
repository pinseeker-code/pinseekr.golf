#!/usr/bin/env node
// Subscribe to kind 24133 (Nostr Connect / NIP-46) events and log them.
// Usage: node tools/grimoire-subscribe.js [PUBKEY]
// or: PUBKEY=abcd node tools/grimoire-subscribe.js

(async () => {
  const relayUrl = process.env.RELAY || 'wss://relay.pinseekr.golf';
  const pubkey = process.argv[2] || process.env.PUBKEY;

  console.log('[grimoire-subscribe] relay=', relayUrl, 'pubkey=', pubkey || '<none>');

  // dynamic imports to work cleanly in Node ESM
  const relayMod = await import('nostr-tools/relay');
  const core = await import('nostr-tools');
  const wsMod = await import('ws');
  const { Relay, useWebSocketImplementation } = relayMod;
  const WebSocketImpl = wsMod.WebSocket || wsMod.default || wsMod;
  useWebSocketImplementation(WebSocketImpl);

  let relay;
  try {
    relay = await Relay.connect(relayUrl);
  } catch (err) {
    console.error('[grimoire-subscribe] failed to connect:', err);
    process.exit(1);
  }

  console.log('[grimoire-subscribe] connected to relay');

  const filter = pubkey ? { kinds: [24133], '#p': [pubkey] } : { kinds: [24133] };

  const subscription = relay.prepareSubscription([filter], { label: 'grimoire-sub' });
  subscription.onevent = (evt) => {
    console.log('\n[EVENT] ' + new Date().toISOString());
    console.log(JSON.stringify(evt, null, 2));
  };
  subscription.receivedEose = () => {
    console.log('[EOSE] end of stored events');
  };
  subscription.fire();

  // keep process running until interrupted
  process.on('SIGINT', async () => {
    console.log('\n[grimoire-subscribe] SIGINT, closing');
    try { subscription.close('client closed'); } catch (e) {}
    try { relay.close(); } catch (e) {}
    process.exit(0);
  });
})();
