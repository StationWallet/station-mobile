import { atom } from 'jotai';
import { TxsUI } from 'lib';

const walletTabUi = atom<TxsUI | undefined>(undefined);

export default { walletTabUi };
