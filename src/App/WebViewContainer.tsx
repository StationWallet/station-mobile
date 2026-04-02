import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'
import _ from 'lodash'
import { AppState, BackHandler, ToastAndroid, Linking, View, Image, StyleSheet, Platform } from 'react-native'
import { WebView } from 'react-native-webview'
import * as Application from 'expo-application'
const getVersion = () => Application.nativeApplicationVersion || '1.0.0'
import { useRecoilValue, useSetRecoilState } from 'recoil'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import WalletConnect from '@walletconnect/client'
import {
  authenticateBiometric,
  isSupportedBiometricAuthentication,
} from 'utils/bio'
import useWalletConnect from 'hooks/useWalletConnect'
import AppStore from 'stores/AppStore'
import { User } from 'lib/types'
import WalletConnectStore from 'stores/WalletConnectStore'
import { settings } from 'utils/storage'
import { useConfig } from 'lib'
import useNetworks from 'hooks/useNetworks'
import { checkCameraPermission, requestPermission } from 'utils/permission'
import { UTIL } from 'consts'
import images from 'assets/images'

export const RN_APIS = {
  APP_VERSION: 'APP_VERSION',
  MIGRATE_KEYSTORE: 'MIGRATE_KEYSTORE',
  SET_NETWORK: 'SET_NETWORK',
  SET_THEME: 'SET_THEME',
  CHECK_BIO: 'CHECK_BIO',
  AUTH_BIO: 'AUTH_BIO',
  DEEPLINK: 'DEEPLINK',
  QR_SCAN: 'QR_SCAN',
  RECOVER_SESSIONS: 'RECOVER_SESSIONS',
  DISCONNECT_SESSIONS: 'DISCONNECT_SESSIONS',
  READY_CONNECT_WALLET: 'READY_CONNECT_WALLET',
  CONNECT_WALLET: 'CONNECT_WALLET',
  REJECT_SESSION: 'REJECT_SESSION',
  CONFIRM_TX: 'CONFIRM_TX',
  APPROVE_TX: 'APPROVE_TX',
  REJECT_TX: 'REJECT_TX',
}

const uri = 'https://mobile.station.terra.money'

export const WebViewContainer = ({
  user,
  setIsVisibleModal,
}: {
  user?: User[]
  setIsVisibleModal?: any
}) => {
  const appState = useRef<string>(AppState.currentState)
  const { chain, theme } = useConfig()
  const { networks } = useNetworks()
  const { top: insetTop, bottom: insetBottom } = useSafeAreaInsets()

  const {
    newWalletConnect,
    recoverWalletConnect,
    removeWalletConnect,
    saveWalletConnector,
    disconnectWalletConnect,
    disconnectAllWalletConnect,
  } = useWalletConnect()
  const webviewInstance = useRecoilValue(AppStore.webviewInstance)
  const walletConnectors = useRecoilValue(
    WalletConnectStore.walletConnectors
  )
  const setWebviewLoadEnd = useSetRecoilState(AppStore.webviewLoadEnd)
  const setWebviewComponentLoaded = useSetRecoilState(AppStore.webviewComponentLoaded)

  const [localWalletConnector, setLocalWalletConnector] =
    useState<WalletConnect | null>(null)

  const [canGoBack, setCanGoBack] = useState(false)
  let exitAppTimeout: NodeJS.Timeout | null = null
  let isExit = false

  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  const requestAppVersion = async () => {
    try {
      const appVersion = `v${getVersion()}`
      return appVersion
    } catch (e) {
      console.log(e)
    }
  }

  const WebViewListener = useCallback(
    async (req) => {
      if (webviewInstance.current) {
        if (!req) {
          return
        }
        const { data, type, reqId } = req

        switch (type) {
          case RN_APIS.APP_VERSION: {
            // type: APP_VERSION
            // data: string
            const version = await requestAppVersion()
            webviewInstance.current?.postMessage(
              JSON.stringify({
                reqId,
                type,
                data: version,
              })
            )
            break
          }
          case RN_APIS.SET_THEME: {
            // type: SET_THEME
            // data: boolean
            theme.set(data)
            settings.set({ theme: data })
            webviewInstance.current?.postMessage(
              JSON.stringify({
                reqId,
                type,
                data: true,
              })
            )
            break
          }
          case RN_APIS.SET_NETWORK: {
            // type: SET_NETWORK
            // data: boolean
            // @ts-ignore
            const nextChain = networks?.[data]
            settings.set({ chain: nextChain })
            chain.set(nextChain)

            webviewInstance.current?.postMessage(
              JSON.stringify({
                reqId,
                type,
                data: true,
              })
            )
            break
          }

          case RN_APIS.RECOVER_SESSIONS: {
            // type: RECOVER_SESSIONS
            // data: boolean
            recoverWalletConnect(data)
            webviewInstance.current?.postMessage(
              JSON.stringify({
                reqId,
                type,
                data: true,
              })
            )
            break
          }

          case RN_APIS.DISCONNECT_SESSIONS: {
            // type: DISCONNECT_SESSIONS
            // data: boolean
            if (data) {
              disconnectWalletConnect(data)
            } else {
              disconnectAllWalletConnect()
            }
            webviewInstance.current?.postMessage(
              JSON.stringify({
                reqId,
                type,
                data: true,
              })
            )
            break
          }

          case RN_APIS.REJECT_SESSION: {
            localWalletConnector?.rejectSession()
            break
          }

          case RN_APIS.READY_CONNECT_WALLET: {
            await connect({
              uri: data?.uri,
              reqId,
              type,
            })
            break
          }

          case RN_APIS.CONNECT_WALLET: {
            confirmConnect({
              userAddress: data?.userAddress,
            })

            if (!localWalletConnector?.session.peerMeta) {
              webviewInstance.current?.postMessage(
                JSON.stringify({
                  reqId,
                  type,
                  data: 'Error: No peerMeta data',
                })
              )
              return
            }

            // type: CONNECT_WALLET
            // data: session
            webviewInstance.current?.postMessage(
              JSON.stringify({
                reqId,
                type,
                data: localWalletConnector?.session,
              })
            )
            break
          }

          case RN_APIS.MIGRATE_KEYSTORE: {
            setWebviewLoadEnd(true)
            webviewInstance.current?.postMessage(
              JSON.stringify({
                reqId: req.reqId,
                type: type,
                data: user,
              })
            )
            break
          }

          case RN_APIS.CHECK_BIO: {
            const isSuccess = await isSupportedBiometricAuthentication()
            webviewInstance.current?.postMessage(
              JSON.stringify({
                reqId,
                type,
                data: isSuccess,
              })
            )
            break
          }

          case RN_APIS.AUTH_BIO: {
            const isSuccess = await authenticateBiometric()
            if (isSuccess) {
              webviewInstance.current?.postMessage(
                JSON.stringify({
                  reqId,
                  type,
                  data: isSuccess,
                })
              )
            } else {
              webviewInstance.current?.postMessage(
                JSON.stringify({
                  reqId,
                  type,
                  data: 'Error: Bio authentication not authorized, Check your app permissions.',
                })
              )
            }

            break
          }

          case RN_APIS.QR_SCAN: {
            const requestResult = await requestPermission()
            if (requestResult === 'granted') {
              const permission = await checkCameraPermission()
              if (permission === 'granted') {
                setIsVisibleModal(reqId)
                return
              }
            } else {
              webviewInstance.current?.postMessage(
                JSON.stringify({
                  reqId,
                  type,
                  data: 'Error: Camera not authorized, Check your app permissions.',
                })
              )
            }
            break
          }

          case RN_APIS.APPROVE_TX: {
            const connector = walletConnectors[data.handshakeTopic]

            connector?.approveRequest({
              id: data?.id,
              result: data?.result,
            })

            webviewInstance.current?.postMessage(
              JSON.stringify({
                reqId,
                type,
                data: true,
              })
            )
            break
          }

          case RN_APIS.REJECT_TX: {
            const connector = walletConnectors[data.handshakeTopic]

            connector?.rejectRequest({
              id: data?.id,
              error: {
                message: JSON.stringify(data?.errorMsg),
              },
            })

            webviewInstance.current?.postMessage(
              JSON.stringify({
                reqId,
                type,
                data: true,
              })
            )
            break
          }
        }
      }
    },
    [webviewInstance, user, localWalletConnector, walletConnectors]
  )

  const confirmConnect = useCallback(
    async ({ userAddress }) => {
      if (localWalletConnector) {
        const { peerMeta } = localWalletConnector

        // @ts-ignore
        if (peerMeta === 'null' || !peerMeta) {
          setLocalWalletConnector(null)
          return
        } else {
          await localWalletConnector.approveSession({
            chainId: chain.current.walletconnectID,
            accounts: [userAddress],
          })
        }

        saveWalletConnector(localWalletConnector)

        return peerMeta?.name ? true : false
      }
    },
    [localWalletConnector]
  )

  const connect = async ({
    uri,
    reqId,
    type,
  }: any): Promise<void> => {
    try {
      const connector = newWalletConnect({ uri })

      if (!connector.connected) {
        await connector.createSession()
      }
      setLocalWalletConnector(connector)
      connector.on('session_request', (error, payload) => {
        if (error) {
          setLocalWalletConnector(null)
          webviewInstance.current?.postMessage(
            JSON.stringify({
              reqId,
              type,
              data: 'Error: Fail session_request',
            })
          )
          return
        }

        const { peerMeta } = payload.params[0]

        webviewInstance.current?.postMessage(
          JSON.stringify({
            reqId,
            type,
            data: peerMeta,
          })
        )
      })
    } catch (error) {
      webviewInstance.current?.postMessage(
        JSON.stringify({
          reqId,
          type,
          data: 'Error: Fail session_request',
        })
      )
    }
  }

  const onBackPress = useCallback(() => {
    if (webviewInstance.current && canGoBack) {
      webviewInstance.current?.goBack()
      return true
    } else {
      if (isExit === false) {
        isExit = true
        ToastAndroid.show(
          'Click once more to exit.',
          ToastAndroid.SHORT
        )
        exitAppTimeout = setTimeout(
          () => {
            isExit = false
          },
          2000 // 2초
        )
        return true
      } else {
        if (exitAppTimeout !== null) {
          clearTimeout(exitAppTimeout)
        }
        BackHandler.exitApp() // 앱 종료
        return true
      }
    }
  }, [webviewInstance.current, canGoBack])

  const handleAppStateChange = useCallback(
    async (nextAppState: string): Promise<void> => {
      if (
        // nextAppState.match(/inactive|background/)
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        if (!localWalletConnector?.connected) {
          try {
            localWalletConnector?.rejectSession()
          } catch (e) {
            console.log('handleAppStateChange', e)
          }
        }
      }

      appState.current = nextAppState
    },
    [localWalletConnector]
  )

  useEffect(() => {
    if (_.some(walletConnectors)) {
      _.forEach(walletConnectors, (connector) => {
        const handshakeTopic = connector.handshakeTopic

        connector.on('call_request', async (error, req) => {
          const id = req.id
          const method = req.method
          const params = req.params[0]
          
          if (method === 'post' || method === 'signBytes') {
            webviewInstance.current?.postMessage(
              JSON.stringify({
                reqId: '',
                type: RN_APIS.DEEPLINK,
                data: {
                  action: 'wallet_confirm',
                  payload: UTIL.toBase64(UTIL.jsonTryStringify({
                    id,
                    params,
                    handshakeTopic,
                    method
                  }))
                },
              })
            )
          }
        })

        connector.on('disconnect', () => {
          removeWalletConnect(handshakeTopic)

          webviewInstance.current?.postMessage(
            JSON.stringify({
              reqId: '',
              type: RN_APIS.DISCONNECT_SESSIONS,
              data: handshakeTopic,
            })
          )
        })
      })
    }
  }, [walletConnectors])

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress)
    return (): void => {
      subscription.remove()
    }
  }, [onBackPress])

  useEffect(() => {
    const subscription = AppState.addEventListener('change', handleAppStateChange)
    return (): void => {
      subscription.remove()
    }
  }, [handleAppStateChange])

  return (
    <WebView
      ref={webviewInstance}
      source={{
        uri
      }}
      onShouldStartLoadWithRequest={(request) => {
        if (!request.url.includes(uri)) {
          Linking.openURL(request.url)
          return false
        }
        return true
      }}
      allowsBackForwardNavigationGestures
      autoManageStatusBarEnabled={false}
      renderLoading={() => (
        <View style={styles.splashContainer}>
          <Image
            source={images.terraStation}
            style={{
              resizeMode: 'contain',
              alignSelf: 'center',
              marginTop: insetBottom - insetTop,
              width: Platform.OS === 'ios' ? 240 : '48%',
            }}
          />
        </View>
      )}
      startInLoadingState={true}
      scrollEnabled={false}
      contentInsetAdjustmentBehavior="scrollableAxes"
      onLoadProgress={(event) =>
        setCanGoBack(event.nativeEvent.canGoBack)
      }
      onLoadEnd={() => {
        setWebviewComponentLoaded(true)
      }}
      onMessage={async (message) => {
        const { nativeEvent } = message
        const req = nativeEvent.data && JSON.parse(nativeEvent.data)
        await WebViewListener(req)
      }}
      onContentProcessDidTerminate={(): void =>
        (webviewInstance?.current as unknown as WebView)?.reload()
      }
      injectedJavaScript={`
        (function() {
          function wrap(fn) {
            return function wrapper() {
              var res = fn.apply(this, arguments);
              window.ReactNativeWebView.postMessage('navigationStateChange');
              return res;
            }
          }
          history.pushState = wrap(history.pushState);
          history.replaceState = wrap(history.replaceState);
          window.addEventListener('popstate', function() {
            window.ReactNativeWebView.postMessage('navigationStateChange');
          });
        })();
        true;
      `}
    />
  )
}

const styles = StyleSheet.create({
  splashContainer: {
    height: '100%',
    width: '100%',
    backgroundColor: '#1f42b4',
    alignContent: 'center',
    justifyContent: 'center',
  },
})
