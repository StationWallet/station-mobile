// Fetch-based LCD client for Cosmos REST endpoints.
// Replaces terra.js LCDClient stubs with real HTTP requests.
//
// Rate limiting: not implemented. ~20+ queries may fire on startup.
// No rate limiting observed on PublicNode or Polkachu, but not guaranteed.

// Lazy-load terra types to avoid circular dependency (terra.js <-> terra-lcd.js).
// By the time any of these are called at runtime the module graph is fully resolved.
var cachedTerraTypes = null;
function getTerraTypes() {
  if (!cachedTerraTypes) cachedTerraTypes = require('./terra');
  return cachedTerraTypes;
}

// --- Helpers ---

async function fetchJSON(url) {
  let res;
  try {
    res = await fetch(url);
  } catch (err) {
    throw new Error(`Network error fetching ${url}: ${err.message}`);
  }
  if (!res.ok) {
    let body = '';
    try { body = await res.text(); } catch (_) {}
    const err = new Error(`HTTP ${res.status} ${res.statusText} from ${url}`);
    err.status = res.status;
    err.statusText = res.statusText;
    err.body = body;
    throw err;
  }
  return res.json();
}

async function postJSON(url, body) {
  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch (err) {
    throw new Error(`Network error posting to ${url}: ${err.message}`);
  }
  if (!res.ok) {
    let responseBody = '';
    try { responseBody = await res.text(); } catch (_) {}
    const err = new Error(`HTTP ${res.status} ${res.statusText} from ${url}`);
    err.status = res.status;
    err.statusText = res.statusText;
    err.body = responseBody;
    throw err;
  }
  return res.json();
}

function parseCoins(coinArray) {
  var types = getTerraTypes();
  var Coin = types.Coin;
  var Coins = types.Coins;
  if (!Array.isArray(coinArray)) return new Coins([]);
  return new Coins(coinArray.map(c => new Coin(c.denom, c.amount)));
}

// --- Factory ---

function createLCD(baseURL) {
  // Strip trailing slash
  const base = (baseURL || '').replace(/\/+$/, '');

  // --- auth module ---
  const auth = {
    async accountInfo(address) {
      const data = await fetchJSON(`${base}/cosmos/auth/v1beta1/accounts/${address}`);
      // Handle both regular accounts and vesting accounts (which nest under base_account)
      const raw = data.account || {};
      const account = raw.base_account || raw;

      const account_number = parseInt(account.account_number || '0', 10);
      const sequence = parseInt(account.sequence || '0', 10);

      return {
        account_number,
        sequence,
        getAccountNumber() { return account_number; },
        getSequenceNumber() { return sequence; },
      };
    },
  };

  // --- bank module ---
  const bank = {
    async balance(address) {
      const data = await fetchJSON(`${base}/cosmos/bank/v1beta1/balances/${address}`);
      const coins = parseCoins(data.balances);
      const pagination = data.pagination || null;
      return [coins, pagination];
    },

    async total() {
      const data = await fetchJSON(`${base}/cosmos/bank/v1beta1/supply`);
      return parseCoins(data.supply);
    },
  };

  // --- tx module ---
  const tx = {
    // Stub — full simulation deferred to Task 7/8
    async create(_signers, _options) {
      var Tx = getTerraTypes().Tx;
      return new Tx();
    },

    async estimateFee(_signers, options) {
      var types = getTerraTypes();
      var Fee = types.Fee;
      var Coin = types.Coin;
      try {
        const msgs = (options && options.msgs) || [];
        const body = {
          tx: {
            body: {
              messages: msgs.map(m => (typeof m.toProto === 'function' ? m.toProto() : m)),
              memo: (options && options.memo) || '',
            },
            auth_info: {
              signer_infos: [],
              fee: { amount: [], gas_limit: '200000' },
            },
            signatures: [],
          },
        };
        const data = await postJSON(`${base}/cosmos/tx/v1beta1/simulate`, body);
        const gasUsed = parseInt((data.gas_info && data.gas_info.gas_used) || '200000', 10);
        // Apply 1.4x gas adjustment
        const gasLimit = Math.ceil(gasUsed * 1.4);
        return new Fee(gasLimit, [new Coin('uluna', '3000')]);
      } catch (_err) {
        // Fallback to default fee on error
        return new Fee(200000, [new Coin('uluna', '3000')]);
      }
    },

    async broadcastSync(txBytes) {
      const body = {
        tx_bytes: txBytes,
        mode: 'BROADCAST_MODE_SYNC',
      };
      const data = await postJSON(`${base}/cosmos/tx/v1beta1/txs`, body);
      const result = data.tx_response || data;
      return {
        txhash: result.txhash || '',
        raw_log: result.raw_log || '',
      };
    },

    async broadcast(txBytes) {
      const body = {
        tx_bytes: txBytes,
        mode: 'BROADCAST_MODE_BLOCK',
      };
      const data = await postJSON(`${base}/cosmos/tx/v1beta1/txs`, body);
      const result = data.tx_response || data;
      return {
        txhash: result.txhash || '',
        raw_log: result.raw_log || '',
      };
    },

    async txInfo(hash) {
      var TxInfo = getTerraTypes().TxInfo;
      const data = await fetchJSON(`${base}/cosmos/tx/v1beta1/txs/${hash}`);
      return new TxInfo(data.tx_response || data);
    },

    async txsByEvents(events, params) {
      var TxInfo = getTerraTypes().TxInfo;
      params = params || {};
      // events can be a string or an array
      const eventList = Array.isArray(events) ? events : [events];
      const queryParams = new URLSearchParams();
      for (const ev of eventList) {
        queryParams.append('events', ev);
      }
      if (params.order_by) queryParams.set('order_by', params.order_by);
      if (params['pagination.limit']) {
        queryParams.set('pagination.limit', params['pagination.limit']);
      } else if (params.limit) {
        queryParams.set('pagination.limit', params.limit);
      }
      const data = await fetchJSON(`${base}/cosmos/tx/v1beta1/txs?${queryParams.toString()}`);
      const txResponses = (data.tx_responses || []).map(r => new TxInfo(r));
      return {
        txs: data.txs || [],
        tx_responses: txResponses,
        pagination: data.pagination || null,
      };
    },
  };

  // --- staking module ---
  const staking = {
    async validators(status) {
      const url = status
        ? `${base}/cosmos/staking/v1beta1/validators?status=${encodeURIComponent(status)}`
        : `${base}/cosmos/staking/v1beta1/validators`;
      const data = await fetchJSON(url);
      return [data.validators || [], data.pagination || null];
    },

    async validator(addr) {
      const data = await fetchJSON(`${base}/cosmos/staking/v1beta1/validators/${addr}`);
      return data.validator || data;
    },

    async delegations(delegator) {
      var Coin = getTerraTypes().Coin;
      const data = await fetchJSON(`${base}/cosmos/staking/v1beta1/delegations/${delegator}`);
      const responses = (data.delegation_responses || []).map(r => ({
        delegation: r.delegation,
        balance: new Coin(r.balance.denom, r.balance.amount),
      }));
      return [responses, data.pagination || null];
    },

    async delegation(delegator, validator) {
      try {
        const data = await fetchJSON(
          `${base}/cosmos/staking/v1beta1/validators/${validator}/delegations/${delegator}`
        );
        return data.delegation_response || data;
      } catch (_err) {
        return null;
      }
    },

    async unbondingDelegations(delegator) {
      const data = await fetchJSON(
        `${base}/cosmos/staking/v1beta1/delegators/${delegator}/unbonding_delegations`
      );
      return [data.unbonding_responses || [], data.pagination || null];
    },

    async pool() {
      const data = await fetchJSON(`${base}/cosmos/staking/v1beta1/pool`);
      return data.pool || data;
    },
  };

  // --- distribution module ---
  const distribution = {
    async rewards(delegator) {
      const data = await fetchJSON(
        `${base}/cosmos/distribution/v1beta1/delegators/${delegator}/rewards`
      );
      const total = parseCoins(data.total);
      const rewardsMap = {};
      for (const r of (data.rewards || [])) {
        rewardsMap[r.validator_address] = parseCoins(r.reward);
      }
      return { total, rewards: rewardsMap };
    },

    async communityPool() {
      const data = await fetchJSON(`${base}/cosmos/distribution/v1beta1/community_pool`);
      return parseCoins(data.pool);
    },

    async validatorCommission(validator) {
      const data = await fetchJSON(
        `${base}/cosmos/distribution/v1beta1/validators/${validator}/commission`
      );
      return data.commission || data;
    },

    async withdrawAddress(delegator) {
      const data = await fetchJSON(
        `${base}/cosmos/distribution/v1beta1/delegators/${delegator}/withdraw_address`
      );
      return data.withdraw_address || '';
    },
  };

  // --- oracle module (Classic only — graceful failures on Phoenix-1) ---
  const oracle = {
    async activeDenoms() {
      try {
        const data = await fetchJSON(`${base}/terra/oracle/v1beta1/denoms/actives`);
        return data.actives || [];
      } catch (_err) {
        return [];
      }
    },

    async exchangeRates() {
      try {
        const data = await fetchJSON(`${base}/terra/oracle/v1beta1/denoms/exchange_rates`);
        return parseCoins(data.exchange_rates);
      } catch (_err) {
        var Coins = getTerraTypes().Coins;
        return new Coins([]);
      }
    },

    async parameters() {
      try {
        const data = await fetchJSON(`${base}/terra/oracle/v1beta1/params`);
        return data.params || {};
      } catch (_err) {
        return {};
      }
    },
  };

  // --- market module ---
  const market = {
    async swapRate(offerCoin, askDenom) {
      var Coin = getTerraTypes().Coin;
      try {
        const offerStr = `${offerCoin.amount}${offerCoin.denom}`;
        const data = await fetchJSON(
          `${base}/terra/market/v1beta1/swap?offer_coin=${encodeURIComponent(offerStr)}&ask_denom=${encodeURIComponent(askDenom)}`
        );
        const r = data.return_coin || data;
        return new Coin(r.denom, r.amount);
      } catch (_err) {
        return new Coin(askDenom, '0');
      }
    },
  };

  // --- ibc module ---
  const ibc = {
    async denomTrace(hash) {
      const data = await fetchJSON(
        `${base}/ibc/apps/transfer/v1beta1/denom_traces/${hash}`
      );
      return data;
    },
  };

  return { auth, bank, tx, staking, distribution, oracle, market, ibc };
}

module.exports = createLCD;
