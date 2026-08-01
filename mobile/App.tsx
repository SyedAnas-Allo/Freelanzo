import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
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
import { APP_USER_AGENT_TOKEN, BRAND, WEB_URL } from "./src/config";
import {
  getWebsiteOAuthRedirect,
  isOAuthUrl,
  isWebsiteAuthCallback,
  openOAuthInSystemBrowser,
  resolveAuthReturnUrl,
} from "./src/oauth";

function buildInjectedJavaScript(oauthRedirect: string): string {
  const redirect = JSON.stringify(oauthRedirect);
  const token = JSON.stringify(APP_USER_AGENT_TOKEN);
  return `
    (function () {
      try {
        window.__FREELANZO_NATIVE__ = true;
        window.__FREELANZO_OAUTH_REDIRECT__ = ${redirect};
        window.__FREELANZO_APP_UA__ = ${token};
      } catch (e) {}
      true;
    })();
  `;
}

export default function App() {
  const webRef = useRef<WebView>(null);
  const oauthLock = useRef(false);
  const [uri, setUri] = useState(WEB_URL);
  const [canGoBack, setCanGoBack] = useState(false);
  const [loading, setLoading] = useState(true);

  const oauthRedirect = useMemo(() => getWebsiteOAuthRedirect(), []);
  const injectedJavaScript = useMemo(
    () => buildInjectedJavaScript(oauthRedirect),
    [oauthRedirect],
  );

  const userAgent = useMemo(() => {
    // Keep a real mobile Safari/Chrome baseline so Google OAuth pages render,
    // plus our token so the website can detect the native shell.
    if (Platform.OS === "ios") {
      return `Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1 ${APP_USER_AGENT_TOKEN}`;
    }
    return `Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36 ${APP_USER_AGENT_TOKEN}`;
  }, []);

  const openAuthReturn = useCallback((returnUrl: string) => {
    const websiteUrl = resolveAuthReturnUrl(returnUrl) ?? returnUrl;
    setUri(websiteUrl);
    setLoading(true);
  }, []);

  const runOAuth = useCallback(
    async (url: string) => {
      if (oauthLock.current) return;
      oauthLock.current = true;
      try {
        const result = await openOAuthInSystemBrowser(url);
        if (result.type === "success") {
          openAuthReturn(result.url);
        }
      } finally {
        oauthLock.current = false;
      }
    },
    [openAuthReturn],
  );

  useEffect(() => {
    const sub = Linking.addEventListener("url", ({ url }) => {
      const resolved = resolveAuthReturnUrl(url);
      if (resolved) openAuthReturn(resolved);
    });

    void Linking.getInitialURL().then((url) => {
      if (!url) return;
      const resolved = resolveAuthReturnUrl(url);
      if (resolved) openAuthReturn(resolved);
    });

    return () => sub.remove();
  }, [openAuthReturn]);

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
    const { url, isTopFrame } = request;
    if (!url || url === "about:blank") return true;

    // Custom / deep links outside our site (tel, whatsapp, mailto, maps…)
    if (
      url.startsWith("tel:") ||
      url.startsWith("mailto:") ||
      url.startsWith("whatsapp:") ||
      url.startsWith("sms:") ||
      url.startsWith("geo:") ||
      url.startsWith("maps:") ||
      url.startsWith("comgooglemaps:")
    ) {
      void Linking.openURL(url).catch(() => undefined);
      return false;
    }

    // Rewrite localhost / wrong-host OAuth returns onto the real site callback.
    const authReturn = resolveAuthReturnUrl(url);
    if (
      authReturn &&
      authReturn !== url &&
      (url.includes("code=") || url.includes("localhost"))
    ) {
      setUri(authReturn);
      setLoading(true);
      return false;
    }

    if (isOAuthUrl(url)) {
      void runOAuth(url);
      return false;
    }

    // If AuthSession somehow lands back as https callback while WebView is
    // still deciding, allow it through when it's our site.
    if (isWebsiteAuthCallback(url) && isTopFrame) {
      return true;
    }

    return true;
  }

  function handleNavChange(nav: WebViewNavigation) {
    setCanGoBack(nav.canGoBack);
    if (isOAuthUrl(nav.url)) {
      void runOAuth(nav.url);
    }
  }

  function handleOpenWindow(event: { nativeEvent: { targetUrl: string } }) {
    const targetUrl = event.nativeEvent.targetUrl;
    if (!targetUrl) return;
    if (isOAuthUrl(targetUrl)) {
      void runOAuth(targetUrl);
      return;
    }
    setUri(targetUrl);
  }

  function handleMessage(event: WebViewMessageEvent) {
    try {
      const data = JSON.parse(event.nativeEvent.data) as {
        type?: string;
        url?: string;
      };
      if (data.type === "OAUTH_START" && data.url) {
        void runOAuth(data.url);
      }
    } catch {
      // ignore non-JSON messages
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
            userAgent={userAgent}
            applicationNameForUserAgent={APP_USER_AGENT_TOKEN}
            injectedJavaScriptBeforeContentLoaded={injectedJavaScript}
            injectedJavaScript={injectedJavaScript}
            onShouldStartLoadWithRequest={handleShouldStartLoad}
            onNavigationStateChange={handleNavChange}
            onOpenWindow={handleOpenWindow}
            onMessage={handleMessage}
            geolocationEnabled
            mediaCapturePermissionGrantType="grant"
            allowsProtectedMedia
            allowsInlineMediaPlayback
            mediaPlaybackRequiresUserAction={false}
            allowsBackForwardNavigationGestures
            sharedCookiesEnabled
            thirdPartyCookiesEnabled
            domStorageEnabled
            javaScriptEnabled
            setSupportMultipleWindows
            originWhitelist={["*"]}
            startInLoadingState
            onLoadStart={() => setLoading(true)}
            onLoadEnd={() => setLoading(false)}
            pullToRefreshEnabled={Platform.OS === "android"}
          />
          {loading ? (
            <View style={styles.loadingOverlay} pointerEvents="none">
              <ActivityIndicator size="large" color={BRAND.primary} />
            </View>
          ) : null}
        </View>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: BRAND.background },
  loadingOverlay: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(248, 245, 255, 0.55)",
  },
});
