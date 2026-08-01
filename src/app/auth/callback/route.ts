import { finishNativeOAuth } from "./native-handoff";

export async function GET(request: Request) {
  return finishNativeOAuth(request);
}
