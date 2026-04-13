import { env } from '../config/env'
import { sleep } from '../utils/mpcCrypto'

/** Register this party on the relay server. */
export async function joinRelaySession(
  sessionId: string,
  localPartyId: string
): Promise<void> {
  const res = await fetch(`${env.relayUrl}/${sessionId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify([localPartyId]),
  })
  if (!res.ok) {
    throw new Error(
      `Join relay failed: ${res.status} ${await res.text()}`
    )
  }
}

/** Poll relay until expected number of parties have joined. */
export async function waitForParties(
  sessionId: string,
  expectedCount: number,
  timeoutMs = 120_000,
  signal?: AbortSignal
): Promise<string[]> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    if (signal?.aborted) throw new Error('Aborted')
    const res = await fetch(`${env.relayUrl}/${sessionId}`, {
      signal,
    })
    if (res.ok) {
      const parties: string[] = await res.json()
      if (parties.length >= expectedCount) return parties
    }
    await sleep(1000)
  }
  throw new Error('Timeout waiting for parties to join relay')
}

/** Start the MPC session with all parties. */
export async function startRelaySession(
  sessionId: string,
  parties: string[]
): Promise<void> {
  const res = await fetch(`${env.relayUrl}/start/${sessionId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(parties),
  })
  if (!res.ok) {
    throw new Error(`Start session failed: ${res.status}`)
  }
}

/** Send an encrypted message to a peer via relay. */
export async function sendRelayMessage(
  sessionId: string,
  from: string,
  to: string,
  body: string,
  hash: string,
  sequenceNo: number,
  messageId?: string
): Promise<void> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (messageId) headers.message_id = messageId

  const res = await fetch(`${env.relayUrl}/message/${sessionId}`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      session_id: sessionId,
      from,
      to: [to],
      body,
      hash,
      sequence_no: sequenceNo,
    }),
  })
  if (!res.ok) {
    throw new Error(`Send message failed: ${res.status}`)
  }
}

/** Get pending messages from relay for this party. */
export async function getRelayMessages(
  sessionId: string,
  localPartyId: string,
  messageId?: string
): Promise<
  Array<{
    from: string
    to: string[]
    body: string
    hash: string
    sequence_no: number
  }>
> {
  const headers: Record<string, string> = {}
  if (messageId) headers.message_id = messageId

  const res = await fetch(
    `${env.relayUrl}/message/${sessionId}/${localPartyId}`,
    { headers }
  )
  if (!res.ok) {
    if (res.status === 404) return []
    throw new Error(`Get messages failed: ${res.status}`)
  }
  return res.json()
}

/** Upload encrypted setup message for the other party. */
export async function uploadSetupMessage(
  sessionId: string,
  encryptedMessage: string,
  messageId?: string
): Promise<void> {
  const headers: Record<string, string> = {
    'Content-Type': 'text/plain',
  }
  if (messageId) headers.message_id = messageId
  const res = await fetch(
    `${env.relayUrl}/setup-message/${sessionId}`,
    {
      method: 'POST',
      headers,
      body: encryptedMessage,
    }
  )
  if (!res.ok) {
    throw new Error(
      `Upload setup message failed: ${res.status} ${await res.text()}`
    )
  }
}

/** Signal this party has completed the ceremony. */
export async function signalComplete(
  sessionId: string,
  localPartyId: string
): Promise<void> {
  const res = await fetch(`${env.relayUrl}/complete/${sessionId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify([localPartyId]),
  })
  if (!res.ok) {
    throw new Error(`Signal complete failed: ${res.status}`)
  }
}

/** Wait for all parties to signal completion. */
export async function waitForComplete(
  sessionId: string,
  parties: string[],
  attempts = 60,
  delayMs = 1000,
  signal?: AbortSignal
): Promise<void> {
  for (let i = 0; i < attempts; i++) {
    if (signal?.aborted) throw new Error('Aborted')
    const res = await fetch(`${env.relayUrl}/complete/${sessionId}`, {
      signal,
    })
    if (res.ok) {
      const completePeers: string[] = await res.json()
      if (parties.every((p) => completePeers.includes(p))) return
    }
    await sleep(delayMs)
  }
  throw new Error('Timeout waiting for all parties to complete')
}

/** Delete a processed message from relay. */
export async function deleteRelayMessage(
  sessionId: string,
  localPartyId: string,
  messageHash: string,
  messageId?: string
): Promise<void> {
  const headers: Record<string, string> = {}
  if (messageId) headers.message_id = messageId
  await fetch(
    `${env.relayUrl}/message/${sessionId}/${localPartyId}/${messageHash}`,
    {
      method: 'DELETE',
      headers,
    }
  )
}
