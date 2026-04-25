/**
 * Utility to manage a persistent, elegant Device ID.
 * This ID is used for security and quality control (limiting accounts per device).
 */

export const getDeviceId = () => {
  if (typeof window === 'undefined') return null;

  let deviceId = localStorage.getItem('og_device_id');
  
  if (!deviceId) {
    // Generate a secure, unique identifier
    deviceId = 'OG-' + crypto.randomUUID();
    localStorage.setItem('og_device_id', deviceId);
  }
  
  return deviceId;
};
