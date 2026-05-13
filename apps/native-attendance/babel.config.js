const path = require('path');

module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    [
      'module:react-native-dotenv',
      {
        // Absolute path: Gradle/Android Studio often runs Metro with cwd = android/, so a
        // relative ".env" is not found and EXPO_PUBLIC_* vars stay undefined at runtime.
        path: path.resolve(__dirname, '.env'),
        safe: false,
        allowUndefined: true,
      },
    ],
  ],
};
