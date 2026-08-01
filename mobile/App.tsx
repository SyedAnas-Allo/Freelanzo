import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BackHandler, Platform, StyleSheet, View } from "react-native";
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
  const handledAuthUrl = useRef<string | null>(null);
  const booted = useRef(false);
  const [uri, setUri] = useState(WEB_URL);
  const [canGoBack, setCanGoBack] = useState(false);
  /** Full splash — cold start only. */
  const [showSplash, setShowSplash] = useState(true);
  /** Thin top bar for later navigations — never covers the page. */
  const [pageLoading, setPageLoading] = useState(false);

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

  const dismissSplash = useCallback(() => {
    booted.current = true;
    setShowSplash(false);
  }, []);

  // Never leave the splash stuck if a load hangs.
  useEffect(() => {
    if (!showSplash) return;
    const t = setTimeout(dismissSplash, 6000);
    return () => clearTimeout(t);
  }, [showSplash, dismissSplash]);

  const applyAuthReturn = useCallback((rawUrl: string) => {
    try {
      const next = sessionDeepLinkToWebUrl(rawUrl);
      if (!next) return false;
      if (handledAuthUrl.current === next) return true;
      handledAuthUrl.current = next;
      oauthLock.current = false;
      // Keep the current page visible; only a thin progress bar.
      dismissSplash();
      setUri(next);
      setPageLoading(true);
      return true;
    } catch (e) {
      console.warn("applyAuthReturn failed", e);
      return false;
    }
  }, [dismissSplash]);

  const finishOAuth = useCallback(
    async (oauthUrl: string) => {
      if (oauthLock.current) return;
      oauthLock.current = true;
      handledAuthUrl.current = null;
      try {
        const next = await openOAuthInSystemBrowser(oauthUrl);
        if (next && handledAuthUrl.current !== next) {
          handledAuthUrl.current = next;
          dismissSplash();
          setUri(next);
          setPageLoading(true);
        }
      } catch (e) {
        console.warn("finishOAuth failed", e);
      } finally {
        oauthLock.current = false;
      }
    },
    [dismissSplash],
  );

  useEffect(() => {
    void WebBrowser.warmUpAsync().catch(() => undefined);
    return () => {
      void WebBrowser.coolDownAsync().catch(() => undefined);
    };
  }, []);

  useEffect(() => {
    const onUrl = ({ url }: { url: string }) => {
      if (!url) return;
      applyAuthReturn(url);
    };
    const sub = Linking.addEventListener("url", onUrl);
    void Linking.getInitialURL()
      .then((url) => {
        if (url) onUrl({ url });
      })
      .catch(() => undefined);
    return () => sub.remove();
  }, [applyAuthReturn]);

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
      url.startsWith("freelanzo:") ||
      url.startsWith("intent:") ||
      url.startsWith("exp:") ||
      url.startsWith("exps:")
    ) {
      applyAuthReturn(url);
      return false;
    }

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
              if (!nav.loading) {
                setPageLoading(false);
                if (!booted.current) dismissSplash();
              }
            }}
            onMessage={handleMessage}
            onError={(e) => {
              console.warn("WebView error", e.nativeEvent);
              setPageLoading(false);
              dismissSplash();
            }}
            geolocationEnabled
            mediaCapturePermissionGrantType="grant"
            allowsInlineMediaPlayback
            mediaPlaybackRequiresUserAction={false}
            sharedCookiesEnabled
            thirdPartyCookiesEnabled
            domStorageEnabled
            javaScriptEnabled
            setSupportMultipleWindows={false}
            originWhitelist={["https://*", "http://*"]}
            onLoadStart={() => {
              if (booted.current) setPageLoading(true);
            }}
            onLoadEnd={() => {
              setPageLoading(false);
              dismissSplash();
            }}
            pullToRefreshEnabled={Platform.OS === "android"}
          />

          {pageLoading && !showSplash ? (
            <View style={styles.progressTrack} pointerEvents="none">
              <View style={styles.progressBar} />
            </View>
          ) : null}

          {showSplash ? <SplashScreen /> : null}
        </View>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: BRAND.background },
  progressTrack: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: "transparent",
    zIndex: 5,
  },
  progressBar: {
    height: 2,
    width: "40%",
    backgroundColor: BRAND.primary,
    borderRadius: 1,
  },
});
