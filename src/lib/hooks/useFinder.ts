import { useConfig } from '../contexts/ConfigContext'

interface FinderParams {
  network?: string
  q: string
  v: string
}

type FinderFunction = (params: FinderParams) => string

const FINDER = 'https://finder.terra.money'

export default (): FinderFunction => {
  const { chain } = useConfig()
  const { chainID } = chain.current
  return ({ network, q, v }: FinderParams): string =>
    `${FINDER}/${network ?? chainID}/${q}/${v}`
}
