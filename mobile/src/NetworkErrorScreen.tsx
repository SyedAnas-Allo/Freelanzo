import { Pressable, StyleSheet, Text, View } from "react-native";
import { BRAND } from "./config";

export function NetworkErrorScreen({
  title,
  message,
  onRetry,
}: {
  title: string;
  message: string;
  onRetry: () => void;
}) {
  return (
    <View style={styles.wrap} accessibilityRole="alert">
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
      <Pressable
        accessibilityRole="button"
        onPress={onRetry}
        style={({ pressed }) => [styles.button, pressed && styles.pressed]}
      >
        <Text style={styles.buttonText}>Retry</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 20,
    backgroundColor: BRAND.background,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
  },
  title: {
    fontSize: 20,
    fontWeight: "800",
    color: BRAND.headline,
    textAlign: "center",
  },
  message: {
    marginTop: 10,
    fontSize: 14,
    lineHeight: 20,
    color: BRAND.muted,
    textAlign: "center",
  },
  button: {
    marginTop: 22,
    backgroundColor: BRAND.primary,
    borderRadius: 14,
    paddingHorizontal: 22,
    paddingVertical: 14,
  },
  pressed: { opacity: 0.85 },
  buttonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },
});
