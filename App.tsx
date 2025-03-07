import React, { useState, useEffect, useMemo } from 'react';
import { View, SafeAreaView, StatusBar, Modal, KeyboardAvoidingView, LogBox, Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Provider, useAtomValue } from 'jotai';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { NavigationContainer } from '@react-navigation/native';

import {
    useAuthState,
    AuthProvider,
    useConfigState,
    ConfigProvider,
    User,
} from './src/lib';

import { Settings } from './src/types';
import { AppProvider } from './src/App/useApp';
import AppNavigator from './src/navigatoin';
import { themes } from './src/lib/contexts/useTheme';

import useNetworks from './src/hooks/useNetworks';

import preferences, { PreferencesEnum } from './src/nativeModules/preferences';
import keystore, { KeystoreEnum } from './src/nativeModules/keystore';

import { getWallets } from './src/utils/wallet';
import {getSkipOnboarding, settings} from './src/utils/storage';


import DebugBanner from "./src/App/DebugBanner.tsx";

import NoInternet from './src/App/NoInternet'
import OnBoarding from './src/App/OnBoarding'
import AppModal from './src/App/AppModal'
import AlertView, { useAlertViewState } from './src/App/AlertView'
import LoadingView from './src/App/LoadingView'
import GlobalTopNotification from './src/App/GlobalTopNotification'
import UnderMaintenance from './src/App/UnderMaintenance'

/*LogBox.ignoreLogs(['EventEmitter.removeListener', 'Warning: ...']);
LogBox.ignoreAllLogs();*/

const queryClient = new QueryClient();

const Root = ({
                  settings: { lang, chain, currency, theme },
                  user,
              }: {
    settings: Settings;
    user?: User[];
}) => {
    /* drawer */
    const alertViewProps = useAlertViewState();
    const { networks } = useNetworks();

    const chainOption =
        (chain ? networks[chain.name] : networks.mainnet) ||
        networks.mainnet;

    /* provider */
    const config = useConfigState({
        lang,
        chain: chainOption,
        currency,
        theme,
    });

    const { current: currentLang = '' } = config.lang;
    const { current: currentChainOptions } = config.chain;
    const { name: currentChain = '' } = currentChainOptions;
    const { current: currentTheme } = config.theme;

    /* onboarding */
    const [showOnBoarding, setShowOnBoarding] = useState<boolean>(false);

    useEffect(() => {
        getSkipOnboarding().then((b) => setShowOnBoarding(!b));
    }, []);

    /* auth */
    const auth = useAuthState(undefined);

    /* render */
    const ready = !!(currentLang && currentChain);
    
    const currentDisplayTheme = useMemo(() => {
        return themes?.[currentTheme] || themes.dark;
    }, [currentTheme]);

    return (
        <>
            {ready && (
                <AppProvider value={{ alertViewProps }}>
                    <ConfigProvider value={config}>
                        <AuthProvider value={auth}>
                            <SafeAreaProvider>
                                <StatusBar
                                    barStyle={currentDisplayTheme.textContent ?? 'light-content'}
                                    backgroundColor={currentDisplayTheme.backgroundColor}
                                />

                                {showOnBoarding ? (
                                    <OnBoarding
                                        closeOnBoarding={(): void =>
                                            setShowOnBoarding(false)
                                        }
                                    />
                                ) : (
                                    <>
                                        <AppNavigator />
                                        <AppModal />
                                        <AlertView alertViewProps={alertViewProps} />
                                        <GlobalTopNotification />
                                        <NoInternet />
                                        <LoadingView />
                                        <UnderMaintenance />
                                        {config.chain.current.name !== 'mainnet' && (
                                            <DebugBanner
                                                title={config.chain.current.name.toUpperCase()}
                                            />
                                        )}
                                    </>
                                )}
                            </SafeAreaProvider>
                        </AuthProvider>
                    </ConfigProvider>
                </AppProvider>
            )}
        </>
    );

    /*return (
        <>
            {ready && (
                <AppProvider value={{ alertViewProps }}>
                    <ConfigProvider value={config}>
                        <AuthProvider value={auth}>

                                <SafeAreaView
                                    style={{
                                        flex: 0,
                                        backgroundColor: showOnBoarding
                                            ? '#fff' : !webviewComponentLoaded
                                                ? '#1f42b4' : currentDisplayTheme.backgroundColor,
                                    }}
                                />
                                <KeyboardAvoidingView
                                    behavior={Platform.OS === "ios" ? "padding" : "height"}
                                    style={defaultViewStyle}
                                >
                                    <SafeAreaView
                                        style={{
                                            ...defaultViewStyle,
                                            backgroundColor: showOnBoarding
                                                ? '#fff' : !webviewComponentLoaded
                                                    ? '#1f42b4' : currentDisplayTheme.backgroundColor,
                                        }}
                                    >
                                        <StatusBar
                                            barStyle={currentDisplayTheme.textContent ?? 'light-content'}
                                            backgroundColor={currentDisplayTheme.backgroundColor}
                                        />

                                        {showOnBoarding ? (
                                            <OnBoarding
                                                closeOnBoarding={(): void =>
                                                    setShowOnBoarding(false)
                                                }
                                            />
                                        ) : (
                                            <>
                                                <View style={defaultViewStyle}>
                                                    <WebViewContainer
                                                        user={user}
                                                        setIsVisibleModal={setIsVisibleModal}
                                                    />
                                                </View>
                                                <NavigationContainer>
                                                    <AppNavigator />
                                                </NavigationContainer>
                                                <GlobalTopNotification />
                                                <UnderMaintenance />
                                                {webviewComponentLoaded && config.chain.current.name !== 'mainnet' && (
                                                    <DebugBanner
                                                        title={config.chain.current.name.toUpperCase()}
                                                    />
                                                )}
                                                <Modal
                                                    onRequestClose={(): void => {
                                                        setIsVisibleModal(false)
                                                    }}
                                                    transparent
                                                    visible={!!isVisibleModal}
                                                >
                                                    <QRScan
                                                        onRead={onRead}
                                                        closeModal={(): void => {
                                                            setIsVisibleModal(false)
                                                        }}
                                                    />
                                                </Modal>
                                            </>
                                        )}
                                    </SafeAreaView>
                                </KeyboardAvoidingView>
                        </AuthProvider>
                    </ConfigProvider>
                </AppProvider>
            )}
        </>
    );*/
};

const clearKeystoreWhenFirstRun = async (): Promise<void> => {
    if (Platform.OS === 'android') return;

    const firstRun = await preferences.getBool(PreferencesEnum.firstRun);
    if (firstRun) return;

    try {
        keystore.remove(KeystoreEnum.AuthData);
    } finally {
        preferences.setBool(PreferencesEnum.firstRun, true);
    }
};

const App = () => {
    const [local, setLocal] = useState<Settings>();
    const [user, setUser] = useState<User[]>();
    const [initComplete, setInitComplete] = useState(false);

    useEffect(() => {
        clearKeystoreWhenFirstRun();

        const init = async (): Promise<void> => {
            const local = await settings.get();
            setLocal(local);
            const wallets = await getWallets();
            setUser(wallets);
        };

        init().then((): void => {
            setInitComplete(true);
        });
    }, []);

    return (
        <>
            {local && initComplete ? (
                <QueryClientProvider client={queryClient}>
                    <Provider>
                        <SafeAreaProvider>
                            <Root settings={local} user={user} />
                        </SafeAreaProvider>
                    </Provider>
                </QueryClientProvider>
            ) : null}
        </>
    );
};

export default App;
