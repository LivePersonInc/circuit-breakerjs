var expect = require("chai").expect;
var sinon = require("sinon");
var requireHelper = require("./util/require_helper");
var CircuitBreaker = requireHelper("CircuitBreaker").CircuitBreaker;

describe("circuit-breaker Sanity Tests", function () {
    // create a sandbox
    var sandbox;
    var onopen;
    var onclose;
    var success;
    var failure;
    var timeout;
    var throws;
    var deferred;
    var deferredTimeout;
    var fallback;
    var config;
    var circuit;

    describe("simplest commands execution tests via the circuit breaker", function () {
        beforeEach(function () {
            // create a sandbox
            sandbox = sinon.sandbox.create();
            success = sandbox.spy(function (success, failure, timeout) {
                success();
            });

            circuit = CircuitBreaker(); // This is to check the new enforcement, usually we should use "new CircuitBreaker(config)"
        });

        it("should run the first command", function () {
            circuit.run(success);
            expect(success.calledOnce).to.be.true;
        });

        it("should run the first command only when the circuit is closed", function () {
            circuit.open();
            circuit.run(success);
            expect(success.calledOnce).to.be.false;
            circuit.close();
            circuit.run(success);
            expect(success.calledOnce).to.be.true;
        });

        it("should calculate and run the first command", function () {
            expect(circuit.calculate().total).to.equal(0);
            expect(circuit.calculate().error).to.equal(0);
            expect(circuit.calculate().percent).to.equal(0);
            circuit.run(success);
            expect(success.calledOnce).to.be.true;
            expect(circuit.calculate().total).to.equal(1);
            expect(circuit.calculate().error).to.equal(0);
            expect(circuit.calculate().percent).to.equal(0);
        });

        afterEach(function() {
            // restore the environment as it was before
            sandbox.restore();
            circuit = void 0;
        });
    });

    describe("simple (multiple bucket) commands execution tests via the circuit breaker", function () {
        before(function () {
            config = {
                slidingTimeWindow: 400,
                bucketsNumber: 5,
                tolerance: 50,
                calibration: 1,
                timeout: 0
            };
        });

        beforeEach(function () {
            // create a sandbox
            sandbox = sinon.sandbox.create();
            onopen = sandbox.spy(function () {});
            onclose = sandbox.spy(function () {});
            success = sandbox.spy(function (success, failure, timeout) {
                success();
            });
            failure = sandbox.spy(function (success, failure, timeout) {
                failure();
            });
            timeout = sandbox.spy(function (success, failure, timeout) {
                timeout();
            });
            throws = sandbox.spy(function (success, failure, timeout) {
                throw new Error("Something is wrong here!!!");
            });

            config.onopen = onopen;
            config.onclose = onclose;

            circuit = new CircuitBreaker(config);
        });

        it("should run the first two commands before the circuit is opened and no more calls passes", function () {
            circuit.run(failure);
            circuit.run(failure);
            expect(onopen.calledOnce).to.be.true;
            expect(circuit.isOpen()).to.be.true;
            expect(failure.calledTwice).to.be.true;
            expect(circuit.calculate().total).to.equal(2);
            expect(circuit.calculate().error).to.equal(2);
            expect(circuit.calculate().percent).to.equal(100);
            circuit.run(failure);
            circuit.run(failure);
            expect(failure.calledTwice).to.be.true;
        });

        it("should run the first two commands before the circuit is opened and no more calls passes this time with exceptions throwing", function () {
            circuit.run(throws);
            circuit.run(throws);
            expect(onopen.calledOnce).to.be.true;
            expect(circuit.isOpen()).to.be.true;
            expect(throws.calledTwice).to.be.true;
            expect(circuit.calculate().total).to.equal(2);
            expect(circuit.calculate().error).to.equal(2);
            expect(circuit.calculate().percent).to.equal(100);
            circuit.run(throws);
            circuit.run(throws);
            expect(throws.calledTwice).to.be.true;
        });

        it("should run the first two commands with timeout (by the using module) before the circuit is opened and no more calls passes", function () {
            circuit.run(failure);
            circuit.run(timeout);
            expect(onopen.calledOnce).to.be.true;
            expect(circuit.isOpen()).to.be.true;
            expect(failure.calledOnce).to.be.true;
            expect(timeout.calledOnce).to.be.true;
            circuit.run(failure);
            circuit.run(timeout);
            expect(failure.calledOnce).to.be.true;
            expect(timeout.calledOnce).to.be.true;
        });

        it("should run the first two commands before the circuit is opened, reset the circuit and continue run commands", function () {
            circuit.run(failure);
            circuit.run(failure);
            expect(onopen.calledOnce).to.be.true;
            expect(circuit.isOpen()).to.be.true;
            expect(failure.calledTwice).to.be.true;
            circuit.run(failure);
            circuit.run(failure);
            expect(failure.calledTwice).to.be.true;
            circuit.reset();
            expect(circuit.isOpen()).to.be.false;
            circuit.run(success);
            expect(success.calledOnce).to.be.true;
        });

        it("should run the first two commands before the circuit is opened, than wait for a new bucket and run a success method to close the circuit again", function (done) {
            circuit.run(failure);
            circuit.run(failure);
            expect(onopen.calledOnce).to.be.true;
            expect(circuit.isOpen()).to.be.true;
            expect(failure.calledTwice).to.be.true;
            circuit.run(failure);
            circuit.run(failure);
            expect(failure.calledTwice).to.be.true;

            setTimeout(function () {
                circuit.run(success);
                expect(onclose.calledOnce).to.be.true;
                expect(circuit.isOpen()).to.be.false;
                circuit.run(success);
                circuit.run(success);
                circuit.run(success);
                circuit.run(failure);
                circuit.run(failure);
                expect(circuit.isOpen()).to.be.false;
                done();
            }, 600);
        });

        it("should run the first two commands before the circuit is opened, than wait for a new bucket and run a failure method to reopen the circuit again", function (done) {
            circuit.run(failure);
            circuit.run(failure);
            expect(onopen.calledOnce).to.be.true;
            expect(circuit.isOpen()).to.be.true;
            expect(failure.calledTwice).to.be.true;
            circuit.run(failure);
            circuit.run(failure);
            expect(failure.calledTwice).to.be.true;

            setTimeout(function () {
                circuit.run(failure);
                expect(onclose.calledOnce).to.be.false;
                expect(circuit.isOpen()).to.be.true;
                circuit.run(success);
                circuit.run(success);
                expect(circuit.isOpen()).to.be.true;
                done();
            }, 600);
        });

        it("should run commands over time frame exceeding the number of buckets", function (done) {
            circuit.run(success);
            circuit.run(success);
            circuit.run(success);
            circuit.run(failure);
            expect(success.calledThrice).to.be.true;
            expect(failure.calledOnce).to.be.true;
            expect(onopen.calledOnce).to.be.false;
            expect(circuit.isOpen()).to.be.false;
            expect(circuit.calculate().total).to.equal(4);
            expect(circuit.calculate().error).to.equal(1);
            expect(circuit.calculate().percent).to.equal(25);

            setTimeout(function() {
                circuit.run(success);
                circuit.run(success);
                circuit.run(success);
                circuit.run(success);
                expect(onopen.calledOnce).to.be.false;
                expect(circuit.isOpen()).to.be.false;
                expect(circuit.calculate().total).to.equal(8);
                expect(circuit.calculate().error).to.equal(1);
                expect(circuit.calculate().percent).to.equal(12.5);

                setTimeout(function () {
                    circuit.run(success);
                    circuit.run(success);
                    circuit.run(success);
                    circuit.run(success);
                    expect(onopen.calledOnce).to.be.false;
                    expect(circuit.isOpen()).to.be.false;
                    expect(circuit.calculate().total).to.equal(8);
                    expect(circuit.calculate().error).to.equal(0);
                    expect(circuit.calculate().percent).to.equal(0);
                    done();
                }, 200);
            }, 400)
        });

        afterEach(function() {
            // restore the environment as it was before
            sandbox.restore();
            circuit = void 0;
        });
    });

    describe("deferred commands execution tests via the circuit breaker", function () {
        before(function () {
            config = {
                slidingTimeWindow: 400,
                bucketsNumber: 5,
                tolerance: 50,
                calibration: 1,
                timeout: 100
            };
        });

        beforeEach(function () {
            // create a sandbox
            sandbox = sinon.sandbox.create();
            onopen = sandbox.spy(function () {});
            onclose = sandbox.spy(function () {});
            fallback = sandbox.spy(function () {});
            success = sandbox.spy(function (success, failure, timeout) {
                success();
            });
            deferred = sandbox.spy(function (success, failure, timeout) {
                setTimeout(function () {
                    success();
                }, 200);
            });
            deferredTimeout = sandbox.spy(function (success, failure, timeout) {
                setTimeout(function () {
                    timeout();
                }, 200);
            });

            config.onopen = onopen;
            config.onclose = onclose;

            circuit = new CircuitBreaker(config);
        });

        it("should run the first two commands which should timeout (by the circuit breaker timer)", function (done) {
            circuit.run(deferred);
            circuit.run(deferred);
            expect(deferred.calledTwice).to.be.true;

            expect(onopen.calledOnce).to.be.false;
            expect(circuit.isOpen()).to.be.false;

            circuit.run(success);
            expect(success.calledOnce).to.be.true;

            setTimeout(function() {
                expect(onopen.calledOnce).to.be.true;
                expect(circuit.isOpen()).to.be.true;
                done();
            }, 300);
        });

        it("should run the first two commands which should timeout on both ends (by the circuit breaker timer and by the caller)", function (done) {
            circuit.run(deferredTimeout, 200);
            circuit.run(deferredTimeout);
            expect(deferredTimeout.calledTwice).to.be.true;

            expect(onopen.calledOnce).to.be.false;
            expect(circuit.isOpen()).to.be.false;

            circuit.run(success);
            expect(success.calledOnce).to.be.true;

            setTimeout(function() {
                expect(onopen.calledOnce).to.be.true;
                expect(circuit.isOpen()).to.be.true;
                done();
            }, 300);
        });

        it("should run the fallback timeout (by the circuit breaker timer)", function (done) {
            circuit.run(deferred, fallback, 50);
            circuit.run(deferred, fallback, 50);
            expect(deferred.calledTwice).to.be.true;
            expect(fallback.calledOnce).to.be.false;
            expect(circuit.calculate().total).to.equal(0);
            expect(circuit.calculate().error).to.equal(0);
            expect(circuit.calculate().percent).to.equal(0);
            setTimeout(function() {
                circuit.run(deferred, fallback, 50);
                expect(fallback.calledOnce).to.be.true;
                expect(circuit.run(success, 50)).to.be.false;
                expect(circuit.calculate().total).to.equal(2);
                expect(circuit.calculate().error).to.equal(2);
                expect(circuit.calculate().percent).to.equal(100);
                done();
            }, 50);
        });

        afterEach(function() {
            // restore the environment as it was before
            sandbox.restore();
            circuit = void 0;
        });
    });
});
