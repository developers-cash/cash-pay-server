/**
 * ExtendedError that allows additional parameters.
 * @memberof Libs
 */
const ExtendedError = function (message, params) {
  const error = new Error(message)
  for (const key in params) {
    error[key] = params[key]
  }
  return error
}

module.exports = ExtendedError
