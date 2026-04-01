import { useQuery } from 'react-query'

import { useMemo } from 'react'
import { QueryKeyEnum } from 'types/reactQuery'
import _ from 'lodash'

import { UTIL } from 'consts'

import { useCurrentChainName, Whitelist } from 'lib'
import preferences, {
  PreferencesEnum,
} from 'nativeModules/preferences'

const useTokens = (): {
  tokens: Whitelist
  addToken: (params: Whitelist) => Promise<void>
  removeToken: (token: string) => Promise<void>
} => {
  const chainName = useCurrentChainName()

  const { data: allNetworkTokens = {}, refetch } = useQuery(
    [QueryKeyEnum.tokens, chainName],
    async () => {
      const strData = await preferences.getString(
        PreferencesEnum.tokens
      )
      return UTIL.jsonTryParse<Dictionary<Whitelist>>(strData || '{}')
    }
  )

  const addToken = async (params: Whitelist): Promise<void> => {
    const next = {
      ...allNetworkTokens,
      [chainName]: { ...allNetworkTokens[chainName], ...params },
    }
    await preferences.setString(
      PreferencesEnum.tokens,
      JSON.stringify(next)
    )
    refetch()
  }

  const removeToken = async (token: string): Promise<void> => {
    const next = {
      ...allNetworkTokens,
      [chainName]: _.omit(allNetworkTokens[chainName], token),
    }
    await preferences.setString(
      PreferencesEnum.tokens,
      JSON.stringify(next)
    )
    refetch()
  }

  const tokens = useMemo(() => allNetworkTokens[chainName] || {}, [
    allNetworkTokens,
  ])

  return {
    tokens,
    addToken,
    removeToken,
  }
}

export default useTokens
