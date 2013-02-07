/*
 Copyright (c) 2012, Yahoo! Inc.  All rights reserved.
 Copyrights licensed under the New BSD License. See the accompanying LICENSE file for terms.
 */

// Originally, ./lib/command/common/run-with-cover.js

var Module = require('module'),
    path = require('path'),
    fs = require('fs'),
    nopt = require('nopt'),
    which = require('which'),
    mkdirp = require('mkdirp'),
    existsSync = fs.existsSync || path.existsSync,
    inputError = require('../util/input-error'),
    matcherFor = require('../util/file-matcher').matcherFor,
    Instrumenter = require('../instrumenter'),
    util = require('util'),
    Command = require('./index'),
    formatOption = require('../util/help-formatter').formatOption,
    hook = require('../hook'),
    resolve = require('resolve');


function TraceCommand() {
    Command.call(this);
}

TraceCommand.TYPE = 'trace';
util.inherits(TraceCommand, Command);

Command.mix(TraceCommand, {
    synopsis: function synopsis() {
	return "Lazily instruments a JavaScript program as it runs.";
    },

    usage: function(arg0, command) {
        console.error('\nUsage: ' + arg0 + ' ' + command + ' [<options>] <executable-js-file-or-command> [-- <arguments-to-jsfile>]\n\nOptions are:\n\n' +
            [
                formatOption('--root <path> ', 'the root path to look for files to instrument, defaults to .'),
                formatOption('-x <exclude-pattern> [-x <exclude-pattern>]', 'one or more fileset patterns e.g. "**/vendor/**"'),
                formatOption('--[no-]default-excludes', 'apply default excludes [ **/node_modules/**, **/test/**, **/tests/** ], defaults to true'),
                formatOption('--hook-run-in-context', 'hook vm.runInThisContext in addition to require (supports RequireJS), defaults to false'),
                formatOption('--post-require-hook <file> | <module>', 'JS module that exports a function for post-require processing'),
                formatOption('--dir <report-dir>', 'report directory, defaults to ./dtrace'),
                formatOption('--verbose, -v', 'verbose mode')
            ].join('\n\n') + '\n');
        console.error('\n');
    },

    run: function(args, commandName, enableHooks, callback) {

	var config = {
            root: path,
            x: [Array, String],
            report: String,
            dir: path,
            verbose: Boolean,
            'default-excludes': Boolean,
            print: String,
            'self-test': Boolean,
            'hook-run-in-context': Boolean,
            'post-require-hook': String
        },
        opts = nopt(config, { v : '--verbose' }, args, 0),
        cmdAndArgs = opts.argv.remain,
        cmd,
        cmdArgs,
        reportingDir,
        reportClassName,
        reports = [],
        runFn,
        excludes;

	if (cmdAndArgs.length === 0) {
            return callback(inputError.create('Need a filename argument for the ' + commandName + ' command!'));
	}

	cmd = cmdAndArgs.shift();
	cmdArgs = cmdAndArgs;

	if (!existsSync(cmd)) {
            try {
		cmd = which.sync(cmd);
            } catch (ex) {
		return callback(inputError.create('Unable to resolve file [' + cmd + ']'));
            }
	} else {
            cmd = path.resolve(cmd);
	}

	runFn = function () {
            process.argv = ["node", cmd].concat(cmdArgs);
            if (opts.verbose) {
		console.log('Running: ' + process.argv.join(' '));
            }
            process.env.running_under_ahipa=1;
            Module.runMain(cmd, null, true);
	};

	excludes = typeof opts['default-excludes'] === 'undefined' || opts['default-excludes'] ?
            [ '**/node_modules/**', '**/test/**', '**/tests/**' ] : [];
	excludes.push.apply(excludes, opts.x);

	if (enableHooks) {
            reportingDir = opts.dir || path.resolve(process.cwd(), 'daikon');
            mkdirp.sync(reportingDir); //ensure we fail early if we cannot do this

            matcherFor({
			   root: opts.root || process.cwd(),
			   includes: [ '**/*.js' ],
			   excludes: excludes
		       },
		       function (err, matchFn) {
			   if (err) { return callback(err); }

			   // TODO: revisit
			   var coverageVar = '$$cov_' + new Date().getTime() + '$$',
			   instrumenter = new Instrumenter({ globalVariableName: coverageVar }),
			   transformer = instrumenter.instrumentSync.bind(instrumenter),
			   hookOpts = { verbose: opts.verbose },
			   postRequireHook = opts['post-require-hook'],
			   postLoadHookFile;

			   if (postRequireHook) {
			       postLoadHookFile = path.resolve(postRequireHook);
			   }

			   if (postRequireHook) {
			       if (!existsSync(postLoadHookFile)) { //assume it is a module name and resolve it
				   try {
				       postLoadHookFile = resolve.sync(postRequireHook, { basedir: process.cwd() });
				   } catch (ex) {
				       if (opts.verbose) { console.error('Unable to resolve [' + postRequireHook + '] as a node module'); }
				   }
			       }
			   }
			   if (postLoadHookFile) {
			       if (opts.verbose) { console.log('Use post-load-hook: ' + postLoadHookFile); }
			       hookOpts.postLoadHook = require(postLoadHookFile)(matchFn, transformer, opts.verbose);
			   }

			   if (opts['self-test']) {
			       hook.unloadRequireCache(matchFn);
			   }
			   // runInThisContext is used by RequireJS [issue #23]
			   if (opts['hook-run-in-context']) {
			       hook.hookRunInThisContext(matchFn, transformer, hookOpts);
			   }
			   hook.hookRequire(matchFn, transformer, hookOpts);
			   process.once('exit', function () {
					    var file = path.resolve(reportingDir, 'ahipa.dtrace'),
					    collector,
					    cov;
					    if (typeof global[coverageVar] === 'undefined') {
						console.error('No trace information was collected, exit without writing daikon trace');
						return;
					    } else {
						cov = global[coverageVar];
					    }
					    //important: there is no event loop at this point
					    //everything that happens in this exit handler MUST be synchronous
					    mkdirp.sync(reportingDir); //yes, do this again since some test runners could clean the dir initially created
					    console.error('=============================================================================');
					    console.error('Writing instrumentation object [' + file + ']');
					    fs.writeFileSync(file, JSON.stringify(cov), 'utf8');
					    return callback();
					});
			   runFn();
		       });
	} else {
            runFn();
	}
    }
});

module.exports = TraceCommand;
