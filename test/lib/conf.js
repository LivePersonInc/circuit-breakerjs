define("conf", function() {
    return {
        "blanket": true,
        "blanketCoverOnly": "['../../src/']",
        "blanketCoverNever": "['../lib/','../../src/../node_modules/','//^\w+test\.js$/gi']",
        "gruntReporterLocation": "../../node_modules/grunt-lp-blanket-mocha/support/grunt-reporter.js",
        "requireConfig": {
            //By default load any module IDs from src directory
            baseUrl: "../../src",
            paths: { //Configure paths if needed
                chai: "../node_modules/chai/chai",
                sinon: "../node_modules/sinon/pkg/sinon",
            }
        },
        "chaiLib": "expect",
        "mochaInterface": "bdd",
        "mochaTimeout": 60000,
        "tests": [
            //Add your test cases here
            "../js/sanity_test.js"
        ]
    }
});
