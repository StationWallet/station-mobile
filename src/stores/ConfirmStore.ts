import { atom } from 'jotai'
import { ConfirmProps } from 'lib'

const confirm = atom<ConfirmProps | undefined>(undefined)

export default { confirm }
