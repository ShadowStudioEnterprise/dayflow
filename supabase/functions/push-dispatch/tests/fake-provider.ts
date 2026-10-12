export const provider = { fail: false }
export default {
  setVapidDetails(..._args: unknown[]) {},
  generateRequestDetails(..._args: unknown[]) {
    if (provider.fail)
      throw new Error('secret endpoint content must not be logged')
    return {
      endpoint: 'https://fcm.googleapis.com/fake',
      headers: {},
      body: new Uint8Array(),
    }
  },
}
