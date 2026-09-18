/**
 * G Sense Offline Network Firewall
 *
 * Enforces strict network isolation when Offline Mode is active.
 * Guarantees zero bytes of camera frames, voice audio, or queries leave the device.
 */

let _isOffline = false;

export function setOfflineFirewallActive(active: boolean): void {
  _isOffline = active;
  if (active) {
    console.log('[OFFLINE FIREWALL] Strict network isolation active. Cloud requests blocked.');
  } else {
    console.log('[OFFLINE FIREWALL] Online mode enabled. Network requests permitted.');
  }
}

export function isOfflineFirewallActive(): boolean {
  return _isOffline;
}

/**
 * Asserts that the network is permitted.
 * Throws a descriptive OfflineBlockError if called during Offline Mode.
 */
export function assertNetworkAllowed(purpose = 'network call'): void {
  if (_isOffline) {
    const errorMsg = `[OFFLINE FIREWALL] Blocked ${purpose}: No network requests permitted in Offline Mode.`;
    console.warn(errorMsg);
    throw new OfflineNetworkBlockedError(errorMsg);
  }
}

export class OfflineNetworkBlockedError extends Error {
  name = 'OfflineNetworkBlockedError';
  constructor(message: string) {
    super(message);
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
