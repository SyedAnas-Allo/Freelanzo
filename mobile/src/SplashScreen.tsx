import { Image, StyleSheet, View } from "react-native";

/**
 * Full-bleed marketing splash. Uses contain so the full poster (logo →
 * people → feature row) stays visible on every phone/tablet aspect ratio;
 * white letterboxing matches the art.
 */
export function SplashScreen() {
  return (
    <View style={styles.root} pointerEvents="none">
      <Image
        source={require("../assets/splash.jpeg")}
        style={styles.image}
        resizeMode="contain"
        accessibilityLabel="Freelanzo"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 20,
  },
  image: {
    width: "100%",
    height: "100%",
  },
});
