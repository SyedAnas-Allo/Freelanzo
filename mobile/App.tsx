import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BackHandler,
  Platform,
  StyleSheet,
  View,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import {
  WebView,
  type WebViewMessageEvent,
  type WebViewNavigation,
} from "react-native-webview";
import type { ShouldStartLoadRequest } from "react-native-webview/lib/WebViewTypes";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { BRAND, WEB_URL } from "./src/config";
import { SplashScreen } from "./src/SplashScreen";
import {
  getAppReturnDeepLink,
  isGoogleUrl,
  isSupabaseAuthorizeUrl,
  openOAuthInSystemBrowser,
  sessionDeepLinkToWebUrl,
} from "./src/oauth";

export default function App() {
  const webRef = useRef<WebView>(null);
  const oauthLock = useRef(false);
  const [uri, setUri] = useState(WEB_URL);
  const [canGoBack, setCanGoBack] = useState(false);
  const [loading, setLoading] = useState(true);

  const appReturn = useMemo(() => getAppReturnDeepLink(), []);

  const injectedJavaScript = useMemo(() => {
    const redirect = JSON.stringify(appReturn);
    return `
      (function () {
        window.__FREELANZO_NATIVE__ = true;
        window.__FREELANZO_OAUTH_REDIRECT__ = ${redirect};
        true;
      })();
    `;
  }, [appReturn]);

  useEffect(() => {
    console.log("App return deep link:", appReturn);
  }, [appReturn]);

  const finishOAuth = useCallback(async (oauthUrl: string) => {
    if (oauthLock.current) return;
    oauthLock.current = true;
    try {
      const next = await openOAuthInSystemBrowser(oauthUrl);
      if (next) {
        setUri(next);
        setLoading(true);
      }
    } finally {
      oauthLock.current = false;
    }
  }, []);

  useEffect(() => {
    void WebBrowser.warmUpAsync().catch(() => undefined);
    return () => {
      void WebBrowser.coolDownAsync().catch(() => undefined);
    };
  }, []);

  useEffect(() => {
    const onUrl = ({ url }: { url: string }) => {
      const next = sessionDeepLinkToWebUrl(url);
      if (next) {
        void WebBrowser.dismissAuthSession();
        oauthLock.current = false;
        setUri(next);
        setLoading(true);
      }
    };
    const sub = Linking.addEventListener("url", onUrl);
    void Linking.getInitialURL().then((url) => {
      if (url) onUrl({ url });
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (Platform.OS !== "android") return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (canGoBack) {
        webRef.current?.goBack();
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [canGoBack]);

  function handleShouldStartLoad(request: ShouldStartLoadRequest): boolean {
    const { url } = request;
    if (!url || url === "about:blank") return true;

    if (
      url.startsWith("tel:") ||
      url.startsWith("mailto:") ||
      url.startsWith("whatsapp:") ||
      url.startsWith("sms:")
    ) {
      void Linking.openURL(url).catch(() => undefined);
      return false;
    }

    if (isSupabaseAuthorizeUrl(url) || isGoogleUrl(url)) {
      void finishOAuth(url);
      return false;
    }

    return true;
  }

  function handleMessage(event: WebViewMessageEvent) {
    try {
      const data = JSON.parse(event.nativeEvent.data) as {
        type?: string;
        url?: string;
      };
      if (data.type === "OAUTH_START" && data.url) {
        void finishOAuth(data.url);
      }
    } catch {
      // ignore
    }
  }

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.flex} edges={["top", "bottom"]}>
        <StatusBar style="dark" />
        <View style={styles.flex}>
          <WebView
            ref={webRef}
            source={{ uri }}
            style={styles.flex}
            injectedJavaScriptBeforeContentLoaded={injectedJavaScript}
            injectedJavaScript={injectedJavaScript}
            onShouldStartLoadWithRequest={handleShouldStartLoad}
            onNavigationStateChange={(nav: WebViewNavigation) => {
              setCanGoBack(nav.canGoBack);
            }}
            onMessage={handleMessage}
            geolocationEnabled
            mediaCapturePermissionGrantType="grant"
            allowsInlineMediaPlayback
            mediaPlaybackRequiresUserAction={false}
            sharedCookiesEnabled
            thirdPartyCookiesEnabled
            domStorageEnabled
            javaScriptEnabled
            setSupportMultipleWindows={false}
            originWhitelist={["*"]}
            startInLoadingState
            onLoadStart={() => setLoading(true)}
            onLoadEnd={() => setLoading(false)}
            pullToRefreshEnabled={Platform.OS === "android"}
          />
          {loading ? <SplashScreen /> : null}
        </View>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: BRAND.background },
});
