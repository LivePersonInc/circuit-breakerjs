module.exports = function (grunt, options) {

    var tasks = ['node_version', 'jshint', 'env', 'instrument', 'mochaTest', 'storeCoverage', 'makeReport', 'uglify'];

    // computation...
    return {
        'tasks': ['availabletasks'],
        'default': tasks,
        'test': [
            'node_version',
            'mochaTest'
        ]
    };
};
