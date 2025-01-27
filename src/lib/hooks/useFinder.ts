import { FinderParams, FinderFunction } from '../types'
import { useConfig } from '../contexts/ConfigContext'

const FINDER = 'https://station-finder.pages.dev'

export default (): FinderFunction => {
  const { chain } = useConfig()
  const { chainID } = chain.current
  return ({ network, q, v }: FinderParams): string =>
    `${FINDER}/${network ?? chainID}/${q}/${v}`
}
