const {
  MsgSend, MsgDelegate, MsgUndelegate, MsgBeginRedelegate,
  MsgWithdrawDelegatorReward, MsgExecuteContract, MsgSwap,
  MsgDeposit, Coin, Coins,
} = require('../../polyfills/terra');

describe('MsgSend', () => {
  const msg = new MsgSend(
    'terra1sender',
    'terra1recipient',
    new Coins([new Coin('uluna', '1000000')])
  );

  test('toProto returns correct @type and fields', () => {
    const proto = msg.toProto();
    expect(proto['@type']).toBe('/cosmos.bank.v1beta1.MsgSend');
    expect(proto.from_address).toBe('terra1sender');
    expect(proto.to_address).toBe('terra1recipient');
    expect(proto.amount).toEqual([{ denom: 'uluna', amount: '1000000' }]);
  });

  test('toAmino returns correct type and value', () => {
    const amino = msg.toAmino();
    expect(amino.type).toBe('cosmos-sdk/MsgSend');
    expect(amino.value.from_address).toBe('terra1sender');
    expect(amino.value.to_address).toBe('terra1recipient');
  });

  test('toData delegates to toProto', () => {
    expect(msg.toData()).toEqual(msg.toProto());
  });
});

describe('MsgDelegate', () => {
  const msg = new MsgDelegate(
    'terra1delegator',
    'terravaloper1validator',
    new Coin('uluna', '500000')
  );

  test('toProto returns correct @type', () => {
    const proto = msg.toProto();
    expect(proto['@type']).toBe('/cosmos.staking.v1beta1.MsgDelegate');
    expect(proto.delegator_address).toBe('terra1delegator');
    expect(proto.validator_address).toBe('terravaloper1validator');
    expect(proto.amount).toEqual({ denom: 'uluna', amount: '500000' });
  });

  test('toAmino returns correct type', () => {
    expect(msg.toAmino().type).toBe('cosmos-sdk/MsgDelegate');
  });
});

describe('MsgUndelegate', () => {
  test('toProto has correct @type', () => {
    const msg = new MsgUndelegate('terra1d', 'terravaloper1v', new Coin('uluna', '100'));
    expect(msg.toProto()['@type']).toBe('/cosmos.staking.v1beta1.MsgUndelegate');
    expect(msg.toAmino().type).toBe('cosmos-sdk/MsgUndelegate');
  });
});

describe('MsgBeginRedelegate', () => {
  test('toProto has correct @type and fields', () => {
    const msg = new MsgBeginRedelegate('terra1d', 'terravaloper1src', 'terravaloper1dst', new Coin('uluna', '100'));
    const proto = msg.toProto();
    expect(proto['@type']).toBe('/cosmos.staking.v1beta1.MsgBeginRedelegate');
    expect(proto.validator_src_address).toBe('terravaloper1src');
    expect(proto.validator_dst_address).toBe('terravaloper1dst');
  });
});

describe('MsgWithdrawDelegatorReward', () => {
  test('toProto has correct @type', () => {
    const msg = new MsgWithdrawDelegatorReward('terra1d', 'terravaloper1v');
    expect(msg.toProto()['@type']).toBe('/cosmos.distribution.v1beta1.MsgWithdrawDelegationReward');
    expect(msg.toAmino().type).toBe('cosmos-sdk/MsgWithdrawDelegationReward');
  });
});

describe('MsgExecuteContract', () => {
  test('toProto has correct @type and execute_msg', () => {
    const msg = new MsgExecuteContract('terra1s', 'terra1contract', { swap: {} });
    const proto = msg.toProto();
    expect(proto['@type']).toBe('/cosmwasm.wasm.v1.MsgExecuteContract');
    expect(proto.sender).toBe('terra1s');
    expect(proto.contract).toBe('terra1contract');
    expect(proto.msg).toEqual({ swap: {} });
  });

  test('toAmino has correct type', () => {
    const msg = new MsgExecuteContract('terra1s', 'terra1c', { swap: {} });
    expect(msg.toAmino().type).toBe('wasm/MsgExecuteContract');
  });
});

describe('MsgSwap', () => {
  test('toProto has correct @type', () => {
    const msg = new MsgSwap('terra1t', new Coin('uusd', '1000'), 'uluna');
    expect(msg.toProto()['@type']).toBe('/terra.market.v1beta1.MsgSwap');
  });
});

describe('MsgDeposit', () => {
  test('toProto has correct @type', () => {
    const msg = new MsgDeposit(1, 'terra1d', new Coins([new Coin('uluna', '100')]));
    expect(msg.toProto()['@type']).toBe('/cosmos.gov.v1beta1.MsgDeposit');
  });
});
