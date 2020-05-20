module.exports = {
  env: process.env.NODE_ENV,
  domain: process.env.DOMAIN,
  wif: process.env.WIF,
  mongoDB: process.env.MONGODB,
  ratesRefresh: process.env.RATES_REFRESH || 300
}
