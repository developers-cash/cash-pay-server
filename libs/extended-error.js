let ExtendedError = function(message, params) {
  let error = new Error(message);
  for (key in params) {
    error[key] = params[key];
  }
  return error;
}

module.exports = ExtendedError;
