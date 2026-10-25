(() => {
  if (!window) return;
  window.palateStripeClient = {
    loadStripe: (publishableKey) => {
      if (!publishableKey) {
        console.warn('Stripe publishable key is missing.');
        return null;
      }
      if (!window.Stripe) {
        console.error('Stripe.js has not been loaded yet.');
        return null;
      }
      if (!window.palateStripeClient.instance || window.palateStripeClient.publishableKey !== publishableKey) {
        window.palateStripeClient.publishableKey = publishableKey;
        window.palateStripeClient.instance = window.Stripe(publishableKey);
      }
      return window.palateStripeClient.instance;
    }
  };
})();
