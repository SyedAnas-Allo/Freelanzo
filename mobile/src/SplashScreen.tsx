import { Image, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { BRAND } from "./config";

const MARK_SIZE = 32;
const WORD_H = 16;
const WORD_W = Math.round(WORD_H * (500 / 79));

export function SplashScreen() {
  const { height } = useWindowDimensions();
  const artHeight = Math.min(height * 0.42, 340);

  return (
    <View style={styles.root} pointerEvents="none">
      <LinearGradient
        colors={["#FFFFFF", "#F8F2FF", "#EDE0FF"]}
        locations={[0, 0.45, 1]}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.brand}>
        <View style={styles.logoRow}>
          <Image
            source={require("../assets/logo.png")}
            style={styles.mark}
            resizeMode="contain"
          />
          <Image
            source={require("../assets/freelanzo-wordmark.png")}
            style={styles.wordmark}
            resizeMode="contain"
          />
        </View>
        <Text style={styles.headline}>
          India’s On-Demand Local Freelancing Platform
        </Text>
        <Text style={styles.tagline}>
          Connecting businesses with trusted local freelancers nearby.
        </Text>
      </View>

      <View style={styles.artWrap}>
        <Image
          source={require("../assets/background.jpeg")}
          style={[styles.art, { height: artHeight }]}
          resizeMode="cover"
        />
        <LinearGradient
          colors={["#F8F2FF", "transparent"]}
          style={styles.artFade}
          pointerEvents="none"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: BRAND.background,
  },
  brand: {
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 4,
  },
  logoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  mark: {
    width: MARK_SIZE,
    height: MARK_SIZE,
  },
  wordmark: {
    width: WORD_W,
    height: WORD_H,
  },
  headline: {
    marginTop: 12,
    maxWidth: 280,
    fontSize: 20,
    fontWeight: "800",
    lineHeight: 26,
    letterSpacing: -0.3,
    textAlign: "center",
    color: BRAND.headline,
  },
  tagline: {
    marginTop: 6,
    maxWidth: 300,
    fontSize: 12,
    fontWeight: "300",
    lineHeight: 18,
    textAlign: "center",
    color: BRAND.muted,
  },
  artWrap: {
    width: "100%",
    maxWidth: 430,
    alignSelf: "center",
  },
  art: {
    width: "100%",
  },
  artFade: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 40,
  },
});
