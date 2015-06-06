Circuit Breaker
========
[![Built with Grunt](https://cdn.gruntjs.com/builtwith.png)](http://gruntjs.com/)
[![Build Status](https://travis-ci.org/LivePersonInc/circuit-breakerjs.svg)](https://travis-ci.org/LivePersonInc/circuit-breakerjs)
[![Test Coverage](https://codeclimate.com/github/LivePersonInc/circuit-breakerjs/badges/coverage.svg)](https://codeclimate.com/github/LivePersonInc/circuit-breakerjs/coverage)
[![Code Climate](https://codeclimate.com/github/LivePersonInc/circuit-breakerjs/badges/gpa.svg)](https://codeclimate.com/github/LivePersonInc/circuit-breakerjs)
[![npm version](https://badge.fury.io/js/circuit-breakerjs.svg)](http://badge.fury.io/js/circuit-breakerjs)
[![Dependency Status](https://david-dm.org/LivePersonInc/circuit-breakerjs.svg?theme=shields.io)](https://david-dm.org/LivePersonInc/circuit-breakerjs)
[![devDependency Status](https://david-dm.org/LivePersonInc/circuit-breakerjs/dev-status.svg?theme=shields.io)](https://david-dm.org/LivePersonInc/circuit-breakerjs#info=devDependencies)
[![npm downloads](https://img.shields.io/npm/dm/circuit-breakerjs.svg)](https://img.shields.io/npm/dm/circuit-breakerjs.svg)
[![NPM](https://nodei.co/npm/circuit-breakerjs.png)](https://nodei.co/npm/circuit-breakerjs/)

> Javascript Implementation for Circuit Breaker (Port of [Hystrix](https://github.com/Netflix/Hystrix/wiki/How-it-Works#CircuitBreaker) Circuit Breaker)

This is a UMD module that can be used as AMD module, native and NodeJS.

Getting Started
---------------
Run `npm install circuit-breakerjs`

Overview
-------------
A Circuit Breaker is a fail fast mechanism which aids in providing stability and prevents cascading failures in distributed systems.
> "The basic idea behind the circuit breaker is very simple.
You wrap a protected function call in a circuit breaker object, which monitors for failures. Once the failures reach a certain threshold, the circuit breaker trips, and all further calls to the circuit breaker return with an error, without the protected call being made at all" - [Martin Fowler](http://martinfowler.com/bliki/CircuitBreaker.html)

![image](http://martinfowler.com/bliki/images/circuitBreaker/state.png)

An example would be a third-party web service or widget which is out of your control.

The Circuit Breaker can wrap either free functions or logically-related functions defined on a single Object.
The wrapped function is invoked by the breaker so existing code transparently benefits from the fail-fast behavior.

This implementation is a port of the [Hystrix](https://github.com/Netflix/Hystrix/wiki/How-it-Works#CircuitBreaker) Circuit Breaker:

![image](https://github.com/Netflix/Hystrix/wiki/images/circuit-breaker-640.png)

Please also see [Making the Netflix API More Resilient](http://techblog.netflix.com/2011/12/making-netflix-api-more-resilient.html)

###Initialization Options
#### options.slidingTimeWindow
Type: `Number`
Default value: `30000`

Optional time window that will be used for state calculations [milliseconds]

The sliding time window is based on Netflix's Hystrix, and defines the half-open state in which a test request will be made to close the circuit on success.

#### options.bucketsNumber
Type: `Number`
Default value: `10`

Optional number of the buckets that the time window will be split to (a bucket is a sliding unit that is added/remove from the time window)

#### options.tolerance
Type: `Number`
Default value: `50`

Optional tolerance before opening the circuit [percentage]

#### options.calibration
Type: `Number`
Default value: `5`

Optional calibration of minimum calls before starting to validate measurements

#### options.timeout
Type: `Number`
Default value: `0`

Optional timeout parameter to apply and time the command

#### options.onopen
Type: `Function`
Default value: `Empty function`

Optional handler for circuit open

#### options.onclose
Type: `Function`
Default value: `Empty function`

Optional handler for circuit close

API
----------
### run (command, [optional]fallback, [optional]timeout)
Will execute the command via the circuit breaker and invoke the optional fallback in case the circuit is opened.
`fallback` is an optional method to invoke in case the circuit is opened.
`timeout` is an optional number of milliseconds to timeout the command based on an internal timer.

### close
Will force the circuit breaker to close.

### open
Will force the circuit breaker to open.

### reset
Will reset the circuit breaker to its initial state.

### isOpen
Will return a boolean flag indicator for whether the circuit breaker is opened.

### calculate
Will return a matrix of calculations for the current information from all existing buckets.

Example
-----------
```javascript
var CircuitBreaker = require("CircuitBreaker").CircuitBreaker;
var circuit = new CircuitBreaker({
    slidingTimeWindow: 5000,
    bucketsNumber: 10,
    tolerance: 50,
    calibration: 5,
    timeout: 0,
    onopen: function() {
        // Do Something when opened
    },
    onclose: function() {
        // Do Something when closed
    }
});
circuit.run(function(success, failure, timeout) {
    $.ajax({
      url: "http://a-web-service-of-some-kind",
      context: document.body
    }).done(success).fail(failure);
});
```

For more example, look at the test directory.

License
----------
MIT
