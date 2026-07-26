/**
 * Stand-in for Nuxt's `#imports` build alias so runtime files can be imported by unit
 * tests. Tests that care about the values vi.mock this module; this default exists only
 * so module resolution succeeds.
 */
export function useRuntimeConfig(): Record<string, unknown> {
  return {};
}
