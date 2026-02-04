import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.centsible.app",
  appName: "Centsible",
  webDir: "out",
  server: {
    // For development, you can use a live server
    // url: "http://localhost:3000",
    // cleartext: true,
  },
  plugins: {
    CapacitorSQLite: {
      iosDatabaseLocation: "Library/CapacitorDatabase",
      iosIsEncryption: false,
      androidIsEncryption: false,
      electronIsEncryption: false,
    },
  },
  android: {
    buildOptions: {
      keystorePath: undefined,
      keystoreAlias: undefined,
    },
  },
  ios: {
    scheme: "Centsible",
  },
};

export default config;
