import React from 'react'
import { View, StyleSheet } from 'react-native'
import Text from 'components/Text'
import { MIGRATION } from 'consts/migration'

type Props = {
  currentStep: number
}

const STEPS = [
  { label: 'Vault', icon: '\u26CA' }, // shield/vault
  { label: 'Email', icon: '\u2709' }, // envelope
  { label: 'Password', icon: '\uD83D\uDD12' }, // lock
]

export default function StepProgressBar({
  currentStep,
}: Props): React.ReactElement {
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
                  <Text
                    style={[
                      styles.stepIcon,
                      isActive && styles.stepIconActive,
                    ]}
                  >
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
    backgroundColor: MIGRATION.bg,
    borderWidth: 1,
    borderColor: MIGRATION.textTertiary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleCompleted: {
    backgroundColor: MIGRATION.ctaBlue,
    borderColor: MIGRATION.ctaBlue,
  },
  circleActive: {
    borderColor: MIGRATION.textLink,
  },
  checkmark: {
    fontSize: 18,
    color: MIGRATION.textPrimary,
  },
  stepIcon: {
    fontSize: 16,
    color: MIGRATION.textTertiary,
  },
  stepIconActive: {
    color: MIGRATION.textPrimary,
  },
  glowBar: {
    width: 24,
    height: 3,
    borderRadius: 2,
    backgroundColor: MIGRATION.ctaBlue,
    marginTop: 6,
  },
  connector: {
    width: 16,
    height: 1,
    backgroundColor: MIGRATION.borderLight,
    marginHorizontal: 4,
  },
  connectorCompleted: {
    backgroundColor: MIGRATION.ctaBlue,
  },
})
