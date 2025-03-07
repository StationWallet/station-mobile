import { atom } from 'jotai';

const name = atom<string>('');

const password = atom<string>('');

const seed = atom<string[]>([]);

export default {
  name,
  password,
  seed,
}
