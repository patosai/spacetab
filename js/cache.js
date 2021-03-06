// Cache library
// call 'initialize' function to initialize
// library auto-initializes as well to minimize time delay

var Moment = require('moment');

var CacheObject = require('./cache-object');
var Util = require('./util');

const CHROME_STORAGE_KEY = 'spacetab';
const MAX_AGE_DEFAULT_SECONDS = 400;

var cache = {};
var cacheLoaded = false;
var cacheLoading = false;
var cacheLoadCallbacks = [];

initialize();

/*
 * Chrome storage save/load
 */

function initialize(callback) {
  if (callback) {
    Util.assert(Util.isFunction(callback));
  }

  if (cacheLoaded) {
    if (callback) {
      callback();
    }
  } else if (cacheLoading) {
    if (callback) {
      addCacheLoadCallback(callback);
    }
  } else {
    loadStorageData(callback);
  }
}

function loadStorageData(callback) {
  if (callback) {
    Util.assert(Util.isFunction(callback));
    addCacheLoadCallback(callback);
  }

  cacheLoaded = false;
  cacheLoading = true;

  chrome.storage.local.get(CHROME_STORAGE_KEY, (storageObj) => {
    Util.assert(Util.isObject(storageObj));
    var loadedObj = storageObj[CHROME_STORAGE_KEY] || {};
    for (var key in loadedObj) {
      if (!loadedObj.hasOwnProperty(key)) {
        continue;
      }

      var data = loadedObj[key];
      var cacheObject = CacheObject.fromObject(data);
      cache[key] = cacheObject;
    }

    cacheLoaded = true;
    cacheLoading = false;

    for (var idx in cacheLoadCallbacks) {
      var fxn = cacheLoadCallbacks[idx];
      Util.assert(Util.isFunction(fxn));
      fxn();
    }
    cacheLoadCallbacks = [];
  });
}

function saveStorageData(callback) {
  Util.assert(cacheLoaded);
  if (callback) {
    Util.assert(Util.isFunction(callback));
  }

  var storageObj = {};
  var savedObj = {};
  for (var key in cache) {
    if (!cache.hasOwnProperty(key)) {
      continue;
    }

    var cacheObject = cache[key];
    savedObj[key] = cacheObject.toObject();
  }

  storageObj[CHROME_STORAGE_KEY] = savedObj;

  chrome.storage.local.set(storageObj, () => {
    if (callback) {
      callback();
    }
  });
}

function addCacheLoadCallback(fxn) {
  Util.assert(Util.isFunction(fxn));
  cacheLoadCallbacks.push(fxn);
}

/*
* Create caches
 */

function createCache(name, apiUrl) {
  Util.assert(cacheLoaded);
  Util.assert(Util.isString(name));
  Util.assert(Util.isString(apiUrl));

  var cacheObject = new CacheObject({apiUrl: apiUrl});
  cache[name] = cacheObject;

  saveStorageData();
}

function createCacheIfNeeded(name, apiUrl) {
  Util.assert(cacheLoaded);
  if (!Util.isCacheObject(cache[name])) {
    Util.log("Creating cache " + name);
    createCache(name, apiUrl);
  }
}

/*
* Get/set data from cache
 */

function getData(key, callback) {
  Util.assert(cacheLoaded);
  Util.assert(Util.isString(key));
  Util.assert(Util.isFunction(callback));

  var cacheObject = cache[key];
  if (!Util.isCacheObject(cacheObject)) {
    callback(null);
    return;
  }
  var timestamp = getTimestamp(key);
  var maxAgeSeconds = getMaxAge(key);

  var dataIsOld = Moment().unix() >= timestamp + maxAgeSeconds;
  var noData = !cacheObject.getData();
  if (dataIsOld || noData) {
    Util.log("Getting new data for " + key);
    // fetch new data
    var apiUrl = getApiUrl(key);
    Util.getJson(apiUrl, (data) => {
      setData(key, data);
      callback(data);
    });
  } else {
    Util.log("Using cached data for " + key);
    callback(cacheObject.getData());
  }
}

function setData(key, data, callback) {
  Util.assert(cacheLoaded);
  Util.assert(Util.isString(key));
  if (callback) {
    Util.assert(Util.isFunction(callback));
  }

  var cacheObject = cache[key];
  Util.assert(Util.isCacheObject(cacheObject));
  cacheObject.setData(data);
  setTimestamp(key, Moment().unix());

  saveStorageData(() => {
    if (callback) {
      callback();
    }
  });
}

/*
 * Set cache data and metadata
 */

function getMetadata(key, metadataKey) {
  Util.assert(cacheLoaded);
  Util.assert(Util.isString(key));
  Util.assert(Util.isString(metadataKey));

  var cacheObject = cache[key];
  Util.assert(Util.isCacheObject(cacheObject));
  return cacheObject.getMetadata(metadataKey);
}

function setMetadata(key, metadataKey, metadataData) {
  Util.assert(cacheLoaded);
  Util.assert(Util.isString(key));
  Util.assert(Util.isString(metadataKey));

  var cacheObject = cache[key];
  Util.assert(Util.isCacheObject(cacheObject));
  cacheObject.setMetadata(metadataKey, metadataData);

  saveStorageData();
}

function getMaxAge(key) {
  // DEFAULT: 400s
  var maxAge = getMetadata(key, 'maxAgeSeconds');
  return (maxAge || maxAge === 0) ? maxAge : MAX_AGE_DEFAULT_SECONDS;
}

function setMaxAge(key, maxAgeSeconds) {
  Util.assert(Util.isInt(maxAgeSeconds));
  setMetadata(key, 'maxAgeSeconds', maxAgeSeconds);
}

function getApiUrl(key) {
  return getMetadata(key, 'apiUrl');
}

function setApiUrl(key, url) {
  Util.assert(Util.isString(url));
  setMetadata(key, 'apiUrl', url);
}

function getTimestamp(key) {
  return getMetadata(key, 'timestamp');
}

function setTimestamp(key, timestamp) {
  Util.assert(Util.isInt(timestamp));
  setMetadata(key, 'timestamp', timestamp);
}

/*
 * Exported functions
 */

module.exports = {
  initialize: initialize,

  createCache: createCache,

  createCacheIfNeeded: createCacheIfNeeded,

  getData: getData,

  getMaxAge: getMaxAge,

  setMaxAge: setMaxAge,

  getApiUrl: getApiUrl,

  setApiUrl: setApiUrl,

  getTimestamp: getTimestamp,

  setTimestamp: setTimestamp
};
