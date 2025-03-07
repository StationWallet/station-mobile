import React, { ReactElement } from 'react'
import { View, Image, StyleProp, ViewStyle } from 'react-native'
import imgLoadingCircle from 'assets/images/loading_circle.gif'

const Loading = (props: {
  size?: number
  style?: StyleProp<ViewStyle>
}): ReactElement => {
  const size = props.size || 38
  return (
    <View
      style={[
        { alignItems: 'center', marginBottom: 20 },
        props.style,
      ]}
    >
      <Image
        source={imgLoadingCircle}
        style={{ width: size, height: size }}
      />
    </View>
  )
}

export default Loading
