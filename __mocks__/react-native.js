// Minimal React Native mock for unit tests
module.exports = {
  Platform: { OS: 'ios', select: (obj) => obj.ios },
  Alert: { alert: () => {} },
  Linking: { openURL: () => {} },
}
