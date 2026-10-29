export const VERIFICATION_QUEUE_TABS = ['Pending Review', 'Verified', 'Rejected', 'All'];

/**
 * Missing or unknown values stay on the queue's existing default tab.
 */
export function verificationTabFromSearch(value) {
  return VERIFICATION_QUEUE_TABS.includes(value) ? value : 'Pending Review';
}
