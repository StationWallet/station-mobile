import { Alert, Linking } from 'react-native'
import { openLegacyStation, LEGACY_STATION_URL } from 'utils/openLegacyStation'

const mockAlert = Alert.alert as jest.Mock
const mockOpenURL = Linking.openURL as jest.Mock

beforeEach(() => {
  mockAlert.mockClear()
  mockOpenURL.mockClear()
})

describe('openLegacyStation', () => {
  it('opens a confirmation Alert before navigating', () => {
    openLegacyStation()

    expect(mockAlert).toHaveBeenCalledTimes(1)
    const [title, message] = mockAlert.mock.calls[0]
    expect(title).toBe('Open legacy Station')
    expect(message).toContain('no longer maintained')
  })

  it('calls Linking.openURL with the legacy Station URL when user confirms', () => {
    openLegacyStation()

    // Simulate user tapping "Open" — second button in the Alert buttons array
    const [, , buttons] = mockAlert.mock.calls[0]
    const openButton = buttons.find((b: { text: string }) => b.text === 'Open')
    expect(openButton).toBeDefined()
    openButton!.onPress()

    expect(mockOpenURL).toHaveBeenCalledWith(LEGACY_STATION_URL)
    expect(mockOpenURL).toHaveBeenCalledWith('https://mobile.station.terra.money/')
  })

  it('does not call Linking.openURL when user cancels', () => {
    openLegacyStation()

    // Simulate user tapping "Cancel"
    const [, , buttons] = mockAlert.mock.calls[0]
    const cancelButton = buttons.find((b: { text: string }) => b.text === 'Cancel')
    expect(cancelButton).toBeDefined()
    // Cancel button has no onPress — just verify Linking was not called
    expect(mockOpenURL).not.toHaveBeenCalled()
  })
})
