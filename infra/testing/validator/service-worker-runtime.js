/*
  Copyright 2018 Google LLC

  Use of this source code is governed by an MIT-style
  license that can be found in the LICENSE file or at
  https://opensource.org/licenses/MIT.
*/

const assert = require('assert');
const expect = require('chai').expect;
const fse = require('fs-extra');
const makeServiceWorkerEnv = require('service-worker-mock');
const sinon = require('sinon');
const vm = require('vm');

// See https://github.com/chaijs/chai/issues/697
function stringifyFunctionsInArray(arr) {
  return arr.map((item) => typeof item === 'function' ? item.toString() : item);
}

function setupSpiesAndContext() {
  const cacheableResponsePluginSpy = sinon.spy();
  class CacheableResponsePlugin {
    constructor(...args) {
      cacheableResponsePluginSpy(...args);
    }
  }

  const cacheExpirationPluginSpy = sinon.spy();
  class CacheExpirationPlugin {
    constructor(...args) {
      cacheExpirationPluginSpy(...args);
    }
  }

  const importScripts = sinon.spy();

  const workbox = {
    cacheableResponse: {
      Plugin: CacheableResponsePlugin,
    },
    expiration: {
      Plugin: CacheExpirationPlugin,
    },
    googleAnalytics: {
      initialize: sinon.spy(),
    },
    precaching: {
      // To make testing easier, hardcode this fake URL return value.
      getCacheKeyForURL: sinon.stub().returns('/urlWithCacheKey'),
      precacheAndRoute: sinon.spy(),
      cleanupOutdatedCaches: sinon.spy(),
    },
    routing: {
      registerNavigationRoute: sinon.spy(),
      registerRoute: sinon.spy(),
    },
    core: {
      clientsClaim: sinon.spy(),
      setCacheNameDetails: sinon.spy(),
      skipWaiting: sinon.spy(),
    },
    setConfig: sinon.spy(),
    // To make testing easier, return the name of the strategy.
    strategies: {
      CacheFirst: sinon.stub().returns({name: 'CacheFirst'}),
      NetworkFirst: sinon.stub().returns({name: 'NetworkFirst'}),
    },
  };

  const context = Object.assign({
    workbox,
    importScripts,
  }, makeServiceWorkerEnv());

  const methodsToSpies = {
    importScripts,
    cacheableResponsePlugin: cacheableResponsePluginSpy,
    cleanupOutdatedCaches: workbox.precaching.cleanupOutdatedCaches,
    cacheExpirationPlugin: cacheExpirationPluginSpy,
    CacheFirst: workbox.strategies.CacheFirst,
    clientsClaim: workbox.core.clientsClaim,
    getCacheKeyForURL: workbox.precaching.getCacheKeyForURL,
    googleAnalyticsInitialize: workbox.googleAnalytics.initialize,
    NetworkFirst: workbox.strategies.NetworkFirst,
    precacheAndRoute: workbox.precaching.precacheAndRoute,
    registerNavigationRoute: workbox.routing.registerNavigationRoute,
    registerRoute: workbox.routing.registerRoute,
    setCacheNameDetails: workbox.core.setCacheNameDetails,
    setConfig: workbox.setConfig,
    skipWaiting: workbox.core.skipWaiting,
  };

  return {context, methodsToSpies};
}

function validateMethodCalls({methodsToSpies, expectedMethodCalls}) {
  for (const [method, spy] of Object.entries(methodsToSpies)) {
    if (spy.called) {
      const args = spy.args.map(
          (arg) => Array.isArray(arg) ? stringifyFunctionsInArray(arg) : arg);
      expect(args).to.deep.equal(expectedMethodCalls[method],
          `while testing method calls for ${method}`);
    } else {
      expect(expectedMethodCalls[method],
          `while testing method calls for ${method}`).to.be.undefined;
    }
  }
}

/**
 * This is used in the service worker generation tests to validate core
 * service worker functionality. While we don't fully emulate a real service
 * worker runtime, we set up spies/stubs to listen for certain method calls,
 * run the code in a VM sandbox, and then verify that the service worker
 * made the expected method calls.
 *
 * If any of the expected method calls + parameter combinations were not made,
 * this method will reject with a description of what failed.
 *
 * @param {string} [swFile]
 * @param {string} [swString]
 * @param {Object} expectedMethodCalls
 * @return {Promise} Resolves if all of the expected method calls were made.
 */
module.exports = async ({swFile, swString, expectedMethodCalls}) => {
  assert((swFile || swString) && !(swFile && swString),
      `Set swFile or swString, but not both.`);

  if (swFile) {
    swString = await fse.readFile(swFile, 'utf8');
  }

  const {context, methodsToSpies} = setupSpiesAndContext();

  vm.runInNewContext(swString, context);

  validateMethodCalls({methodsToSpies, expectedMethodCalls});
};
