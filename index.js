// Polyfills must be loaded before everything else
import 'intl-pluralrules'
import { Buffer } from 'buffer'
global.Buffer = Buffer
import 'react-native-get-random-values'
import './shim.js'
import { registerRootComponent } from 'expo'
import App from './src/App'

registerRootComponent(App)
