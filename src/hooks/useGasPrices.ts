import {useQuery} from '@tanstack/react-query';
import {fcd} from 'lib';
import {QueryKeyEnum} from 'types';

const useGasPrices = (): {
  gasPrices: {
    [denom: string]: string;
  };
} => {
  const defaultGasPrices = {uusd: '0.456'};

  const {data: gasPrices = defaultGasPrices} = useQuery<{
    [denom: string]: string;
  }>({
    queryKey: [QueryKeyEnum.gasPrices],
    queryFn: async () => {
      const {data} = await fcd.get('/v1/txs/gas_prices');
      return data;
    },
  });

  return {
    gasPrices,
  };
};

export default useGasPrices;
