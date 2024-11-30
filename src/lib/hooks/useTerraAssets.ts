import axios from 'axios'
import { useQuery } from 'react-query'
import { QueryKeyEnum } from 'types'

const config = {
  baseURL: 'https://station-assets-production.up.railway.app',
}

const useTerraAssets = <T = any>(
  path: string
): {
  data?: T
  loading: boolean
  error: unknown
} => {
  const { data, isLoading, error } = useQuery<T>(
    [QueryKeyEnum.terraAssets, path],
    async () => {
      try {
        const { data } = await axios.get(path, config)
        return data
      } catch {}
    }
  )

  return { data, loading: isLoading, error }
}

export default useTerraAssets
