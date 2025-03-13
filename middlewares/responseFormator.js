module.exports = (req, res, next) => {
  res.success = function ({ success = true, code = 200, data, message = 'ok' }) {
    this.json({
      success,
      code,
      message,
      data
    })
  }

  res.errors = function ({ success = false, code = 400, error, data, message = 'error' }) {
    this.json({
      success,
      code,
      message,
      data,
      error
    })
  }

  next()
}
  // function responseFormat(data) {
  //   const message = {};
  //   message.status = data.status || 200;
  //   message.success = data.success;
  //   message.message = data.message;
  //   message.data = data.data;
  //   return message
  // }
  
  // module.exports = {
  //   responseFormat              
  // };