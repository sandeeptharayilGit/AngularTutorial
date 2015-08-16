var qs = require('querystring');
var fs = require('fs');
var LIVERELOAD_PORT = 35729;
var log4js,logger,isLoggerLoaded=true,
loggerName='appLogger',LEVEL='INFO',log4jsConf='log4js_configuration.json';
var generateApp = function(data) {
	console.log(data);
	fs.writeFile("generator/config.json", JSON.stringify(data, null, '\t'), function(err) {
		if (err) {
			console.log(err);
		} else {
			console.log("The config.json created!");
			var exec = require('child_process').exec, child;

			child = exec('yo hybridapp', function(error, stdout, stderr) {
				console.log('stdout: ' + stdout);
				console.log('stderr: ' + stderr);
				if (error !== null) {
					console.log('exec error: ' + error);
				}
			});
		}
	});
},
mountFolder = function(connect, dir) {
	return connect.static(require('path').resolve(dir));
},
mountGenerate = function(req, res, next) {

	console.log("Requesting... " + req.url);
	if (req.url !== '/generate') return next();

	if (req.method == 'POST') {
		var body = '';
		req.on('data', function(data) {
			body += data;
		});
		req.on('end', function() {
			generateApp(JSON.parse(body));
		});
	}
	res.statusCode = 200;
	res.end();
},
mountLogger = function(loggerObj) {
	var setLog = function(log) {
		switch (log.mode) {
			case 'trace':loggerObj.trace(log.data);break;
			case 'debug':loggerObj.debug(log.data);break;
			case 'info':loggerObj.info(log.data);break;
			case 'log':loggerObj.info(log.data);break;
			case 'warn':loggerObj.warn(log.data);break;
			case 'error':loggerObj.error(log.data);break;
			case 'fatal':loggerObj.fatal(log.data);break;
			default:loggerObj.info(log.data);
		}
	};
	return function(req, res, next) {
		console.log("Requesting... " + req.url);
		if (req.url !== '/log') return next();

		if (req.method == 'POST') {
			var body = '';
			req.on('data', function(data) {
				body += data;
				// 1e6 === 1 * Math.pow(10, 6) === 1 * 1000000 ~~~ 1MB
				if (body.length > 1e6) {
					// FLOOD ATTACK OR FAULTY CLIENT, NUKE REQUEST
					req.connection.destroy();
				}
			});
			req.on('end', function() {
				setLog(JSON.parse(qs.parse(body).message));
			});
		}
		res.statusCode = 200;
		res.end();
	};
};

module.exports = function(grunt) {
	grunt.initConfig({
		distFolder : 'app',
		srcFolder : 'app',
		cssmin : {
			css : {
				files : {
					"<%= distFolder %>/styles/main.css" : [ "app/styles/*.css" ]
				}
			}
		},
		htmlbuild: {
			dist: {
				src: '<%= srcFolder %>/index.html',
				dest: '<%= distFolder %>/',
				options: {
					beautify: true,
					relative: false,
					scripts: {
						app: {
							cwd: '<%= srcFolder %>/',files: ['scripts/app.js']
						},
						controllers: {
							cwd: '<%= srcFolder %>/',files: ['scripts/controllers/*.js']
						},
						services: {
							cwd: '<%= srcFolder %>/',files: ['scripts/services/*.js']
						},
						directives: {
							cwd: '<%= srcFolder %>/',files: ['scripts/directives/*.js']
						},
						filters: {
							cwd: '<%= srcFolder %>/',files: ['scripts/filters/*.js']
						},
						misc: {
							cwd: '<%= srcFolder %>/',
							files: ['scripts/**/*.js','!scripts/app.js','!scripts/controllers/*.js','!scripts/services/*.js','!scripts/directives/*.js','!scripts/filters/*.js']
						}
					}
				}
			}
		},
		wiredep : {
			target : {
		        // Point to the files that should be updated when you run `grunt wiredep`
		        src : [ '<%= distFolder %>/index.html'  ], // .html support..
		        cwd : '',
		        dependencies : true,
		        devDependencies : false,
		        exclude : [],
		        fileTypes : {},
		        ignorePath : '',
		        overrides : {}
		    }
		},
		copy : {
			all : {
				files : [ {
					expand : true,cwd : '<%= srcFolder %>/',
					src : [ 'images/**', 'views/**', 'scripts/**', 'favicon.ico', 'index.html' ],
					dest : '<%= distFolder %>/'
				} ]
			},
			others : {
				files : [ {
					expand : true,cwd : '<%= srcFolder %>/',
					src : [ 'images/**', 'scripts/json/**', 'scripts/config.json' ],
					dest : '<%= distFolder %>/'
				} ]
			},
			js : {
				files : [ {
					expand : true,cwd : '<%= srcFolder %>/',
					src : [ 'scripts/**/*.js','scripts/app.js'],
					dest : '<%= distFolder %>/'
				} ]
			},
			htmls : {
				files : [ {
					expand : true,cwd : '<%= srcFolder %>/',
					src : [ 'views/**'],
					dest : '<%= distFolder %>/'
				} ]
			},
			indexhtml : {
				files : [ {
					expand : true,cwd : '<%= srcFolder %>/',
					src : ['index.html'],
					dest : '<%= distFolder %>/'
				} ]
			}
		},
		watch: {
			options: {
				debounceDelay: 250,
				livereload: LIVERELOAD_PORT,
				cwd : '<%= srcFolder %>/'
			},
			scripts: {
				files: ['scripts/{,*/}/*.js'],
				tasks: ['copy:js', 'htmlbuild','wiredep']
			},
			css: {
				files: ['styles/*.css'],
				tasks: ['cssmin']
			},
			htmls: {
				files: ['views/**'],
				tasks: ['copy:htmls']
			},
			indexhtml: {
				files: ['index.html'],
				tasks: ['copy:indexhtml','htmlbuild','wiredep']
			},
			others: {
				files: ['images/**', 'scripts/*.json','scripts/**/*.json'],
				tasks: ['copy:others' ]
			}
	},
	connect : {
		server : {
			options : {

				open : true,
				port : 9001,
				base : '<%= distFolder %>',
				livereload:true,
				middleware : function(connect, options) {
					if(!isLoggerLoaded)
					{
						log4js = require('log4js');
						log4js.configure(log4jsConf, {});
						logger = log4js.getLogger(loggerName);
						logger.setLevel(LEVEL);
						isLoggerLoaded=true;
						console.log('logger inialised for '+loggerName);
					}

					return [ require('connect-livereload')(), mountFolder(connect, options.base)];
				}
			}
		},
		generator : {
			options : {
				keepalive : true,
				open : true,
				port : 7777,
				base : 'generator',
				middleware : function(connect, options) {
					return [connect.favicon('generator/favicon.ico'), mountGenerate, mountFolder(connect, options.base)];
				}
			}
		}
	}
});

grunt.loadNpmTasks('grunt-contrib-connect');
grunt.loadNpmTasks('grunt-contrib-cssmin');
grunt.loadNpmTasks('grunt-wiredep');
grunt.loadNpmTasks('grunt-contrib-copy');
grunt.loadNpmTasks('grunt-contrib-watch');
grunt.loadNpmTasks('grunt-html-build');

grunt.registerTask('server', [ 'connect:server','watch' ]);
grunt.registerTask('generator', [ 'connect:generator' ]);
grunt.registerTask('build', [ 'copy:all', 'cssmin', 'htmlbuild','wiredep' ]);
grunt.registerTask('default', [ 'server' ]);
}