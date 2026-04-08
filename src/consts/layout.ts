import { Platform, Dimensions } from 'react-native'

// Must be function to respond the change of divice width: galaxy-fold
const getWindowHeight = (): number => Dimensions.get('window').height
const getWindowWidth = (): number => Dimensions.get('window').width
const getScreenWideType = (): 'narrow' | 'normal' | 'wide' =>
  getWindowWidth() >= 768
    ? 'wide'
    : getWindowWidth() <= 320
    ? 'narrow'
    : 'normal'

// Assume notch for modern iOS devices (POC simplification)
const getNotchCoverPaddingBottom =
  Platform.OS === 'ios' ? 54 : 32

export default {
  getWindowHeight,
  getWindowWidth,
  getScreenWideType,
  getNotchCoverPaddingBottom,
}
