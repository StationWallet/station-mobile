import { ReactNode } from 'react'
import { atom } from 'jotai'

const children = atom<ReactNode>(undefined)

const isVisible = atom<boolean>(false)

export default {
  children,
  isVisible,
}
