// Minimal React Native mock for unit tests
module.exports = {
  Platform: { OS: 'ios', select: (obj) => obj.ios },
  Alert: { alert: jest.fn() },
  Linking: { openURL: jest.fn().mockResolvedValue(undefined) },
}
