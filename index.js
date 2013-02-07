/*
Copyright (c) 2013, University of Washington. All rights reserved.
Copyright (c) 2012, Yahoo! Inc.  All rights reserved.
Copyrights licensed under the New BSD License. See the accompanying LICENSE file for terms.
*/

/**
 * provides access to the key libraries in ahipa so you can write
 * your own tools using `ahipa` as a library.
 *
 * @module ahipa
 */

/*jslint nomen: true */
var path = require('path'),
    fs = require('fs'),
//    Store = require('./lib/store'),
//    Report = require('./lib/report'),
    meta = require('./lib/util/meta');

//register our standard plaugins
require('./lib/register-plugins');

/**
 * the top-level API for `ahipa`.
 *
 * Usage
 * -----
 *
 *      var ahipa = require('ahipa');
 *
 *
 * @class API
 */

module.exports = {
    /**
     * the Instrumenter class.
     * @property {Instrumenter} Instrumenter
     * @static
     */
    Instrumenter: require('./lib/instrumenter'),
    /**
     * the hook module
     * @property {Hook} hook
     * @static
     */
    hook: require('./lib/hook'),
    /**
     * utility for processing coverage objects
     * @property {ObjectUtils} utils
     * @static
     */
    utils: require('./lib/object-utils'),
    /**
     * asynchronously returns a function that can match filesystem paths.
     * The function returned in the callback may be passed directly as a `matcher`
     * to the functions in the `hook` module.
     *
     * When no options are passed, the match function is one that matches all JS
     * files under the current working directory except ones under `node_modules`
     *
     * Match patterns are `ant`-style patterns processed using the `fileset` library.
     * Examples not provided due to limitations in putting asterisks inside
     * jsdoc comments. Please refer to tests under `test/other/test-matcher.js`
     * for examples.
     *
     * @method matcherFor
     * @static
     * @param {Object} options Optional. Lookup options.
     * @param {String} [options.root] the root of the filesystem tree under
     *     which to match files. Defaults to `process.cwd()`
     * @param {Array} [options.includes] an array of include patterns to match.
     *     Defaults to all JS files under the root.
     * @param {Array} [options.excludes] and array of exclude patterns. File paths
     *     matching these patterns will be excluded by the returned matcher.
     *     Defaults to files under `node_modules` found anywhere under root.
     * @param {Function(err, matchFunction)} callback  The callback that is
     *      called with two arguments. The first is an `Error` object in case
     *      of errors or a falsy value if there were no errors. The second
     *      is a function that may be use as a matcher.
     */
    matcherFor: require('./lib/util/file-matcher').matcherFor,
    /**
     * the version of the library
     * @property {String} VERSION
     * @static
     */
    VERSION: meta.VERSION,
};


