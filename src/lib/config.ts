/**
 * Global business constants. These mirror the assumptions baked into the
 * original Google Sheet so the app reproduces the same numbers.
 */

/** Danish VAT (moms). Revenue in Shopify is stored incl. VAT; DB is on ex-VAT. */
export const VAT_RATE = 0.25;

/** All period boundaries (the 15th / end-of-month cut-offs) are evaluated here. */
export const TIMEZONE = "Europe/Copenhagen";

export const CURRENCY = "DKK";
export const LOCALE = "da-DK";

/** Day-of-month the "half month" snapshot is captured (covers the 1st–15th). */
export const HALF_MONTH_CAPTURE_DAY = 16;
