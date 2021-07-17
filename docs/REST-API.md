# REST-API

The following routes/parameters are considered stable and safe to use (unless indicated otherwise).

Any route that is not documented here is unstable and may change in future.

## Invoice Routes

### POST /invoice/create

HTTP endpoint used to create an invoice. Must be sent as a JSON payload.

**Note: If you are not using cash-pay-server-js, you should omit apiKey, privateData and webhook.\* when passing response back to browser.**

#### Parameters

| Path | Type | Required | Default | Description  
|--|--|--|--|--|
| apiKey | String | Optional | | API Key to use
| currency | String | Optional | "BCH" | Currency for payment request (only supports BCH currently)
| network | String | Optional | "main" | Network to use (only supports "main" currently)
| outputs | Array | Required | | Array containing transaction outputs
| outputs.amount | String/Number | Required | | Amount in satoshis or a string to perform currency conversion (e.g. "1.50USD")
| outputs.address | String | Required* | | Address to receive output payment to
| outputs.script | String | Required* | | Hex Output Script (can be used instead of address)
| expires | Number | Optional | 900 (15m) | Number of seconds until invoice expires
| memo | String | Optional | | Memo that will show in user's wallet for invoice
| userCurrency | String | Optional | "USD" | Currency that will be shown/calculated for end-user.
| merchantData | String | Optional | | BIP70 Merchant Data to use on Invoice
| data | String | Optional | | Data to pass with invoice. **WILL** be visible in Websocket Event payloads.
| privateData | String | Optional | | Private Data to pass with invoice. **WILL NOT** be visible in Websocket Event payloads.
| webhook.broadcasting | String | Optional | | URL that will be triggered **before** payment is broadcasted.
| webhook.broadcasted | String | Optional | | URL that will be triggered **after** payment is broadcasted.
| webhook.confirmed | String | Optional | | URL that will be triggered when payment is confirmed in block.

#### Example CURL Request

```sh
curl -XPOST -H "Content-type: application/json" -d '{
  "outputs": [{
    "address": "bitcoincash:qppcn0kghrpmx90s2kmstytf3jfvms59vyqvf4p5zw",
    "amount": "0.25USD"
  }]
}' 'https://v1.pay.infra.cash/invoice/create'
```

#### Example Response

```json
{
  "totals": {
    "nativeTotal": 93519,
    "baseCurrency": "USD",
    "baseCurrencyTotal": 0.25,
    "userCurrencyTotal": 0.25
  },
  "currency": "BCH",
  "network": "main",
  "userCurrency": "USD",
  "txIds": [],
  "outputs": [
    {
      "address": "bitcoincash:qppcn0kghrpmx90s2kmstytf3jfvms59vyqvf4p5zw",
      "amount": "0.25USD",
      "amountNative": 93519,
    }
  ],
  "time": 1607580598.12,
  "events": [],
  "createdAt": "2020-12-10T06:09:58.121Z",
  "updatedAt": "2020-12-10T06:09:58.121Z",
  "expires": 1607581498.12,
  "service": {
    "paymentURI": "https://v1.pay.infra.cash/invoice/pay/5fd1bbb6267e1204459e7560",
    "walletURI": "bitcoincash:?r=https://v1.pay.infra.cash/invoice/pay/5fd1bbb6267e1204459e7560",
    "webSocketURI": "wss://v1.pay.infra.cash"
  },
  "id": "5fd1bbb6267e1204459e7560"
}
``` 
