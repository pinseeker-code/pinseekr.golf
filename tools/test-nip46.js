#!/usr/bin/env node
// Test that the relay accepts kind 24133 (NIP-46 Nostr Connect) events.
// Usage: node tools/test-nip46.js
// Run this AFTER updating your Grain relay to whitelist kind 24133.

async function run() {
  const relayUrl = process.env.RELAY || 'wss://relay.pinseekr.golf';
  console.log('[test-nip46] Connecting to', relayUrl);

  const relayMod = await import('nostr-tools/relay');
  const core = await import('nostr-tools');
  const wsMod = await import('ws');

  const { Relay, useWebSocketImplementation } = relayMod;
  const { generateSecretKey, getPublicKey, finalizeEvent } = core;
  const WebSocketImpl = wsMod.WebSocket || wsMod.default || wsMod;
  useWebSocketImplementation(WebSocketImpl);

  let relay;
  try {
    relay = await Relay.connect(relayUrl);
  } catch (e) {
    console.error('[test-nip46] Failed to connect:', e);
    process.exit(1);
  }
  console.log('[test-nip46] Connected');

  // Generate test keypairs (client and fake remote-signer)
  const clientSk = generateSecretKey();
  const clientPk = getPublicKey(clientSk);
  const signerSk = generateSecretKey();
  const signerPk = getPublicKey(signerSk);

  console.log('[test-nip46] Client pubkey:', clientPk);
  console.log('[test-nip46] Signer pubkey:', signerPk);

  // Create a kind 24133 event (NIP-46 connect request)
  const event = {
    kind: 24133,
    pubkey: clientPk,
    created_at: Math.floor(Date.now() / 1000),
    tags: [['p', signerPk]],
    content: JSON.stringify({
      id: 'test-' + Date.now(),
      method: 'connect',
      params: [signerPk, 'test-secret']
    })
  };

  const signed = finalizeEvent(event, clientSk);
  console.log('[test-nip46] Event ID:', signed.id);
  console.log('[test-nip46] Publishing kind 24133 event...');

  try {
    await relay.publish(signed);
    console.log('[test-nip46] ✅ SUCCESS - Relay accepted kind 24133');
  } catch (err) {
    console.error('[test-nip46] ❌ FAILED - Relay rejected kind 24133:', err.message || err);
    console.error('[test-nip46] You need to add kind 24133 to your Grain relay whitelist.');
    relay.close();
    process.exit(1);
  }

  // Now test subscribing for kind 24133
  console.log('[test-nip46] Testing subscription for kind 24133...');
  
  const filter = { kinds: [24133], '#p': [signerPk], limit: 1 };
  const sub = relay.subscribe([filter], {
    onevent(evt) {
      console.log('[test-nip46] ✅ Received event:', evt.id);
    },
    oneose() {
      console.log('[test-nip46] ✅ Subscription EOSE received');
      sub.close();
      relay.close();
      console.log('[test-nip46] All tests passed! Your relay supports NIP-46.');
      process.exit(0);
    }
  });

  // Timeout safety
  setTimeout(() => {
    console.error('[test-nip46] Timeout waiting for subscription response');
    relay.close();
    process.exit(2);
  }, 10000);
}

run().catch(e => { console.error(e); process.exit(1); });
