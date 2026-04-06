import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from './lang/en'
import es from './lang/es.json'
import zh from './lang/zh.json'
import fr from './lang/fr.json'
import ru from './lang/ru.json'
import pl from './lang/pl.json'

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      es: { translation: es },
      zh: { translation: zh },
      fr: { translation: fr },
      ru: { translation: ru },
      pl: { translation: pl },
    },
    lng: 'en',
    keySeparator: ':',
  })

/* types */
export * from './types'

/* utility */
export * from './utils'

/* contexts */
export * from './contexts/ConfigContext'
export * from './contexts/AuthContext'
export { Languages, getLang } from './contexts/useLang'
export { default as createContext } from './contexts/createContext'

/* api */
export { default as fcd } from './api/fcd'
