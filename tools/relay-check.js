async function run() {
  const url = 'wss://relay.pinseekr.golf';
  console.log('Connecting to', url);

  // dynamic imports to access the relay class and core helpers
  const relayMod = await import('nostr-tools/relay');
  const core = await import('nostr-tools');
  const wsMod = await import('ws');

  const { Relay, useWebSocketImplementation } = relayMod;
  const { generateSecretKey, getPublicKey, finalizeEvent } = core;
  const WebSocketImpl = wsMod.WebSocket || wsMod.default || wsMod;

  // tell nostr-tools to use the Node WebSocket implementation
  useWebSocketImplementation(WebSocketImpl);

  let relay;
  try {
    relay = await Relay.connect(url);
  } catch (e) {
    console.error('Failed to connect to relay:', e);
    process.exit(1);
  }

  console.log('[relay] connected');

  // create a temporary keypair and finalize (sign) the event
  const sk = generateSecretKey();
  const pk = getPublicKey(sk);
  console.log('[keys] generated pubkey', pk);

  const event = {
    kind: 1,
    pubkey: pk,
    created_at: Math.floor(Date.now() / 1000),
    tags: [],
    content: 'pinseekr relay-check test event',
  };

  const signed = finalizeEvent(event, sk);

  console.log('[event] id', signed.id);

  try {
    await relay.publish(signed);
    console.log('[publish] ok');
    relay.close();
    process.exit(0);
  } catch (reason) {
    console.error('[publish] failed', reason);
    relay.close();
    process.exit(1);
  }

  // safety timeout
  setTimeout(() => {
    console.error('[publish] timeout waiting for relay ack');
    relay.close();
    process.exit(2);
  }, 10000);
}

run().catch(e => { console.error(e); process.exit(1); });
