// Stub for @ledgerhq/react-native-hw-transport-ble
// Ledger BLE does not work on simulators
class TransportBLE {
  static async open() { throw new Error('Ledger BLE not available in POC') }
  static listen() { return { unsubscribe: () => {} } }
  static observeState(observer) { observer.next({ available: false, type: 'PoweredOff' }); return { unsubscribe: () => {} } }
  static async disconnect() {}
}
module.exports = TransportBLE
module.exports.default = TransportBLE
