import { CacheProvider } from "@emotion/react";
import { startTransition, StrictMode } from "react";
import { hydrateRoot } from "react-dom/client";
import { HydratedRouter } from "react-router/dom";
import { createEmotionCache } from "./emotion-cache";

const cache = createEmotionCache();

startTransition(() => {
  hydrateRoot(document, <StrictMode><CacheProvider value={cache}><HydratedRouter /></CacheProvider></StrictMode>);
});
