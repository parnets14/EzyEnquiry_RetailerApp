// src/utils/enquirySeen.js
//
// Lightweight, device-local "last seen" tracker for enquiries. Twin of the
// wholesaler app's src/utils/enquirySeen.js, adapted to the retailer DTO
// (`id`, `enquiry_code`, `accepted_offer_price`).
//
// The backend does not track per-user read state, so to show a "new activity"
// dot on the enquiry list we remember — on THIS device — the `updated_at` we
// had already seen for each enquiry. When the list later shows an enquiry whose
// `updated_at` is NEWER than what we stored, something changed since we last
// opened it (a reply, a message, a cancel, a status move — any of those bump
// `updated_at`), so we flag it.
//
// Storage shape: a single JSON object keyed by enquiry id →
//   { "<enquiryId>": "<ISO updated_at we last saw>" }
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = '@retailer_enquiry_seen';

async function readMap() {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const map = raw ? JSON.parse(raw) : {};
    return map && typeof map === 'object' ? map : {};
  } catch {
    return {};
  }
}

async function writeMap(map) {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(map));
  } catch {
    /* non-fatal — the dot is a convenience, not critical state */
  }
}

export const enquirySeen = {
  /** Return the whole { id: lastSeenISO } map. */
  getAll: readMap,

  /**
   * Mark an enquiry as seen at a given `updated_at` (defaults to now). Call this
   * when the user opens the detail screen so the dot clears on return. Pass the
   * stable per-broadcast `seenKey` (the enq_code) as `enquiryId` so a grouped
   * card's dot clears even if the API re-orders its sibling rows.
   */
  async markSeen(enquiryId, updatedAt) {
    if (!enquiryId) return;
    const map = await readMap();
    map[String(enquiryId)] = updatedAt || new Date().toISOString();
    await writeMap(map);
  },

  /**
   * Has `enquiry` changed since we last saw it?
   *   • never seen before  → NEW only if it already carries activity
   *   • seen before        → NEW if its `updated_at` is newer (past a small
   *                          tolerance that absorbs sub-second rounding)
   */
  isNew(enquiry, seenMap) {
    if (!enquiry) return false;
    // Prefer the stable per-broadcast key (set by the list's groupBroadcasts)
    // so a grouped card's dot clears even if the API re-orders its siblings.
    const id = String(enquiry.__seenKey || enquiry.id || enquiry._id || '');
    if (!id) return false;
    const seenISO = seenMap?.[id];
    const updatedISO = enquiry.updated_at || enquiry.updatedAt || enquiry.created_at;
    if (!updatedISO) return false;

    if (!seenISO) {
      // Never opened on this device — only flag if there is something to see.
      return hasActivity(enquiry);
    }
    const TOLERANCE_MS = 2000;
    return new Date(updatedISO).getTime() > new Date(seenISO).getTime() + TOLERANCE_MS;
  },
};

// Any signal worth a dot the FIRST time we see this enquiry on this device:
//  • a counterparty acted — Replied / Negotiation / Confirmed / Cancelled, or a
//    quoted price / availability figure, OR
//  • it is freshly addressed to us and unopened — 'New' / 'Viewed' status.
// After the first open, the dot is driven purely by `updated_at` moving past
// the stored "seen" time, so this only governs the never-seen case.
function hasActivity(e) {
  return ['New', 'Viewed', 'Replied', 'Confirmed', 'Cancelled'].includes(e.status)
    || !!String(e.distributor_reply || '').trim()
    || e.accepted_offer_price != null
    || e.offered_price != null
    || e.available_quantity != null;
}

export default enquirySeen;
