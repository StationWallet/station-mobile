import React from 'react'
import { View, StyleSheet } from 'react-native'
import Text from 'components/Text'

type Props = {
  currentStep: number
}

const STEPS = [
  { label: 'Vault', icon: '\u26CA' },   // shield/vault
  { label: 'Email', icon: '\u2709' },    // envelope
  { label: 'Password', icon: '\uD83D\uDD12' }, // lock
]

export default function StepProgressBar({ currentStep }: Props) {
  return (
    <View style={styles.container}>
      {STEPS.map((step, index) => {
        const isCompleted = index < currentStep
        const isActive = index === currentStep

        return (
          <React.Fragment key={index}>
            {index > 0 && (
              <View
                style={[
                  styles.connector,
                  isCompleted && styles.connectorCompleted,
                ]}
              />
            )}
            <View style={styles.stepWrapper}>
              <View
                style={[
                  styles.circle,
                  isCompleted && styles.circleCompleted,
                  isActive && styles.circleActive,
                ]}
              >
                {isCompleted ? (
                  <Text style={styles.checkmark}>{'\u2713'}</Text>
                ) : (
                  <Text style={[styles.stepIcon, isActive && styles.stepIconActive]}>
                    {step.icon}
                  </Text>
                )}
              </View>
              {isActive && <View style={styles.glowBar} />}
            </View>
          </React.Fragment>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  stepWrapper: {
    alignItems: 'center',
  },
  circle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#03132c',
    borderWidth: 1,
    borderColor: '#718096',
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleCompleted: {
    backgroundColor: '#0c4eff',
    borderColor: '#0c4eff',
  },
  circleActive: {
    borderColor: '#4879fd',
  },
  checkmark: {
    fontSize: 18,
    color: '#ffffff',
  },
  stepIcon: {
    fontSize: 16,
    color: '#718096',
  },
  stepIconActive: {
    color: '#f0f4fc',
  },
  glowBar: {
    width: 24,
    height: 3,
    borderRadius: 2,
    backgroundColor: '#0c4eff',
    marginTop: 6,
  },
  connector: {
    width: 16,
    height: 1,
    backgroundColor: '#11284a',
    marginHorizontal: 4,
  },
  connectorCompleted: {
    backgroundColor: '#0c4eff',
  },
})
