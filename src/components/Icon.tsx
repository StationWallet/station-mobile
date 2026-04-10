import React, { ReactElement } from 'react'
import { MaterialIcons } from '@expo/vector-icons'
import { StyleProp, TextStyle } from 'react-native'

type IconProps = {
  name: React.ComponentProps<typeof MaterialIcons>['name']
  size?: number
  color?: string
  style?: StyleProp<TextStyle>
}

// https://material.io/resources/icons/?icon=open_in_new&style=baseline
const Icon = (props: IconProps): ReactElement => (
  <MaterialIcons
    name={props.name}
    size={props.size || 24}
    color={props.color}
    style={props.style}
  />
)

export default Icon
