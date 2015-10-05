(function() {
    'use strict';

    angular.module('ai.public.serverLogger', ['ng'])
        .config(function($provide) {
            $provide.decorator('$log', function($delegate, $injector) {
                var logger = $injector.get('AiServerLogger');
                var delegateError = $delegate.error;
                var delegateWarn = $delegate.warn;
                var delegateInfo = $delegate.info;
                var delegateDebug = $delegate.debug;

                var enhanceLoggingFunction = function(loggingFunction, severity) {
                    return function() {
                        var args = [].slice.call(arguments);
                        loggingFunction.apply(null, args);

                        var message = args.length === 1 ? _.first(args) : JSON.stringify(args);
                        logger.send(message, severity);
                    };
                };

                $delegate.error = enhanceLoggingFunction(delegateError, 'Error');
                $delegate.warn = enhanceLoggingFunction(delegateWarn, 'Warning');
                $delegate.info = enhanceLoggingFunction(delegateInfo, 'Info');
                $delegate.debug = enhanceLoggingFunction(delegateDebug, 'Debug');
                $delegate.trace = enhanceLoggingFunction(delegateDebug, 'Trace');

                return $delegate;
            });
        })
        .provider('AiServerLogger', function() {
            var headers = {};
            var serverPostEndPoint;
            var queueSize = 100;
            var postToServerDelay = 1000 * 60 * 10;  //10 minutes

            var transformParameters = function() {
                return {
                    Message: arguments[0],
                    Level: arguments[1]
                };
            };

            var ServerLogger = (function() {
                function ServerLogger(loggerConfig) {
                    var config = loggerConfig;
                    var queue = [];
                    var timeOutId;
                    var $http;

                    this.send = function() {
                        if(_.isUndefined(config.serverPostEndPoint)) { return; }
                        var dto = transformParameters.apply(null, arguments);
                        queue.push(dto);
                        processQueue();
                    };

                    var processQueue = function() {
                        if(angular.isDefined(timeOutId)) {
                            if(queue.length >= config.queueSize) {
                                clearTimeout(timeOutId);
                                var payload = _.take(queue, config.queueSize);
                                queue = _.slice(queue, config.queueSize);
                                postToServer(payload);
                            }
                        }

                        timeOutId = setTimeout(function() {
                            timeOutId = undefined;
                            if(queue.length === 0) { return ; }

                            var payload = _.take(queue, config.queueSize);
                            queue = _.slice(queue, config.queueSize);
                            postToServer(payload);
                        }, config.postToServerDelay);
                    };

                    var postToServer = function(payload) {
                        if(_.isUndefined($http)) {
                            $http = config.injector.get('$http');
                        }
                        $http({
                            method: 'POST',
                            url: config.serverPostEndPoint,
                            headers: config.headers,
                            data: payload
                        });
                    };
                }

                return ServerLogger;
            }());

            return {
                setServerPostEndPoint: function(endpoint) {
                    serverPostEndPoint = endpoint;
                },
                setQueueSize: function(size) {
                    queueSize = size;
                },
                setHeaders: function(headerInfo) {
                    _.assign(headers, headerInfo);
                },
                setPostToServerDelay: function(delay) {
                    postToServerDelay = delay;
                },
                setTransformParameters: function(transformParametersFunction) {
                    transformParameters = transformParametersFunction;
                },
                $get: function($injector) {
                    return new ServerLogger({
                        injector: $injector,
                        headers: headers,
                        queueSize: queueSize,
                        postToServerDelay: postToServerDelay,
                        serverPostEndPoint: serverPostEndPoint
                    });
                }
            };
        });
}());
