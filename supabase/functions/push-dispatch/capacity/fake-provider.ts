export default {
  setVapidDetails(..._args: unknown[]) {},
  generateRequestDetails(..._args: unknown[]) {
    return {
      endpoint: 'https://fcm.googleapis.com/test-only',
      headers: {},
      body: new Uint8Array(),
    }
  },
}
