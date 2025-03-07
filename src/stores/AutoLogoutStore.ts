import { atom } from 'jotai'

const isFromAutoLogout = atom<boolean>(false)

export default { isFromAutoLogout }
