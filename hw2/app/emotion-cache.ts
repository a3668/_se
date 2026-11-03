import createCache from "@emotion/cache";

// A fresh cache is created for each server request. The matching client key lets
// Emotion hydrate the styles emitted by its streaming SSR integration.
export function createEmotionCache() {
  return createCache({ key: "mui" });
}
