import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.chatui.app',
  appName: 'ChatUI',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
