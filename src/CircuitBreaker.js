;(function (root, factory) {
    "use strict";

    /* istanbul ignore if */
    //<amd>
    if ("function" === typeof define && define.amd) {

        // AMD. Register as an anonymous module.
        define("CircuitBreaker", ["exports"], function () {
            if (!root.CircuitBreaker) {
                factory(root);
            }

            return root.CircuitBreaker;
        });

        return;
    }
    //</amd>
    /* istanbul ignore else */
    if ("object" === typeof exports) {
        // CommonJS
        factory(exports);
    }
    else {
        factory(root);
    }
}(typeof CircuitRoot === "undefined" ? this : CircuitRoot , function (root) {
    "use strict";

    /*jshint validthis:true */
    /**
     * @type {{OPEN: number, HALF_OPEN: number, CLOSED: number}}
     * State representation for the circuit
     */
    var STATE = {
        OPEN: 0,
        HALF_OPEN: 1,
        CLOSED: 2
    };

    /**
     * @type {{FAILURE: string, SUCCESS: string, TIMEOUT: string, OUTAGE: string}}
     * Measure types for each bucket
     */
    var MEASURE = {
        FAILURE: "failure",
        SUCCESS: "success",
        TIMEOUT: "timeout",
        OUTAGE: "outage"
    };

    /**
     * CircuitBreaker constructor
     * @constructor
     * @param {Object} [options] the configuration options for the instance
     * @param {Number} [options.slidingTimeWindow = 30000] - the time window that will be used for state calculations [milliseconds]
     * @param {Number} [options.bucketsNumber = 10] - the number of the buckets that the time window will be split to (a bucket is a sliding unit that is added/remove from the time window)
     * @param {Number} [options.tolerance = 50] - the tolerance before opening the circuit in percentage
     * @param {Number} [options.calibration = 5] - the calibration of minimum calls before starting to validate measurements [number]
     * @param {Number} [options.timeout = 0] - optional timeout parameter to apply and time the command [number]
     * @param {Function} [options.onopen] - handler for open
     * @param {Function} [options.onclose] - handler for close
     */
    function CircuitBreaker(options) {
        // For forcing new keyword
        if (false === (this instanceof CircuitBreaker)) {
            return new CircuitBreaker(options);
        }

        this.initialize(options);
    }

    CircuitBreaker.prototype = (function () {
        /**
         * Method for initialization
         * @param {Object} [options] the configuration options for the instance
         * @param {Number} [options.slidingTimeWindow = 30000] - the time window that will be used for state calculations [milliseconds]
         * @param {Number} [options.bucketsNumber = 10] - the number of the buckets that the time window will be split to (a bucket is a sliding unit that is added/remove from the time window)
         * @param {Number} [options.tolerance = 50] - the tolerance before opening the circuit in percentage
         * @param {Number} [options.calibration = 5] - the calibration of minimum calls before starting to validate measurements [number]
         * @param {Number} [options.timeout = 0] - optional timeout parameter to apply and time the command [number]
         * @param {Function} [options.onopen] - handler for open
         * @param {Function} [options.onclose] - handler for close
         */
        function initialize(options) {
            if (!this.initialized) {
                options = options || {};

                this.slidingTimeWindow = !isNaN(options.slidingTimeWindow) && 0 < options.slidingTimeWindow ? parseInt(options.slidingTimeWindow, 10) : 30000;
                this.bucketsNumber = !isNaN(options.bucketsNumber) && 0 < options.bucketsNumber ? parseInt(options.bucketsNumber, 10) : 10;
                this.tolerance = !isNaN(options.tolerance) && 0 < options.tolerance ? parseInt(options.tolerance, 10) : 50;
                this.calibration = !isNaN(options.calibration) && 0 < options.calibration ? parseInt(options.calibration, 10) : 5;
                this.timeout = !isNaN(options.timeout) && 0 < options.timeout ? parseInt(options.timeout, 10) : 0;
                this.onopen = ("function" === typeof options.onopen) ? options.onopen : function() {};
                this.onclose = ("function" === typeof options.onclose) ? options.onclose : function() {};
                this.buckets = [_createBucket.call(this)];

                this.state = STATE.CLOSED;
                this.initialized = true;

                _startTicking.call(this);
            }
        }

        /**
         * Method for assigning a defer execution
         * Code waiting for this promise uses this method
         * @param {Function} command - the command to run via the circuit
         * @param {Function} [fallback] - the fallback to run when circuit is opened
         * @param {Function} [timeout] - the timeout for the executed command
         */
        function run(command, fallback, timeout) {
            if (fallback && "function" !== typeof fallback) {
                timeout = fallback;
                fallback = void 0;
            }

            if (isOpen.call(this)) {
                _fallback.call(this, fallback || function() {});
                return false;
            }
            else {
                return _execute.call(this, command, timeout);
            }
        }

        /**
         * Method for forcing the circuit to open
         */
        function open() {
            this.forced = this.state;
            this.state = STATE.OPEN;
        }

        /**
         * Method for forcing the circuit to close
         */
        function close() {
            this.forced = this.state;
            this.state = STATE.CLOSED;
        }

        /**
         * Method for resetting the forcing
         */
        function reset() {
            this.state = this.forced;
            this.forced = void 0;
        }

        /**
         * Method for checking whether the circuit is open
         */
        function isOpen() {
            return STATE.OPEN === this.state;
        }

        /**
         * Method for calculating the needed metrics based on all calculation buckets
         */
        function calculate() {
            var bucketErrors;
            var percent;
            var total = 0;
            var error = 0;


            for (var i = 0; i < this.buckets.length; i++) {
                bucketErrors = (this.buckets[i][MEASURE.FAILURE] + this.buckets[i][MEASURE.TIMEOUT]);
                error += bucketErrors;
                total += bucketErrors + this.buckets[i][MEASURE.SUCCESS];
            }

            percent = (error / (total > 0 ? total : 1)) * 100;

            return {
                total: total,
                error: error,
                percent: percent
            };
        }

        /**
         * Method for the timer tick which manages the buckets
         * @private
         */
        function _tick() {
            if (this.timer) {
                clearTimeout(this.timer);
            }

            _createNextSlidingBucket.call(this);

            if (this.bucketIndex > this.bucketsNumber) {
                this.bucketIndex = 0;

                if (isOpen.call(this)) {
                    this.state = STATE.HALF_OPEN;
                }
            }

            this.timer = setTimeout(_tick.bind(this), this.bucket);
        }

        /**
         * Method for starting the timer and creating the metrics buckets for calculations
         * @private
         */
        function _startTicking() {
            this.bucketIndex = 0;
            this.bucket = this.slidingTimeWindow / this.bucketsNumber;

            if (this.timer) {
                clearTimeout(this.timer);
            }

            this.timer = setTimeout(_tick.bind(this), this.bucket);
        }

        /**
         * Method for creating a single metrics bucket for calculations
         * @private
         */
        function _createBucket() {
            var bucket = {};

            bucket[MEASURE.FAILURE] = 0;
            bucket[MEASURE.SUCCESS] = 0;
            bucket[MEASURE.TIMEOUT] = 0;
            bucket[MEASURE.OUTAGE] = 0;

            return bucket;
        }

        /**
         * Method for retrieving the last metrics bucket for calculations
         * @private
         */
        function _getLastBucket() {
            return this.buckets[this.buckets.length - 1];
        }

        /**
         * Method for creating the next bucket and removing the first bucket in case we got to the needed buckets number
         * @private
         */
        function _createNextSlidingBucket() {
            this.bucketIndex++;

            this.buckets.push(_createBucket.call(this));

            if (this.buckets.length > this.bucketsNumber) {
                this.buckets.shift();
            }
        }

        /**
         * Method for adding a calculation measure for a command
         * @param {CircuitBreaker.MEASURE} prop - the measurement property (success, error, timeout)
         * @param {Object} status - the status of the command (A single command can only be resolved once and represent a single measurement)
         * @private
         */
        function _measure(prop, status) {
            return function() {
                if (status.done) {
                    return;
                }
                else if (status.timer) {
                    clearTimeout(status.timer);
                    status.timer = null;
                    delete status.timer;
                }

                var bucket = _getLastBucket.call(this);
                bucket[prop]++;

                if (!this.forced) {
                    _updateState.call(this);
                }

                status.done = true;
            }.bind(this);
        }

        /**
         * Method for executing a command via the circuit and counting the needed metrics
         * @param {Function} command - the command to run via the circuit
         * @param {Number} timeout - optional timeout for the command
         * @private
         */
        function _execute(command, timeout) {
            var status = {
                done: false
            };
            var markSuccess = _measure.call(this, MEASURE.SUCCESS, status);
            var markFailure = _measure.call(this, MEASURE.FAILURE, status);
            var markTimeout = _measure.call(this, MEASURE.TIMEOUT, status);

            timeout = !isNaN(timeout) && 0 < timeout ? parseInt(timeout, 10) : this.timeout;

            if (0 < timeout) {
                status.timer = setTimeout(markTimeout, timeout);
            }

            try {
                command(markSuccess, markFailure, markTimeout);
            }
            catch(ex) {
                // TODO: Deal with errors
                markFailure();
            }
        }

        /**
         * Method for executing a command fallback via the circuit and counting the needed metrics
         * @param {Function} fallback - the command fallback to run via the circuit
         * @private
         */
        function _fallback(fallback) {
            try {
                fallback();
            }
            catch(ex) {
                // TODO: Deal with errors
            }

            var bucket = _getLastBucket.call(this);
            bucket[MEASURE.OUTAGE]++;
        }

        /**
         * Method for updating the circuit state based on the last command or existing metrics
         * @private
         */
        function _updateState() {
            var metrics = calculate.call(this);

            if (STATE.HALF_OPEN === this.state) {
                var lastCommandFailed = !_getLastBucket.call(this)[MEASURE.SUCCESS] && 0 < metrics.error;

                if (lastCommandFailed) {
                    this.state = STATE.OPEN;
                }
                else {
                    this.state = STATE.CLOSED;
                    this.onclose(metrics);
                }
            }
            else {
                var toleranceDeviation = metrics.percent > this.tolerance;
                var calibrationDeviation = metrics.total > this.calibration;
                var deviation = calibrationDeviation && toleranceDeviation;

                if (deviation) {
                    this.state = STATE.OPEN;
                    this.onopen(metrics);
                }
            }
        }

        return {
            initialize: initialize,
            run: run,
            close: close,
            open: open,
            reset: reset,
            isOpen: isOpen,
            calculate: calculate
        };
    }());

    /**
     * @type {{OPEN: number, HALF_OPEN: number, CLOSED: number}}
     * State representation for the circuit
     */
    CircuitBreaker.STATE = STATE;

    /**
     * Method to polyfill bind native functionality in case it does not exist
     * Based on implementation from:
     * https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Function/bind
     * @param {Object} object - the object to bind to
     * @returns {Function} the bound function
     */
    /* istanbul ignore next */
    function bind(object) {
        /*jshint validthis:true */
        var args;
        var fn;

        if ("function" !== typeof this) {
            // Closest thing possible to the ECMAScript 5
            // Internal IsCallable function
            throw new TypeError("Function.prototype.bind - what is trying to be bound is not callable");
        }

        args = Array.prototype.slice.call(arguments, 1);
        fn = this;

        function Empty() {}

        function bound() {
            return fn.apply(this instanceof Empty && object ? this : object,
                args.concat(Array.prototype.slice.call(arguments)));
        }

        Empty.prototype = this.prototype;
        bound.prototype = new Empty();

        return bound;
    }

    /* istanbul ignore if  */
    if (!Function.prototype.bind) {
        Function.prototype.bind = bind;
    }

    // attach properties to the exports object to define
    // the exported module properties.
    root.CircuitBreaker = root.CircuitBreaker || CircuitBreaker;
}));
