import React, { useEffect } from 'react'
import { View, StyleSheet } from 'react-native'
import Svg, { Path, Rect } from 'react-native-svg'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  interpolateColor,
} from 'react-native-reanimated'
import { MIGRATION } from 'consts/migration'

type StepStatus = 'completed' | 'active' | 'upcoming'

type Props = {
  currentStep: number
}

/** Pen icon for vault name step */
function PenIcon({ color }: { color: string }): React.ReactElement {
  return (
    <Svg width={16} height={20} viewBox="0 0 16 20" fill="none">
      <Path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M15.4324 0.738446C15.9368 1.27778 16.1599 2.06457 15.8747 2.87143C15.2694 4.58361 14.0774 5.9952 13.0782 6.95837C12.6963 7.32647 12.3352 7.63608 12.0333 7.87922L12.1696 7.97937C13.1001 8.663 13.586 9.9544 12.9272 11.0971C11.7056 13.2164 8.5711 16.9 1.73462 16.9C1.68309 16.9 1.63277 16.8948 1.58416 16.8849C1.52739 17.6671 1.5 18.4573 1.5 19.25C1.5 19.6642 1.16421 20 0.75 20C0.33579 20 0 19.6642 0 19.25C0 14.8193 0.82101 10.3197 2.90854 6.76516C5.01508 3.17831 8.3988 0.583366 13.401 0.0162758C14.1892 -0.0730842 14.9389 0.210776 15.4324 0.738446Z"
        fill={color}
      />
    </Svg>
  )
}

/** Email icon for email step */
function EmailIcon({ color }: { color: string }): React.ReactElement {
  return (
    <Svg width={20} height={20} viewBox="0 0 20 20" fill="none">
      <Path
        d="M3.95768 3.33594C2.69203 3.33594 1.66602 4.36195 1.66602 5.6276V5.66042L9.5311 9.61794C9.82568 9.76619 10.173 9.76619 10.4675 9.61794L18.3327 5.66042V5.6276C18.3327 4.36195 17.3067 3.33594 16.041 3.33594H3.95768Z"
        fill={color}
      />
      <Path
        d="M18.3327 7.05469L11.0294 10.7296C10.3814 11.0556 9.61727 11.0556 8.96927 10.7296L1.66602 7.05469V14.3726C1.66602 15.6382 2.69203 16.6642 3.95768 16.6642H16.041C17.3067 16.6642 18.3327 15.6382 18.3327 14.3726V7.05469Z"
        fill={color}
      />
    </Svg>
  )
}

/** Lock icon for password step */
function LockIcon({ color }: { color: string }): React.ReactElement {
  return (
    <Svg width={20} height={20} viewBox="0 0 20 20" fill="none">
      <Path
        d="M3.75 4.79167C3.75 4.21637 4.21637 3.75 4.79167 3.75H6.66667C7.01184 3.75 7.29167 3.47017 7.29167 3.125C7.29167 2.77983 7.01184 2.5 6.66667 2.5H4.79167C3.52602 2.5 2.5 3.52602 2.5 4.79167V6.66667C2.5 7.01184 2.77983 7.29167 3.125 7.29167C3.47017 7.29167 3.75 7.01184 3.75 6.66667V4.79167Z"
        fill={color}
      />
      <Path
        d="M13.334 2.5C12.9888 2.5 12.709 2.77983 12.709 3.125C12.709 3.47017 12.9888 3.75 13.334 3.75H15.209C15.7843 3.75 16.2507 4.21637 16.2507 4.79167V6.66667C16.2507 7.01184 16.5305 7.29167 16.8757 7.29167C17.2208 7.29167 17.5007 7.01184 17.5007 6.66667V4.79167C17.5007 3.52602 16.4747 2.5 15.209 2.5H13.334Z"
        fill={color}
      />
      <Path
        d="M3.75 13.3359C3.75 12.9908 3.47017 12.7109 3.125 12.7109C2.77983 12.7109 2.5 12.9908 2.5 13.3359V15.2109C2.5 16.4766 3.52602 17.5026 4.79167 17.5026H6.66667C7.01184 17.5026 7.29167 17.2228 7.29167 16.8776C7.29167 16.5324 7.01184 16.2526 6.66667 16.2526H4.79167C4.21637 16.2526 3.75 15.7863 3.75 15.2109V13.3359Z"
        fill={color}
      />
      <Path
        d="M17.5007 13.3359C17.5007 12.9908 17.2208 12.7109 16.8757 12.7109C16.5305 12.7109 16.2507 12.9908 16.2507 13.3359V15.2109C16.2507 15.7863 15.7843 16.2526 15.209 16.2526H13.334C12.9888 16.2526 12.709 16.5324 12.709 16.8776C12.709 17.2228 12.9888 17.5026 13.334 17.5026H15.209C16.4747 17.5026 17.5007 16.4766 17.5007 15.2109V13.3359Z"
        fill={color}
      />
      <Path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12.4993 8.47627V8.33594C12.4993 6.95523 11.3801 5.83594 9.99935 5.83594C8.6186 5.83594 7.49935 6.95523 7.49935 8.33594V8.47627C7.00665 8.71035 6.66602 9.21252 6.66602 9.79427V11.8776C6.66602 12.683 7.31893 13.3359 8.12435 13.3359H11.8743C12.6798 13.3359 13.3327 12.683 13.3327 11.8776V9.79427C13.3327 9.21252 12.992 8.71035 12.4993 8.47627ZM8.74935 8.33594H11.2493C11.2493 7.64558 10.6897 7.08594 9.99935 7.08594C9.30902 7.08594 8.74935 7.64558 8.74935 8.33594Z"
        fill={color}
      />
    </Svg>
  )
}

function getStatus(step: number, currentStep: number): StepStatus {
  if (step < currentStep) return 'completed'
  if (step === currentStep) return 'active'
  return 'upcoming'
}

function getIconColor(status: StepStatus): string {
  if (status === 'completed') return MIGRATION.successGreen
  if (status === 'active') return MIGRATION.ctaBlue
  return 'rgba(255,255,255,0.2)'
}

function StepCircle({
  status,
  icon,
}: {
  status: StepStatus
  icon: React.ReactNode
}): React.ReactElement {
  const getInitialBgProgress = (): number => {
    if (status === 'completed') return 2
    if (status === 'active') return 1
    return 0
  }

  const scale = useSharedValue(status === 'active' ? 1.05 : 1)
  const glowOpacity = useSharedValue(status === 'active' ? 1 : 0)
  const bgProgress = useSharedValue(getInitialBgProgress())

  useEffect(() => {
    if (status === 'active') {
      scale.value = withSpring(1.05, { damping: 15, stiffness: 150 })
      glowOpacity.value = withTiming(1, { duration: 300 })
      bgProgress.value = withTiming(1, { duration: 300 })
    } else if (status === 'completed') {
      scale.value = withSpring(1, { damping: 15, stiffness: 150 })
      glowOpacity.value = withTiming(0, { duration: 200 })
      bgProgress.value = withTiming(2, { duration: 300 })
    } else {
      scale.value = withSpring(1, { damping: 15, stiffness: 150 })
      glowOpacity.value = withTiming(0, { duration: 200 })
      bgProgress.value = withTiming(0, { duration: 300 })
    }
  }, [status, bgProgress, glowOpacity, scale])

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    backgroundColor: interpolateColor(
      bgProgress.value,
      [0, 1, 2],
      ['transparent', 'transparent', `${MIGRATION.successGreen}33`]
    ),
    borderColor: interpolateColor(
      bgProgress.value,
      [0, 1, 2],
      ['rgba(255,255,255,0.1)', 'rgba(255,255,255,0.2)', 'transparent']
    ),
  }))

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
  }))

  return (
    <Animated.View style={[styles.circle, animatedStyle]}>
      {icon}
      <Animated.View style={[styles.glow, glowStyle]} />
    </Animated.View>
  )
}

function ConnectorDash({
  active,
}: {
  active: boolean
}): React.ReactElement {
  const progress = useSharedValue(active ? 1 : 0)

  useEffect(() => {
    progress.value = withTiming(active ? 1 : 0, { duration: 400 })
  }, [active, progress])

  const animatedStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      progress.value,
      [0, 1],
      ['rgba(255,255,255,0.1)', `${MIGRATION.successGreen}99`]
    ),
  }))

  return <Animated.View style={[styles.connector, animatedStyle]} />
}

export default function StepProgressBar({
  currentStep,
}: Props): React.ReactElement {
  const s1 = getStatus(1, currentStep)
  const s2 = getStatus(2, currentStep)
  const s3 = getStatus(3, currentStep)

  return (
    <View style={styles.container}>
      <StepCircle
        status={s1}
        icon={<PenIcon color={getIconColor(s1)} />}
      />
      <ConnectorDash active={s1 === 'completed'} />
      <StepCircle
        status={s2}
        icon={<EmailIcon color={getIconColor(s2)} />}
      />
      <ConnectorDash active={s2 === 'completed'} />
      <StepCircle
        status={s3}
        icon={<LockIcon color={getIconColor(s3)} />}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    marginTop: 24,
  },
  circle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1.5,
  },
  glow: {
    position: 'absolute',
    bottom: -12,
    width: 20,
    height: 10,
    borderRadius: 50,
    shadowColor: '#0C4EFF',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 1,
    shadowRadius: 16,
    elevation: 8,
  },
  connector: {
    width: 16,
    height: 1,
    borderRadius: 1,
    marginHorizontal: 12,
  },
})
