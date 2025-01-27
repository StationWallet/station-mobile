import React, { ReactElement, ReactNode } from 'react'
import {
  View,
  TouchableOpacity,
  ViewStyle,
  StyleSheet,
} from 'react-native'
import _ from 'lodash'

import * as shape from 'd3-shape'

import { COLOR, LAYOUT } from 'consts'

import { API } from 'lib'

import Icon from './Icon'
import Text from './Text'

interface Props extends Partial<API<any>> {
  style?: ViewStyle
  title?: string
  badge?: string
  action?: ReactNode
  onPress?: () => void
  content?: string
  value?: string
  unit?: string
  children?: ReactNode
  dark?: boolean
}

const Card = ({
  style,
  title,
  badge,
  action,
  content,
  value,
  unit,
  children,
  ...rest
}: Props): ReactElement => {
  const { onPress, dark, error, loading } = rest
  const textStyle = [styles.text, dark && darkStyles.text]
  const data = [460, 466, 480, 490, 500, 510, 520]
  const Line = ({ line }: any): ReactElement => (
    <></>
  )

  const render = (): ReactElement => (
    <View
      style={[
        styles.card,
        dark ? darkStyles.card : lightStyles.card,
        style,
      ]}
    >
      {_.some(title) && (
        <View style={styles.header}>
          <Text style={[textStyle, styles.title]} fontType={'bold'}>
            {title}
          </Text>
          {action ??
            (badge ? (
              LAYOUT.getScreenWideType() !== 'narrow' && (
                <View style={styles.badge}>
                  <Text style={[textStyle, styles.badge_text]}>
                    {badge}
                  </Text>
                </View>
              )
            ) : (
              <Icon
                name="chevron-right"
                size={25}
                color="#fff"
                style={styles.icon}
              />
            ))}
        </View>
      )}

      {error ? (
        <Text style={textStyle}>{error.message}</Text>
      ) : loading ? (
        <Text style={textStyle}>Loading...</Text>
      ) : (
        children ?? (
          <View style={styles.bottom}>
            <Text
              style={[
                textStyle,
                styles.value,
                {
                  fontSize:
                    LAYOUT.getScreenWideType() === 'narrow' ? 12 : 14,
                },
              ]}
            >
              {content}
              {value}
              <Text style={styles.unit}> {unit}</Text>
            </Text>
            {action ??
              (badge ? (
                <View />
              ) : (
                <></>
              ))}
          </View>
        )
      )}
    </View>
  )

  return onPress ? (
    <TouchableOpacity onPress={onPress}>{render()}</TouchableOpacity>
  ) : (
    render()
  )
}

export default Card

/* styles */
const styles = StyleSheet.create({
  text: {
    color: COLOR.primary._02,
  },

  card: {
    borderRadius: 20,
    marginHorizontal: 20,
    marginVertical: 10,
    padding: 20,
    // paddingVertical: 20,
    flexDirection: 'column',
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    height: 25,
  },

  icon: {
    marginTop: -2,
    marginRight: -6,
  },

  badge: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    height: 24,
    borderRadius: 12,
    paddingHorizontal: 12,
    marginTop: -1,
  },

  badge_text: {
    fontSize: 12,
    lineHeight: 22,
    color: 'rgba(255,255,255,0.75)',
  },

  title: {
    fontSize: 14,
    lineHeight: 21,
    textTransform: 'capitalize',
  },

  value: {
    lineHeight: 21,
    marginTop: 10,
  },

  unit: {
    color: 'white',
    fontSize: 14,
    letterSpacing: 0,
  },
  bottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
})

const lightStyles = StyleSheet.create({
  card: {
    backgroundColor: 'white',
    shadowColor: 'black',
    shadowOffset: { width: 0, height: 20 },
    shadowRadius: 20,
    shadowOpacity: 0.05,
  },
})

const darkStyles = StyleSheet.create({
  text: { color: 'white' },
  card: {
    backgroundColor: COLOR.primary._02,
    shadowColor: 'black',
    shadowOffset: { width: 0, height: 20 },
    shadowRadius: 20,
    shadowOpacity: 0.05,
  },
})
