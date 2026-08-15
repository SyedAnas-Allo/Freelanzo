import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  AppState,
  type AppStateStatus,
  BackHandler,
  Platform,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import NetInfo from "@react-native-community/netinfo";
import {
  WebView,
  type WebViewMessageEvent,
  type WebViewNavigation,
} from "react-native-webview";
import type { ShouldStartLoadRequest } from "react-native-webview/lib/WebViewTypes";
import * as Linking from "expo-linking";
import * as Haptics from "expo-haptics";
import * as WebBrowser from "expo-web-browser";
import { APP_USER_AGENT_TOKEN, BRAND, WEB_URL } from "./src/config";
import { NetworkErrorScreen } from "./src/NetworkErrorScreen";
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

async function shareFromWeb({
  url,
  title,
  text,
}: {
  url?: string;
  title?: string;
  text?: string;
}) {
  if (!url && !text) return;
  const message = [text, url].filter(Boolean).join("\n");
  try {
    await Share.share(
      Platform.OS === "ios"
        ? { url: url ?? "", message: text, title }
        : { message, title },
      { dialogTitle: title },
    );
  } catch (e) {
    console.warn("shareFromWeb failed", e);
    Alert.alert("Couldn't share", "Try again in a moment.");
  }
}

/** Shared flag the web app reads for mutation guards before React mounts. */
function injectNetworkState(online: boolean) {
  const value = online ? "true" : "false";
  return `
    try {
      window.__FREELANZO_NATIVE_ONLINE__ = ${value};
      window.dispatchEvent(new CustomEvent('freelanzo-network-change', {
        detail: { online: ${value}, native: true }
      }));
    } catch (e) {}
    true;
  `;
}

/** Same document ignoring the fragment — used to keep subframe errors out. */
function isSameDocument(a: string | null | undefined, b: string | null | undefined) {
  if (!a || !b) return true;
  return a.split("#")[0] === b.split("#")[0];
}

/** Auto-retry guard rails so a flapping connection can't reload in a loop. */
const AUTO_RETRY_LIMIT = 3;
const AUTO_RETRY_COOLDOWN_MS = 8000;

export default function App() {
  const webRef = useRef<WebView>(null);
  const oauthLock = useRef(false);
  const handledAuthUrl = useRef<string | null>(null);
  const booted = useRef(false);
  const appState = useRef<AppStateStatus>(AppState.currentState);
  const isOnlineRef = useRef(true);
  const loadFailedRef = useRef(false);
  /** Set when the current navigation already produced an error. */
  const failedThisLoad = useRef(false);
  /** At least one navigation committed — decides reload vs. fresh source. */
  const hasLoadedRef = useRef(false);
  const mainFrameUrl = useRef<string | null>(null);
  const autoRetry = useRef({ count: 0, at: 0 });
  const [uri, setUri] = useState(WEB_URL);
  const [canGoBack, setCanGoBack] = useState(false);
  /** Full splash — cold start only. */
  const [showSplash, setShowSplash] = useState(true);
  /** Thin top bar for later navigations — never covers the page. */
  const [pageLoading, setPageLoading] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [loadErrorMessage, setLoadErrorMessage] = useState(
    "Check your connection and try again.",
  );

  const appReturn = useMemo(() => getAppReturnDeepLink(), []);

  const injectedJavaScript = useMemo(() => {
    const redirect = JSON.stringify(appReturn);
    // Intercept tel:/mailto:/sms: and target=_blank / maps — WKWebView
    // often ignores scheme navigations and blocks window.open when
    // setSupportMultipleWindows is false.
    return `
      (function () {
        window.__FREELANZO_NATIVE__ = true;
        window.__FREELANZO_NATIVE_SHARE__ = true;
        window.__FREELANZO_OAUTH_REDIRECT__ = ${redirect};
        if (document.documentElement) {
          document.documentElement.dataset.nativeApp = 'true';
        }
        if (!window.__FREELANZO_LINK_HOOK__) {
          window.__FREELANZO_LINK_HOOK__ = true;
          function postOpen(url) {
            if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
              window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'OPEN_URL', url: url }));
            }
          }
          function postHaptic() {
            if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
              window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'HAPTIC_SELECTION' }));
            }
          }
          document.addEventListener('click', function (e) {
            var el = e.target;
            var action = el && el.closest ? el.closest('[data-native-haptic="selection"]') : null;
            if (action && !action.hasAttribute('disabled') && action.getAttribute('aria-disabled') !== 'true') {
              postHaptic();
            }
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

  // Seed connectivity before the page scripts run so early mutation guards
  // see native state instead of the WebView's stale navigator.onLine.
  const bootstrapJavaScript = useMemo(
    () => `${injectNetworkState(isOnline)}\n${injectedJavaScript}`,
    [injectedJavaScript, isOnline],
  );

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

  const notifyWebNetwork = useCallback((online: boolean) => {
    webRef.current?.injectJavaScript(injectNetworkState(online));
  }, []);

  const dismissSplash = useCallback(() => {
    booted.current = true;
    setShowSplash(false);
  }, []);

  const clearLoadFailure = useCallback(() => {
    failedThisLoad.current = false;
    loadFailedRef.current = false;
    setLoadFailed(false);
  }, []);

  /**
   * Exactly one recovery path per attempt: reload the committed page, or —
   * when nothing ever loaded — point the WebView at a fresh source URL.
   */
  const startReload = useCallback(() => {
    clearLoadFailure();
    setPageLoading(true);
    if (hasLoadedRef.current && webRef.current) {
      webRef.current.reload();
      return;
    }
    setUri(`${WEB_URL}${WEB_URL.includes("?") ? "&" : "?"}r=${Date.now()}`);
  }, [clearLoadFailure]);

  const retryLoad = useCallback(() => {
    autoRetry.current = { count: 0, at: 0 };
    startReload();
  }, [startReload]);

  const autoRetryLoad = useCallback(() => {
    const now = Date.now();
    if (autoRetry.current.count >= AUTO_RETRY_LIMIT) return;
    if (now - autoRetry.current.at < AUTO_RETRY_COOLDOWN_MS) return;
    autoRetry.current = { count: autoRetry.current.count + 1, at: now };
    startReload();
  }, [startReload]);

  // Never leave the splash stuck if a load hangs.
  useEffect(() => {
    if (!showSplash) return;
    const t = setTimeout(dismissSplash, 6000);
    return () => clearTimeout(t);
  }, [showSplash, dismissSplash]);

  const applyNetworkState = useCallback(
    (online: boolean) => {
      const wasOnline = isOnlineRef.current;
      isOnlineRef.current = online;
      setIsOnline(online);
      notifyWebNetwork(online);
      // Only the offline -> online edge recovers a failed page, so repeated
      // NetInfo emissions with the same value can't restart the load.
      if (online && !wasOnline && loadFailedRef.current) autoRetryLoad();
    },
    [autoRetryLoad, notifyWebNetwork],
  );

  const readNetworkState = useCallback(() => {
    void NetInfo.fetch()
      .then((state) => {
        applyNetworkState(
          Boolean(state.isConnected && state.isInternetReachable !== false),
        );
      })
      .catch(() => undefined);
  }, [applyNetworkState]);

  // Subscribe once — the callback reads live values through refs.
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      applyNetworkState(
        Boolean(state.isConnected && state.isInternetReachable !== false),
      );
    });
    readNetworkState();
    return () => unsubscribe();
  }, [applyNetworkState, readNetworkState]);

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
      clearLoadFailure();
      return true;
    } catch (e) {
      console.warn("applyAuthReturn failed", e);
      return false;
    }
  }, [clearLoadFailure, dismissSplash]);

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
          clearLoadFailure();
        }
      } catch (e) {
        console.warn("finishOAuth failed", e);
        Alert.alert(
          "Sign-in failed",
          "Could not complete Google sign-in. Check your connection and try again.",
        );
      } finally {
        oauthLock.current = false;
      }
    },
    [clearLoadFailure, dismissSplash],
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
        readNetworkState();
      }
    });
    return () => sub.remove();
  }, [notifyWebForeground, readNetworkState]);

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
        title?: string;
        text?: string;
      };
      if (data.type === "OAUTH_START" && data.url) {
        void finishOAuth(data.url);
        return;
      }
      if (data.type === "SHARE") {
        void shareFromWeb(data);
        return;
      }
      if (data.type === "HAPTIC_SELECTION") {
        void Haptics.selectionAsync().catch(() => undefined);
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

  function markLoadFailed(message?: string) {
    setPageLoading(false);
    dismissSplash();
    setLoadErrorMessage(
      message ||
        (isOnlineRef.current
          ? "Freelanzo couldn't load. Try again in a moment."
          : "You're offline. Reconnect, then try again."),
    );
    failedThisLoad.current = true;
    loadFailedRef.current = true;
    setLoadFailed(true);
  }

  return (
    <SafeAreaProvider>
      <View style={styles.flex}>
        <SafeAreaView style={styles.flex} edges={["top", "bottom"]}>
          <StatusBar style="dark" />
          {!isOnline ? (
            <View style={styles.offlineBar} accessibilityRole="text">
              <Text style={styles.offlineText}>
                You are offline. Some actions are paused.
              </Text>
            </View>
          ) : null}
          <View style={styles.flex}>
            <WebView
              ref={webRef}
              source={{ uri }}
              style={styles.flex}
              applicationNameForUserAgent={` ${APP_USER_AGENT_TOKEN}`}
              injectedJavaScriptBeforeContentLoaded={bootstrapJavaScript}
              injectedJavaScript={injectedJavaScript}
              onShouldStartLoadWithRequest={handleShouldStartLoad}
              onNavigationStateChange={(nav: WebViewNavigation) => {
                setCanGoBack(nav.canGoBack);
                if (nav.url) mainFrameUrl.current = nav.url;
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
                const { code, description, url } = e.nativeEvent;
                // -999 is NSURLErrorCancelled — a superseded navigation, not
                // a failure the user should see.
                if (code === -999) return;
                if (!isSameDocument(url, mainFrameUrl.current)) return;
                console.warn("WebView error", e.nativeEvent);
                markLoadFailed(description);
              }}
              onHttpError={(e) => {
                const { statusCode, url } = e.nativeEvent;
                // Subresource failures must not blank out a usable page.
                if (statusCode < 400) return;
                if (!isSameDocument(url, mainFrameUrl.current)) return;
                console.warn("WebView HTTP error", statusCode);
                markLoadFailed(
                  statusCode >= 500
                    ? "Freelanzo is temporarily unavailable. Try again shortly."
                    : "This page could not be loaded.",
                );
              }}
              onLoad={() => {
                // A main-frame HTTP error still fires onLoad for the error
                // body — only a clean navigation may clear the failure state.
                if (!failedThisLoad.current) {
                  hasLoadedRef.current = true;
                  autoRetry.current = { count: 0, at: 0 };
                  clearLoadFailure();
                }
                notifyWebNetwork(isOnlineRef.current);
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
              onLoadStart={(e) => {
                mainFrameUrl.current = e.nativeEvent.url;
                failedThisLoad.current = false;
                if (booted.current) setPageLoading(true);
              }}
              onLoadEnd={() => {
                setPageLoading(false);
                dismissSplash();
              }}
              directionalLockEnabled
              nestedScrollEnabled
              overScrollMode="never"
              showsHorizontalScrollIndicator={false}
              showsVerticalScrollIndicator={false}
              pullToRefreshEnabled={false}
            />

            {pageLoading && !showSplash && !loadFailed ? (
              <View style={styles.progressTrack} pointerEvents="none">
                <View style={styles.progressBar} />
              </View>
            ) : null}

            {loadFailed ? (
              <NetworkErrorScreen
                title={!isOnline ? "You're offline" : "Couldn't load Freelanzo"}
                message={loadErrorMessage}
                onRetry={retryLoad}
              />
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
  offlineBar: {
    backgroundColor: "#FEF3C7",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  offlineText: {
    color: "#78350F",
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
  },
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
