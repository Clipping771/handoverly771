/**
 * Offline Sync Resilience Test
 * Simulates IndexedDB queue operations under network failure & restoration.
 */

const assert = require('assert');

// Mock IndexedDB Queue representation
class MockSubmissionQueue {
  constructor() {
    this.store = [];
  }

  async addToQueue(item) {
    const queueItem = {
      ...item,
      created_at: Date.now(),
      retry_count: 0,
      status: 'pending'
    };
    this.store.push(queueItem);
    return queueItem;
  }

  async getPendingQueue() {
    return this.store
      .filter(item => item.status === 'pending' || item.status === 'failed')
      .sort((a, b) => a.created_at - b.created_at);
  }

  async updateQueueItemStatus(id, status, incrementRetry = false) {
    const item = this.store.find(i => i.id === id);
    if (item) {
      item.status = status;
      if (incrementRetry) {
        item.retry_count += 1;
      }
    }
  }

  async removeQueueItem(id) {
    this.store = this.store.filter(i => i.id !== id);
  }
}

// Simulates network sync process
async function simulateSync(queue, isOnline, syncApiMock) {
  const pendingItems = await queue.getPendingQueue();
  let syncCount = 0;
  let failCount = 0;

  for (const item of pendingItems) {
    if (!isOnline) {
      // Offline: keep in queue, mark status failed, increment retry
      await queue.updateQueueItemStatus(item.id, 'failed', true);
      failCount++;
      continue;
    }

    // Attempt sync
    try {
      await queue.updateQueueItemStatus(item.id, 'syncing');
      await syncApiMock(item.payload);
      // Success: remove from queue
      await queue.removeQueueItem(item.id);
      syncCount++;
    } catch (err) {
      await queue.updateQueueItemStatus(item.id, 'failed', true);
      failCount++;
    }
  }

  return { syncCount, failCount };
}

async function runTest() {
  console.log("Starting Offline Sync Resilience Test...");

  const queue = new MockSubmissionQueue();

  // 1. Add some handovers to queue while offline
  await queue.addToQueue({ id: 'item-1', resident_id: 'res-abc', payload: { data: 'Handover 1' } });
  await queue.addToQueue({ id: 'item-2', resident_id: 'res-xyz', payload: { data: 'Handover 2' } });

  let pending = await queue.getPendingQueue();
  console.log(`- Added 2 items to queue. Pending count: ${pending.length}`);
  assert.strictEqual(pending.length, 2, "Queue should contain exactly 2 items");

  // 2. Try to sync while offline
  console.log("- Simulating sync attempt when OFFLINE...");
  const offlineResult = await simulateSync(queue, false, async () => {});
  console.log(`  Processed: Synced=${offlineResult.syncCount}, Failed=${offlineResult.failCount}`);
  assert.strictEqual(offlineResult.syncCount, 0, "No items should sync when offline");
  assert.strictEqual(offlineResult.failCount, 2, "Both items should fail and remain in queue");

  pending = await queue.getPendingQueue();
  assert.strictEqual(pending[0].retry_count, 1, "First item retry count should be 1");
  assert.strictEqual(pending[1].retry_count, 1, "Second item retry count should be 1");
  assert.strictEqual(pending[0].status, 'failed', "Status should be updated to failed");

  // 3. Network returns: run sync again
  console.log("- Simulating sync attempt when ONLINE...");
  const onlineResult = await simulateSync(queue, true, async (payload) => {
    console.log(`  API Success: Sent "${payload.data}"`);
  });
  console.log(`  Processed: Synced=${onlineResult.syncCount}, Failed=${onlineResult.failCount}`);
  assert.strictEqual(onlineResult.syncCount, 2, "All items should sync successfully when online");
  assert.strictEqual(onlineResult.failCount, 0, "No failures when online");

  pending = await queue.getPendingQueue();
  assert.strictEqual(pending.length, 0, "Queue should be completely empty after successful sync");

  console.log("\n✅ Offline Sync Resilience Test completed successfully!");
}

runTest().catch(err => {
  console.error("❌ Test failed:", err);
  process.exit(1);
});
