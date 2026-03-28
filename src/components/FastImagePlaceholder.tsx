import React, { ReactElement, useState } from 'react'
import { Image, ImageSourcePropType, StyleProp, ImageStyle } from 'react-native'

type FastImagePlaceholderProps = {
  source: ImageSourcePropType
  style?: StyleProp<ImageStyle>
  placeholder: ImageSourcePropType
}

function FastImagePlaceholder({
  source,
  style,
  placeholder,
}: FastImagePlaceholderProps): ReactElement {
  const [loading, setLoading] = useState(true)

  return (
    <>
      {loading && <Image source={placeholder} style={style} />}
      <Image
        source={source}
        style={loading ? { width: 0, height: 0 } : style}
        onLoad={(): void => setLoading(false)}
      />
    </>
  )
}

export default FastImagePlaceholder
