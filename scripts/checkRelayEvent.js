import { relayInit } from 'nostr-tools';

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('Usage: node scripts/checkRelayEvent.js <eventId>');
  process.exit(2);
}

const eventId = args[0];
const relays = [
  'wss://relay.pinseekr.golf',
  'wss://relay.nostr.band'
];

async function checkRelay(url) {
  const relay = relayInit(url);
  try {
    await relay.connect();
    console.log(`Connected to ${url}`);
    const sub = relay.sub([{ ids: [eventId] }]);
    let found = false;
    sub.on('event', (ev) => {
      console.log(`[${url}] FOUND event:`, ev.id);
      console.log(JSON.stringify(ev, null, 2));
      found = true;
      sub.unsub();
      relay.close();
    });

    // wait up to 5s
    await new Promise((resolve) => setTimeout(resolve, 5000));
    if (!found) {
      console.log(`[${url}] No event found (timeout)`);
      sub.unsub();
      relay.close();
    }
  } catch (err) {
    console.error(`[${url}] Error:`, err.message || err);
  }
}

(async () => {
  for (const r of relays) {
    await checkRelay(r);
  }
})();