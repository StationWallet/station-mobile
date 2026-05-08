const files = new Map<string, string>()

export const cacheDirectory = 'file:///tmp/station-mobile-cache/'

export async function writeAsStringAsync(
  uri: string,
  contents: string
): Promise<void> {
  files.set(uri, contents)
}

export async function readAsStringAsync(uri: string): Promise<string> {
  const contents = files.get(uri)
  if (contents === undefined) {
    throw new Error(`File not found: ${uri}`)
  }
  return contents
}

export function __reset(): void {
  files.clear()
}
