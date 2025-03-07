import { atom } from 'jotai';

const showLoading = atom(false);

const loadingTxHash = atom<string>('');

const loadingTitle = atom<string>('');

type NullableRefObject<T> = {
  current: T | null;
};

const initialRef: NullableRefObject<ReactNativeWebView> = {
  current: null
};

const webviewInstance = atom<NullableRefObject<ReactNativeWebView>>(initialRef);

const webviewLoadEnd = atom<boolean>(false);

const webviewComponentLoaded = atom<boolean>(false);

export default {
  showLoading,
  loadingTxHash,
  loadingTitle,
  webviewInstance,
  webviewLoadEnd,
  webviewComponentLoaded,
}
