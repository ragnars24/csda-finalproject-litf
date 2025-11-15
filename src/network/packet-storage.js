/**
 * PacketStorage - Handles storage of intercepted network packets
 * This is a thin wrapper around CSVStorage's packet storage methods
 * to provide a cleaner interface for network interception
 */
class PacketStorage {
  constructor(storage) {
    this.storage = storage;
  }

  /**
   * Save raw intercepted packet (all network requests)
   * @param {Object} persona - Persona configuration
   * @param {string} url - Request URL
   * @param {string} method - HTTP method
   * @param {string} contentType - Response content type
   * @param {string} rawData - Raw response data as string
   */
  saveRawInterceptedPacket(persona, url, method, contentType, rawData) {
    if (this.storage) {
      this.storage.saveRawInterceptedPacket(persona, url, method, contentType, rawData);
    }
  }

  /**
   * Save raw media data packet (extracted from GraphQL)
   * @param {Object} persona - Persona configuration
   * @param {string} url - Request URL
   * @param {string} method - HTTP method
   * @param {Object} rawData - Complete raw data packet (media object)
   */
  saveRawPacket(persona, url, method, rawData) {
    if (this.storage) {
      this.storage.saveRawPacket(persona, url, method, rawData);
    }
  }
}

module.exports = PacketStorage;

