import { useEffect, useState } from 'react'
import { Keyboard } from 'react-native'

/**
 * Tracks whether the IME is currently visible. Used to apply the
 * Android-only keyboardVerticalOffset={-100} hack to KeyboardAvoidingView
 * instances — Android 15 edge-to-edge + adjustResize + KAV
 * behavior="padding" stacks padding that stays after the keyboard
 * animates out, leaving a sticky bottom gap. The negative offset while
 * the IME is up cancels the extra chrome; on hide, the offset returns
 * to 0 and the layout restores cleanly.
 */
export function useKeyboardVisible(): boolean {
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () =>
      setVisible(true)
    )
    const hide = Keyboard.addListener('keyboardDidHide', () =>
      setVisible(false)
    )
    return (): void => {
      show.remove()
      hide.remove()
    }
  }, [])
  return visible
}
