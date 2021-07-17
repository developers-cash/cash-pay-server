# Webhooks

Webhooks will not be resent by CashPayServer in the event of failure.

This is by design as Webhooks also allow some customization of the Invoice data.

Specifically, if a Webhook returns a JSON payload, it is able to modify the following fields on an invoice.

```
{
  data: "https://redirect.here/once-paid",
  privateData: "someSensitiveInformation"
}
```

For debugging of failed Webhooks, it is recommended to use the [Admin Interface](https://admin.v1.pay.infra.cash).

The following are examples of Webhook Payloads.

### Broadcasting

```json
{
  "invoice": {
    "currency": "BCH",
    "webhook": {
      "broadcasting": "https://webhook.site/4134f5c2-2b50-4bf0-ad89-4b50f3522eea",
      "broadcasted": "https://webhook.site/4134f5c2-2b50-4bf0-ad89-4b50f3522eea",
      "confirmed": "https://webhook.site/4134f5c2-2b50-4bf0-ad89-4b50f3522eea"
    },
    "totals": {
      "nativeTotal": 85614,
      "baseCurrency": "USD",
      "baseCurrencyTotal": 0.25,
      "userCurrencyTotal": 0.25
    },
    "network": "main",
    "userCurrency": "USD",
    "txIds": [],
    "outputs": [
      {
        "address": "bitcoincash:qqjrl4jy7r02d7umx6fexrgydx8ra8xtrsmxkck6l2",
        "amount": "0.25USD",
        "amountNative": 85614,
      }
    ],
    "apiKey": "test_api_key",
    "expires": 1607045748.94,
    "time": 1607045718.94,
    "createdAt": "2020-12-04T01:35:18.941Z",
    "updatedAt": "2020-12-04T01:35:24.594Z",
    "service": {
      "paymentURI": "https://v1.pay.infra.cash/bch/pay/5fc99256ea6c0b0322f756da",
      "walletURI": "bitcoincash:?r=https://v1.pay.infra.cash/bch/pay/5fc99256ea6c0b0322f756da",
      "webSocketURI": "wss://v1.pay.infra.cash"
    },
    "id": "5fc99256ea6c0b0322f756da"
  },
  "event": "broadcasting"
}
```

### Broadcasted

```json
{
  "invoice": {
    "currency": "BCH",
    "webhook": {
      "broadcasting": "https://webhook.site/4134f5c2-2b50-4bf0-ad89-4b50f3522eea",
      "broadcasted": "https://webhook.site/4134f5c2-2b50-4bf0-ad89-4b50f3522eea",
      "confirmed": "https://webhook.site/4134f5c2-2b50-4bf0-ad89-4b50f3522eea"
    },
    "totals": {
      "nativeTotal": 85614,
      "baseCurrency": "USD",
      "baseCurrencyTotal": 0.25,
      "userCurrencyTotal": 0.25
    },
    "network": "main",
    "userCurrency": "USD",
    "txIds": [
      "94b080cc4ef10c1042ca4915be1d5693fd8ca4220fbaa70019947c0a06bb4570"
    ],
    "outputs": [
      {
        "address": "bitcoincash:qqjrl4jy7r02d7umx6fexrgydx8ra8xtrsmxkck6l2",
        "amount": "0.25USD",
        "amountNative": 85614,
      }
    ],
    "apiKey": "test_api_key",
    "expires": 1607045748.94,
    "time": 1607045718.94,
    "createdAt": "2020-12-04T01:35:18.941Z",
    "updatedAt": "2020-12-04T01:35:38.615Z",
    "broadcasted": "2020-12-04T01:35:38.614Z",
    "service": {
      "paymentURI": "https://v1.pay.infra.cash/bch/pay/5fc99256ea6c0b0322f756da",
      "walletURI": "bitcoincash:?r=https://v1.pay.infra.cash/bch/pay/5fc99256ea6c0b0322f756da",
      "webSocketURI": "wss://v1.pay.infra.cash"
    },
    "id": "5fc99256ea6c0b0322f756da"
  },
  "event": "broadcasted"
}
```

### Confirmed

```json
{
  "invoice": {
    "currency": "BCH",
    "webhook": {
      "broadcasting": "https://webhook.site/4134f5c2-2b50-4bf0-ad89-4b50f3522eea",
      "broadcasted": "https://webhook.site/4134f5c2-2b50-4bf0-ad89-4b50f3522eea",
      "confirmed": "https://webhook.site/4134f5c2-2b50-4bf0-ad89-4b50f3522eea"
    },
    "totals": {
      "nativeTotal": 85614,
      "baseCurrency": "USD",
      "baseCurrencyTotal": 0.25,
      "userCurrencyTotal": 0.25
    },
    "network": "main",
    "userCurrency": "USD",
    "txIds": [
      "94b080cc4ef10c1042ca4915be1d5693fd8ca4220fbaa70019947c0a06bb4570"
    ],
    "outputs": [
      {
        "address": "bitcoincash:qqjrl4jy7r02d7umx6fexrgydx8ra8xtrsmxkck6l2",
        "amount": "0.25USD",
        "amountNative": 85614,
      }
    ],
    "apiKey": "test_api_key",
    "expires": 1607045748.94,
    "time": 1607045718.94,
    "createdAt": "2020-12-04T01:35:18.941Z",
    "updatedAt": "2020-12-04T01:35:39.220Z",
    "broadcasted": "2020-12-04T01:35:38.614Z",
    "confirmed": 664364,
    "service": {
      "paymentURI": "https://v1.pay.infra.cash/bch/pay/5fc99256ea6c0b0322f756da",
      "walletURI": "bitcoincash:?r=https://v1.pay.infra.cash/bch/pay/5fc99256ea6c0b0322f756da",
      "webSocketURI": "wss://v1.pay.infra.cash"
    },
    "id": "5fc99256ea6c0b0322f756da"
  },
  "event": "confirmed"
}
```
