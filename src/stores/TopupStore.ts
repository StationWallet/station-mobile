import { Tx } from '@terra-money/terra.js';
import { atom } from 'jotai';

const unsignedTx = atom<Tx | undefined>(undefined);

const connectAddress = atom<string | undefined>(undefined);

const continueSignedTx = atom<boolean | undefined>(undefined);

export default {
  unsignedTx,
  connectAddress,
  continueSignedTx,
};
