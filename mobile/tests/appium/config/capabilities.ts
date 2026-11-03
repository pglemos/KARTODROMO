/**
 * Capabilities configuration for Appium tests following LambdaTest/appium-skill
 * Supports local iOS Simulator, local Android Emulator, and TestMu AI Cloud.
 */

export interface AppiumCapabilitiesConfig {
  platform: 'ios' | 'android';
  isCloud?: boolean;
  cloudOptions?: {
    user?: string;
    key?: string;
    build?: string;
    name?: string;
  };
}

export function getCapabilities(config: AppiumCapabilitiesConfig) {
  const { platform, isCloud, cloudOptions } = config;

  if (platform === 'ios') {
    const baseIosCaps: Record<string, any> = {
      platformName: 'iOS',
      'appium:automationName': 'XCUITest',
      'appium:deviceName': process.env.IOS_DEVICE_NAME || 'iPhone 17 Pro',
      'appium:platformVersion': process.env.IOS_PLATFORM_VERSION || '26.3',
      'appium:udid': process.env.IOS_UDID || 'B970BB5D-6E0B-405A-B338-C787B5B74002',
      'appium:bundleId': 'br.com.kartodromobetim.app',
      'appium:noReset': true,
      'appium:newCommandTimeout': 240,
      'appium:wdaLaunchTimeout': 180000,
      'appium:wdaConnectionTimeout': 180000,
      'appium:connectHardwareKeyboard': true,
    };

    if (isCloud && cloudOptions) {
      baseIosCaps['LT:Options'] = {
        w3c: true,
        build: cloudOptions.build || 'Kartodromo Appium Build',
        name: cloudOptions.name || 'iOS Test Suite',
        isRealMobile: true,
        video: true,
        network: true,
      };
    }

    return baseIosCaps;
  }

  // Android
  const baseAndroidCaps: Record<string, any> = {
    platformName: 'Android',
    'appium:automationName': 'UiAutomator2',
    'appium:deviceName': process.env.ANDROID_DEVICE_NAME || 'emulator-5554',
    'appium:appPackage': 'br.com.kartodromobetim.app',
    'appium:appActivity': '.MainActivity',
    'appium:noReset': true,
    'appium:newCommandTimeout': 240,
  };

  if (isCloud && cloudOptions) {
    baseAndroidCaps['LT:Options'] = {
      w3c: true,
      build: cloudOptions.build || 'Kartodromo Appium Build',
      name: cloudOptions.name || 'Android Test Suite',
      isRealMobile: true,
      video: true,
      network: true,
    };
  }

  return baseAndroidCaps;
}

export const APPIUM_HOST = process.env.APPIUM_HOST || '127.0.0.1';
export const APPIUM_PORT = Number(process.env.APPIUM_PORT || 4723);
