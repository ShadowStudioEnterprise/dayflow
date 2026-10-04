import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.dayflow.app',
  appName: 'Dayflow',
  webDir: 'dist',
  backgroundColor: '#f8f7fb',
  plugins: {
    LocalNotifications: {
      smallIcon: 'ic_stat_dayflow',
      iconColor: '#7562b4',
    },
  },
}
export default config
