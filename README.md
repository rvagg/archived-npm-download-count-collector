# npm-download-count-collector

**A stream-like API for fetching download counts for all npm packages**

[![NPM](https://nodei.co/npm/npm-download-count-collector.png)](https://nodei.co/npm/npm-download-count-collector/)

## API

### `npm-download-count-collector([options])`

Returns an `EventEmitter` that produces the following events during the duration of its lifetime:

* `'packageData'`: provides an object containing a `name` property indicating the name of an individual npm package and a `downloads` property containing an array of objects where each element of the array represents a day within the date range being fetched. Each day object contains two properties, a `day` property with a string representing the day in `YYYY-MM-DD` format, and a `count` property indicating the number of downloads during that day. Unlike the npm API, days with zero downloads will also have an entry so there should be exactly one entry per day during the period in question.
* `'packageError'`: passed on from the npm API, usually occurs when there is a package name entry but no actual package (for whatever reason, perhaps it's been removed from the registry). Mostly you should be able to ignore these errors, they are non-fatal, although if the npm API is playing up you'll get a large number of these.
* `'error'`: when a fatal error has occurred with the npm API, most likely in fetching the entire package list which may 5xx from time to time. It may be safe to re-run the collection straight after receiving one of these errors as the npm API may be dealing with a non-cached value in the first call but a cached value after an error.
* `'finish'`: when everything is done and you have all the data you're going to get. npm-download-count-collector will not continue to hold any resources after this.

The `options` object may contain the following optional items:

* `parallelism`: (default `2`) the number of parallel calls to the npm API you're willing to make
* `start`: (default 1 year and 1 day prior to the current date) a `Date` object representing the date that you want to start the download count range
* `end`: (1 day after the current date) a `Date` object representing the date that you want to end the download count range=

## License

**npm-download-count-collector** is Copyright (c) 2016 Rod Vagg ([rvagg](https://github.com/rvagg)) and licensed under the Apache 2.0 licence. All rights not explicitly granted in the Apache 2.0 license are reserved. See the included LICENSE file for more details.
