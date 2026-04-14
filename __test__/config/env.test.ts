import { MIGRATION_FLOW_ENABLED } from '../../src/config/env'

describe('feature flags', () => {
  test('MIGRATION_FLOW_ENABLED defaults to false', () => {
    expect(MIGRATION_FLOW_ENABLED).toBe(false)
  })
})
