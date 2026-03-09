/**
 * API Configuration
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
const WS_BASE_URL = import.meta.env.VITE_WS_BASE_URL;
const LIVEKIT_URL = import.meta.env.VITE_LIVEKIT_URL;

export const config = {
  apiBaseUrl: API_BASE_URL,
  wsBaseUrl: WS_BASE_URL,
  liveKitUrl: LIVEKIT_URL
};

