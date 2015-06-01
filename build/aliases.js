module.exports = function (grunt, options) {

    var tasks = ['node_version', 'jshint', 'uglify'];

    // computation...
    return {
        'tasks': ['availabletasks'],
        'default': tasks
    };
};
