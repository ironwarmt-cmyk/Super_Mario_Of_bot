// Publiczna marka aplikacji: QASUPPORT.
// Wszystkie linki widoczne dla użytkowników budujemy z tego adresu,
// żeby nigdzie nie pokazywała się techniczna nazwa projektu.
export const PUBLIC_URL = (process.env.QUALITY_PUBLIC_URL || "https://qasupport.jembezpiecznie.com").replace(/\/$/, "");
export const BOT_LINK = `${PUBLIC_URL}/telegram`;   // przekierowanie do bota aplikacji
export const GROUP_LINK = `${PUBLIC_URL}/grupa`;    // przekierowanie do @MT_Social_Control_bot
export const SITE_URL = "https://jembezpiecznie.com";
