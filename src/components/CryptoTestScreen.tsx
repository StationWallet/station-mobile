import React, { useEffect, useState } from 'react'
import { ScrollView, Text, View } from 'react-native'
import {
  MnemonicKey,
  RawKey,
  AccAddress,
  ValAddress,
  SimplePublicKey,
} from '@terra-money/terra.js'

const MNEMONIC_1 =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
const MNEMONIC_2 = 'zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo wrong'
const PRIVKEY_1 =
  '05be413bb5bd1fb67757251976dd43adf0d4db27d1a5444b4f6ef754ef939b10'

const crypto = require('crypto')

type Result = Record<string, string>

function runTests(): Result {
  const r: Result = {}

  try {
    const mk330 = new MnemonicKey({
      mnemonic: MNEMONIC_1,
      coinType: 330,
    })
    r['mk330-address'] = mk330.accAddress
    r['mk330-privkey'] = mk330.privateKey.toString('hex')
    r['mk330-pubkey'] =
      (mk330.publicKey as SimplePublicKey)?.key || ''

    const mk118 = new MnemonicKey({
      mnemonic: MNEMONIC_1,
      coinType: 118,
    })
    r['mk118-address'] = mk118.accAddress
    r['mk118-privkey'] = mk118.privateKey.toString('hex')
    r['mk118-pubkey'] =
      (mk118.publicKey as SimplePublicKey)?.key || ''

    const mk2_330 = new MnemonicKey({
      mnemonic: MNEMONIC_2,
      coinType: 330,
    })
    r['mk2-330-address'] = mk2_330.accAddress
    r['mk2-330-privkey'] = mk2_330.privateKey.toString('hex')

    const mk2_118 = new MnemonicKey({
      mnemonic: MNEMONIC_2,
      coinType: 118,
    })
    r['mk2-118-address'] = mk2_118.accAddress

    const mk2_custom = new MnemonicKey({
      mnemonic: MNEMONIC_2,
      coinType: 330,
      account: 1,
      index: 2,
    })
    r['mk2-custom-address'] = mk2_custom.accAddress
    r['mk2-custom-privkey'] = mk2_custom.privateKey.toString('hex')

    const rk = new RawKey(Buffer.from(PRIVKEY_1, 'hex'))
    r['rawkey-address'] = rk.accAddress
    r['rawkey-pubkey'] = (rk.publicKey as SimplePublicKey)?.key || ''

    const sig = rk.ecdsaSign(Buffer.from('test message to sign'))
    r['sign-payload'] = Buffer.from(sig.signature).toString('hex')
    r['ecdsa-recid'] = String(sig.recid)

    r['validate-valid'] = String(
      AccAddress.validate(
        'terra1amdttz2937a3dytmxmkany53pp6ma6dy4vsllv'
      )
    )
    r['validate-invalid'] = String(
      AccAddress.validate('notanaddress')
    )
    r['validate-wrong-prefix'] = String(
      AccAddress.validate(
        'cosmos1amdttz2937a3dytmxmkany53pp6ma6dyzr7hkl'
      )
    )
    r['valaddress-valid'] = String(
      ValAddress.validate(mk330.valAddress)
    )
    r['fromval'] = AccAddress.fromValAddress(mk330.valAddress)

    const genMk = new MnemonicKey()
    r['gen-wordcount'] = String(genMk.mnemonic.split(' ').length)
    r['gen-has-address'] = String(
      genMk.accAddress.startsWith('terra')
    )
    r['gen-privkey-length'] = String(genMk.privateKey.length)

    r['hash-sha256'] = crypto
      .createHash('sha256')
      .update('hello world')
      .digest('hex')
    r['hash-sha512'] = crypto
      .createHash('sha512')
      .update('hello world')
      .digest('hex')
    r['hash-ripemd160'] = crypto
      .createHash('ripemd160')
      .update('hello world')
      .digest('hex')
    r['hmac-sha256'] = crypto
      .createHmac('sha256', 'secret-key')
      .update('hello world')
      .digest('hex')

    let hashThrew = false
    try {
      crypto.createHash('md5')
    } catch {
      hashThrew = true
    }
    r['hash-unsupported-throws'] = String(hashThrew)

    const rb = crypto.randomBytes(32)
    r['random-not-zero'] = String(!rb.every((b: number) => b === 0))
    r['random-length'] = String(rb.length)
    const rb2 = crypto.randomBytes(32)
    r['random-unique'] = String(!rb.equals(rb2))
  } catch (e: unknown) {
    r['_error'] = e instanceof Error ? e.message : String(e)
  }

  return r
}

export default function CryptoTestScreen(): React.ReactElement {
  const [results, setResults] = useState<Result>({})

  useEffect(() => {
    setResults(runTests())
  }, [])

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: '#000', padding: 16 }}
    >
      <Text style={{ color: '#0f0', fontSize: 18, marginBottom: 12 }}>
        Crypto Parity Results
      </Text>
      {Object.entries(results).map(([id, value]) => (
        <View key={id} style={{ marginBottom: 4 }}>
          <Text testID={id} style={{ color: '#fff', fontSize: 12 }}>
            {value}
          </Text>
          <Text style={{ color: '#888', fontSize: 10 }}>{id}</Text>
        </View>
      ))}
    </ScrollView>
  )
}
