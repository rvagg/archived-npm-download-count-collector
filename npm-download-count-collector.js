var hyperquest     = require('hyperquest')
  , jsonStream     = require('JSONStream')
  , through2       = require('through2')
  , EE             = require('events')
  , queue          = require('async/queue')
  , downloadCounts = require('npm-download-counts')
  , moment         = require('moment')

var packagesUrl        = 'https://registry.npmjs.org/-/all/static/all.json'
  , defaultParallelism = 4


function collectPackages () {
  var ee = new EE()

  hyperquest.get(packagesUrl)
    .on('error', ee.emit.bind(ee, 'error'))
    .pipe(jsonStream.parse('*.name'))
    .on('error', ee.emit.bind(ee, 'error'))
    .pipe(through2(function emitName (chunk, enc, callback) {
      ee.emit('name', '' + chunk)
      callback()
    }))
    .on('error', ee.emit.bind(ee, 'error'))
    .on('finish', ee.emit.bind(ee, 'finish'))

  return ee
}


function fillDownloadSeries (series, start, end) {
  var day     = moment(start).utc()
    , result  = []
    , dayS
    , dataMap = series.reduce(function reduce (p, c) {
        p[c.day] = c.count
        return p
      }, {})

  while (day < end) {
    dayS = day.format('YYYY-MM-DD')
    result.push({ day: dayS, count: dataMap[dayS] || 0 })
    day = day.add(1, 'days')
  }

  return result
}


function downloadCountCollector (options) {
  var collectQueue = queue(collector, (options && options.parallelism) || defaultParallelism)
    , collecting   = true
    , start        = (options && options.start) || moment().utc().add(-1, 'year').add(-1, 'day').toDate()
    , end          = (options && options.end) || moment().utc().add(1, 'day').toDate()
    , ee           = new EE()

  function collector (name, _callback) {
    if (!collecting)
      return _callback()

    downloadCounts(name, start, end, function onCounts (err, data) {
      if (err) {
        err.package = name
        ee && ee.emit('packageError', err)
      } else
        ee && ee.emit('packageData', { name: name, downloads: fillDownloadSeries(data || [], start, end) })

      _callback()
    })
  }

  function onError (err) {
    collecting = false
    ee && ee.emit('error', err)
    ee = null
  }

  function onEnd () {
    function end () {
      ee && ee.emit('finish')
      ee = null
    }
    if (collectQueue.idle())
      return end()

    collectQueue.drain = end
  }

  collectPackages()
    .on('error', onError)
    .on('finish', onEnd)
    .on('name', collectQueue.push.bind(collectQueue))

  return ee
}


module.exports = downloadCountCollector
