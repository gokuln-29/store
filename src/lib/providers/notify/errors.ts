/**
 * A delivery that can never succeed (unknown template, unsubscribed device, missing provider
 * template…). The notification outbox gives up at once instead of retrying.
 */
export class PermanentDeliveryError extends Error {}
