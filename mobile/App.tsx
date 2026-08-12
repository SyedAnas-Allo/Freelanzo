import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  AppState,
  type AppStateStatus,
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
import { APP_USER_AGENT_TOKEN, BRAND, WEB_URL } from "./src/config";
import { SplashScreen } from "./src/SplashScreen";
import {
  getAppReturnDeepLink,
  isGoogleUrl,
  isSupabaseAuthorizeUrl,
  openOAuthInSystemBrowser,
  sessionDeepLinkToWebUrl,
} from "./src/oauth";

async function openExternalScheme(url: string) {
  try {
    await Linking.openURL(url);
  } catch (e) {
    console.warn("openExternalScheme failed", url, e);
    const phone = url.replace(/^tel:/i, "");
    Alert.alert(
      "Can't open dialer",
      phone
        ? `Please dial ${phone} manually.`
        : "This link isn't supported on this device.",
    );
  }
}

export default function App() {
  const webRef = useRef<WebView>(null);
  const oauthLock = useRef(false);
  const handledAuthUrl = useRef<string | null>(null);
  const booted = useRef(false);
  const appState = useRef<AppStateStatus>(AppState.currentState);
  const [uri, setUri] = useState(WEB_URL);
  const [canGoBack, setCanGoBack] = useState(false);
  /** Full splash — cold start only. */
  const [showSplash, setShowSplash] = useState(true);
  /** Thin top bar for later navigations — never covers the page. */
  const [pageLoading, setPageLoading] = useState(false);

  const appReturn = useMemo(() => getAppReturnDeepLink(), []);

  const injectedJavaScript = useMemo(() => {
    const redirect = JSON.stringify(appReturn);
    // Intercept tel:/mailto:/sms: and target=_blank / maps — WKWebView
    // often ignores scheme navigations and blocks window.open when
    // setSupportMultipleWindows is false.
    return `
      (function () {
        window.__FREELANZO_NATIVE__ = true;
        window.__FREELANZO_OAUTH_REDIRECT__ = ${redirect};
        if (!window.__FREELANZO_LINK_HOOK__) {
          window.__FREELANZO_LINK_HOOK__ = true;
          function postOpen(url) {
            if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
              window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'OPEN_URL', url: url }));
            }
          }
          document.addEventListener('click', function (e) {
            var el = e.target;
            while (el && el.tagName !== 'A') el = el.parentElement;
            if (!el || !el.href) return;
            var href = el.href;
            if (/^(tel|mailto|sms|whatsapp):/i.test(href)) {
              e.preventDefault();
              e.stopPropagation();
              postOpen(href);
              return;
            }
            if (!/^https?:/i.test(href)) return;
            var blank = (el.getAttribute('target') || '').toLowerCase() === '_blank';
            var maps = /google\\.[^/]+\\/maps|maps\\.google\\.|maps\\.apple\\.com|openstreetmap\\.org/i.test(href);
            var wa = /wa\\.me\\//i.test(href) || /api\\.whatsapp\\.com\\//i.test(href);
            if (blank || maps || wa) {
              e.preventDefault();
              e.stopPropagation();
              postOpen(href);
            }
          }, true);
        }
        true;
      })();
    `;
  }, [appReturn]);

  const notifyWebForeground = useCallback(() => {
    webRef.current?.injectJavaScript(`
      try {
        window.dispatchEvent(new Event('freelanzo-foreground'));
        if (typeof document !== 'undefined') {
          document.dispatchEvent(new Event('visibilitychange'));
        }
      } catch (e) {}
      true;
    `);
  }, []);

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

  // WebView suspends websockets in background — poke the page on resume.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (next) => {
      const prev = appState.current;
      appState.current = next;
      if (
        next === "active" &&
        (prev === "background" || prev === "inactive")
      ) {
        notifyWebForeground();
      }
    });
    return () => sub.remove();
  }, [notifyWebForeground]);

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
      void openExternalScheme(url);
      return false;
    }

    if (isSupabaseAuthorizeUrl(url) || isGoogleUrl(url)) {
      void finishOAuth(url);
      return false;
    }

    // Keep Freelanzo pages in the WebView; open maps / WhatsApp outside.
    if (
      /^https?:/i.test(url) &&
      (/google\.[^/]+\/maps|maps\.google\.|maps\.apple\.com/i.test(url) ||
        /wa\.me\/|api\.whatsapp\.com\//i.test(url))
    ) {
      void openExternalScheme(url);
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
        return;
      }
      // Dialer / mail / maps / sms from web — more reliable than WebView navigation.
      if (data.type === "OPEN_URL" && data.url) {
        void openExternalScheme(data.url);
      }
    } catch {
      // ignore
    }
  }

  return (
    <SafeAreaProvider>
      <View style={styles.flex}>
        <SafeAreaView style={styles.flex} edges={["top", "bottom"]}>
          <StatusBar style="dark" />
          <View style={styles.flex}>
            <WebView
              ref={webRef}
              source={{ uri }}
              style={styles.flex}
              applicationNameForUserAgent={` ${APP_USER_AGENT_TOKEN}`}
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
              onOpenWindow={(e) => {
                const targetUrl = e.nativeEvent.targetUrl;
                if (targetUrl) void openExternalScheme(targetUrl);
              }}
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
              setSupportMultipleWindows
              // tel:/mailto: must be listed or the WebView swallows them before
              // onShouldStartLoadWithRequest can hand off to Linking.
              originWhitelist={[
                "https://*",
                "http://*",
                "tel:*",
                "mailto:*",
                "sms:*",
                "whatsapp:*",
              ]}
              onLoadStart={() => {
                if (booted.current) setPageLoading(true);
              }}
              onLoadEnd={() => {
                setPageLoading(false);
                dismissSplash();
              }}
              pullToRefreshEnabled={false}
            />

            {pageLoading && !showSplash ? (
              <View style={styles.progressTrack} pointerEvents="none">
                <View style={styles.progressBar} />
              </View>
            ) : null}
          </View>
        </SafeAreaView>

        {/* Outside SafeAreaView so the poster is truly edge-to-edge. */}
        {showSplash ? <SplashScreen /> : null}
      </View>
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
