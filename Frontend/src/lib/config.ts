const env = import.meta.env;

export const config = {
  apiBaseUrl: (env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ?? '',
  wsBaseUrl: (env.VITE_WS_BASE_URL as string | undefined)?.replace(/\/$/, '') ?? '',
  liveKitUrl: env.VITE_LIVEKIT_URL as string,
};
