// Module Scope
var mongoose = require('mongoose'),
    extend = require('extend'),
    async = require('async'),
    counterSchema,
    IdentityCounter;

var mongooseConnection;

// Initialize plugin by creating counter collection in database.
exports.initialize = function (connection) {
    mongooseConnection = connection;
    try {
        IdentityCounter = connection.model('IdentityCounter');
    } catch (ex) {
        if (ex.name === 'MissingSchemaError') {
            // Create new counter schema.
            counterSchema = new mongoose.Schema({
                model: { type: String, require: true },
                field: { type: String, require: true },
                count: { type: Number, default: 0 },
                filter: { type: mongoose.Schema.Types.Mixed }
            });

            // Create a unique index using the "field" and "model" and "filter" fields.
            counterSchema.index({ field: 1, model: 1, filter: 1 }, { unique: true, required: true, index: -1 });

            // Create model using new schema.
            IdentityCounter = connection.model('IdentityCounter', counterSchema);
        }
        else
            throw ex;
    }
};

// The function to use when invoking the plugin on a custom schema.
exports.plugin = function (schema, options) {

    // If we don't have reference to the counterSchema or the IdentityCounter model then the plugin was most likely not
    // initialized properly so throw an error.
    if (!counterSchema || !IdentityCounter) throw new Error("mongoose-auto-increment has not been initialized");

    // Default settings and plugin scope variables.
    var settings = {
            model: null, // The model to configure the plugin for.
            field: '_id', // The field the plugin should track.
            startAt: 0, // The number the count should start at.
            incrementBy: 1, // The number by which to increment the count each time.
            filter: null // The field the plugin should filter by
        },
        fields = {}, // A hash of fields to add properties to in Mongoose.
        ready = false; // True if the counter collection has been updated and the document is ready to be saved.

    switch (typeof(options)) {
        // If string, the user chose to pass in just the model name.
        case 'string':
            settings.model = options;
            break;
        // If object, the user passed in a hash of options.
        case 'object':
            extend(settings, options);
            break;
    }

    if (settings.filter && settings.field == '_id') {
        throw new Error("mongoose-auto-increment cannot individually increment default field _id");
    }

    // Add properties for field in schema.
    fields[settings.field] = {
        type: Number,
        unique: !settings.filter,
        require: true
    };

    schema.add(fields);

    // Find the counter for this model and the relevant field.
    IdentityCounter.findOne(
        { model: settings.model, field: settings.field },
        function (err, counter) {
            if (!counter) {
                // If no counter exists then create one and save it.
                counter = new IdentityCounter({ model: settings.model, field: settings.field, count: settings.startAt - settings.incrementBy });
                counter.save(function () {
                    ready = true;
                });
            }
            else
                ready = true;
        }
    );

    // Declare a function to get the next counter for the model/schema.
    var nextCount = function (field, filter, callback) {
        var search = {
            model: settings.model,
            field: settings.field
        };

        if (typeof(field) == 'function') {
            callback = field;
        } else {
            search.field = field;
            if (typeof(filter) == 'function') {
                callback = filter;
            } else {
                search.filter = filter;
            }
        }

        IdentityCounter.findOne(search, function (err, counter) {
            if (err) return callback(err);
            callback(null, counter === null ? settings.startAt : counter.count + settings.incrementBy);
        });
    };
    // Add nextCount as both a method on documents and a static on the schema for convenience.
    schema.method('nextCount', nextCount);
    schema.static('nextCount', nextCount);

    // Declare a function to reset counter at the start value - increment value.
    var resetCount = function (field, callback) {
        if (typeof(field) == 'function') {
            callback = field;
            field = settings.field;
        }

        IdentityCounter.update(
            { model: settings.model, field: field },
            { count: settings.startAt - settings.incrementBy },
            { multi: true },
            function (err) {
                if (err) return callback(err);
                callback(null, settings.startAt);
            }
        );
    };
    // Add resetCount as both a method on documents and a static on the schema for convenience.
    schema.method('resetCount', resetCount);
    schema.static('resetCount', resetCount);

    // Declare function to recount counter field from start value
    var recount = function(field, callback) {
        if (settings.field == field) {
            resetCount(field, function() {
                var sort = {};
                sort[field] = 'asc';
                mongooseConnection.model(settings.model).find({}).sort(sort).exec(function(err, docs) {
                    if (err) callback(err);
                    async.mapSeries(docs, function(doc, cb) {
                        doc[field] = undefined;
                        doc.save(cb);
                    }, callback);
                });
            });
        } else
            callback();
    };

    // detect case 2 counter field in 1 model
    var recountFn = schema.statics['recount'];
    if (recountFn) {
        schema.static('recount', function (field, done) {
            recountFn(field, function (err) {
                if (err) return done(err);
                recount(field, done)
            })
        });
    } else {
        schema.static('recount', recount);
    }

    // Every time documents in this schema are saved, run this logic.
    schema.pre('save', function (next) {
        // Get reference to the document being saved.
        var doc = this;

        // If the document already has the field we're interested in and that field is a number then run this logic
        // to give the document a number ID that is incremented by the amount specified in relation to whatever the
        // last generated document ID was.
        if (typeof(doc[settings.field]) !== 'number') {
            // Declare self-invoking save function.

            (function save() {
                // If ready, run increment logic.
                // Note: ready is true when an existing counter collection is found or after it is created for the
                // first time.
                if (ready) {
                    // IdentityCounter documents are identified by the model and field that the plugin was invoked for.
                    var search = { model: settings.model, field: settings.field };
                    if (settings.filter)
                        search.filter = doc[settings.filter];

                    // Find the counter collection entry for this model and field and update it.
                    IdentityCounter.findOneAndUpdate(
                        search,
                        // Increment the count by `incrementBy`.
                        { $inc: { count: settings.incrementBy } },
                        // new:true specifies that the callback should get the counter AFTER it is updated (incremented).
                        { new: true },
                        // Receive the updated counter.
                        function (err, updatedIdentityCounter) {
                            if (err) return next(err);
                            if (!updatedIdentityCounter) {
                                var counter = new IdentityCounter({ model: settings.model, field: settings.field, filter: search.filter, count: settings.startAt - settings.incrementBy });
                                counter.save(function () {
                                    setTimeout(save, 5);
                                });
                                return;
                            }
                            // If there are no errors then go ahead and set the document's field to the current count.
                            doc[settings.field] = updatedIdentityCounter.count;
                            // Continue with default document save functionality.
                            next();
                        }
                    );
                }
                // If not ready then set a 5 millisecond timer and try to save again. It will keep doing this until
                // the counter collection is ready.
                else
                    setTimeout(save, 5);
            })();
        }
        // If the document does not have the field we're interested in or that field isn't a number AND the user did
        // not specify that we should increment on updates, then just continue the save without any increment logic.
        else
            next();
    });
};
