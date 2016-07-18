var hyperquest = require('hyperquest')
  , jsonist    = require('jsonist')
  , through2   = require('through2')
  , assert     = require('assert')
  , moment     = require('moment')
  , counts     = require('./')

var hyperquestCalls   = 0
  , jsonistCalls      = 0
  , finishCalls       = 0
  , packageDataCalls  = 0
  , packageErrorCalls = 0
  , expectedStart     = moment().utc().add(-1, 'years').add(-1, 'days').format('YYYY-MM-DD')
  , expectedEnd       = moment().utc().add(1, 'days').format('YYYY-MM-DD')
  , timeout

// mock out network calls and make it a quick return

hyperquest.get = function hyperquestGet (url) {
  var s = through2()

  assert.equal('https://registry.npmjs.org/-/all/static/all.json', url, 'called correct url')
  assert.equal(1, ++hyperquestCalls, 'called hyperquest.get() exactly once')

  setImmediate(function i () {
    s.write('[{"name":"foobar1"},{"name":"foobar2"},{"name":"foobar3"},{"name":')
    setTimeout(function t () {
      s.end('"nan"}]')
    }, 50)
  })

  return s
}


jsonist._oldget = jsonist.get
jsonist.get = function jsonistGet (url, callback) {
  var re = /https:\/\/api\.npmjs\.org\/downloads\/range\/(20\d\d-\d\d-\d\d):(20\d\d-\d\d-\d\d)\/(?:foobar([123])|nan)/
    , m = url.match(re)

  assert(m, 'url matched expected regex')
  assert.equal(expectedStart, m[1], 'got expected start date')
  assert.equal(expectedEnd, m[2], 'got expected end date')
  ++jsonistCalls
  if (m[3]) { // mock data
    assert.equal(jsonistCalls, m[3], 'called jsonist.get() expected number of times')

    setImmediate(function i () {
      if (m[3] == 2)
        return callback(new Error('registry error: no stats for this package for this range (0008)'))
      callback(null, { downloads: [] })
    })
  } else // nan
      jsonist._oldget(url, callback)
}


counts()
  .on('error', function onError (err) {
    assert.fail(err)
  })
  .on('finish', function onEnd () {
    finishCalls++
    final()
    clearTimeout(timeout)
  })
  .on('packageError', function onPackageError (data) {
    var pkg = packageDataCalls + packageErrorCalls + 1

    packageErrorCalls++
    assert.equal('foobar' + pkg, data.package)
    assert.equal('registry error: no stats for this package for this range (0008)', data.message)
  })
  .on('packageData', function onPackageData (data) {
    var i        = 0
      , day      = moment(expectedStart)
      , end      = moment(expectedEnd)
      , pkg      = packageDataCalls + packageErrorCalls + 1
      , zeroDays = 0

    packageDataCalls++

    if (pkg < 4) { // foobar mocks
      assert.equal('foobar' + pkg, data.name)

      for (; day < end; i++) {
        assert.strictEqual(0, data.downloads[i].count, 'found correct data point count')
        assert.equal(data.downloads[i].day, day.format('YYYY-MM-DD'), 'found correct data point date ' + day.format('YYYY-MM-DD') + ':' + data.downloads[i].day + ' ' + packageDataCalls)
        day = day.add(1, 'day')
      }
    } else { // nan pass-through
      assert.equal('nan', data.name)


      for (; day < end; i++) {
        if (data.downloads[i].count === 0) // let npm have some hiccups
          zeroDays++
        else
          assert(data.downloads[i].count > 10000, 'nan has reasonable daily download count (' + data.downloads[i].count + ' > 10000)')
        assert.equal(data.downloads[i].day, day.format('YYYY-MM-DD'), 'found correct data point date ' + day.format('YYYY-MM-DD') + ':' + data.downloads[i].day + ' ' + packageDataCalls)
        day = day.add(1, 'day')
      }

     assert(zeroDays < 5, 'reasonable number of 0 days for nan (' + zeroDays + ')')
    }
  })


timeout = setTimeout(final, 5000)


function final () {
  assert.equal(1, hyperquestCalls, 'correct number of hyperquest calls')
  assert.equal(4, jsonistCalls, 'correct number of jsonsit calls')
  assert.equal(1, finishCalls, 'correct number of "finish" events')
  assert.equal(1, packageErrorCalls, 'correct number of "packageError" events')
  assert.equal(3, packageDataCalls, 'correct number of "packageData" events')
}
