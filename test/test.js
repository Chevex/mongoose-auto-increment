var async = require('async'),
    should = require('chai').should(),
    mongoose = require('mongoose'),
    autoIncrement = require('..'),
    conn;

before(function (done) {
    conn = mongoose.createConnection('mongodb://127.0.0.1/mongoose-auto-increment-test');
    conn.on('error', console.error.bind(console));
    conn.once('open', function () {
        autoIncrement.initialize(conn);
        done();
    });
});

after(function (done) {
    conn.db.executeDbCommand({ dropDatabase: 1 }, function () {
        conn.close(done);
    });
});

afterEach(function (done) {
    conn.model('User').collection.drop(function () {
        delete conn.models.User;
        return conn.model('IdentityCounter').collection.drop(done);
    });
});

describe('mongoose-auto-increment', function () {

    it('should increment the _id field on save', function (done) {

        // Arrange
        var userSchema = new mongoose.Schema({
            name: String,
            dept: String
        });
        userSchema.plugin(autoIncrement.plugin, 'User');
        var User = conn.model('User', userSchema),
            user1 = new User({ name: 'Charlie', dept: 'Support' }),
            user2 = new User({ name: 'Charlene', dept: 'Marketing' });

        // Act
        async.series({
            user1: function (cb) {
                user1.save(cb);
            },
            user2: function (cb) {
                user2.save(cb);
            }
        }, assert);

        // Assert
        function assert(err, results) {
            should.not.exist(err);
            results.user1[0].should.have.property('_id', 0);
            results.user2[0].should.have.property('_id', 1);
            done();
        }

    });

    it('should increment the specified field instead (Test 2)', function(done) {

        // Arrange
        var userSchema = new mongoose.Schema({
            name: String,
            dept: String
        });
        userSchema.plugin(autoIncrement.plugin, { model: 'User', field: 'userId' });
        var User = conn.model('User', userSchema),
            user1 = new User({ name: 'Charlie', dept: 'Support' }),
            user2 = new User({ name: 'Charlene', dept: 'Marketing' });

        // Act
        async.series({
            user1: function (cb) {
                user1.save(cb);
            },
            user2: function (cb) {
                user2.save(cb);
            }
        }, assert);

        // Assert
        function assert(err, results) {
            should.not.exist(err);
            results.user1[0].should.have.property('userId', 0);
            results.user2[0].should.have.property('userId', 1);
            done();
        }

    });


    it('should start counting at specified number (Test 3)', function (done) {

        // Arrange
        var userSchema = new mongoose.Schema({
            name: String,
            dept: String
        });
        userSchema.plugin(autoIncrement.plugin, { model: 'User', startAt: 3 });
        var User = conn.model('User', userSchema),
            user1 = new User({ name: 'Charlie', dept: 'Support' }),
            user2 = new User({ name: 'Charlene', dept: 'Marketing' });

        // Act
        async.series({
            user1: function (cb) {
                user1.save(cb);
            },
            user2: function (cb) {
                user2.save(cb);
            }
        }, assert);

        // Assert
        function assert(err, results) {
            should.not.exist(err);
            results.user1[0].should.have.property('_id', 3);
            results.user2[0].should.have.property('_id', 4);
            done();
        }

    });

    it('should increment by the specified amount (Test 4)', function (done) {

        // Arrange
        var userSchema = new mongoose.Schema({
            name: String,
            dept: String
        });
        userSchema.plugin(autoIncrement.plugin, { model: 'User', incrementBy: 5 });
        var User = conn.model('User', userSchema),
            user1 = new User({ name: 'Charlie', dept: 'Support' }),
            user2 = new User({ name: 'Charlene', dept: 'Marketing' });

        // Act
        async.series({
            user1: function (cb) {
                user1.save(cb);
            },
            user2: function (cb) {
                user2.save(cb);
            }
        }, assert);


        // Assert
        function assert(err, results) {
            should.not.exist(err);
            results.user1[0].should.have.property('_id', 0);
            results.user2[0].should.have.property('_id', 5);
            done();
        }

    });

    it('should increment individual per filter field (Test 6)', function (done) {

        // Arrange
        var userSchema = new mongoose.Schema({
            name: String,
            dept: String
        });
        userSchema.plugin(autoIncrement.plugin, { model: 'User', filter: 'dept', field: 'userId'});
        var User = conn.model('User', userSchema),
            user1 = new User({ name: 'Charlie', dept: 'Support'}),
            user2 = new User({ name: 'Charlene', dept: 'Marketing' }),
            user3 = new User({ name: 'Charlito', dept: 'Marketing' });

        // Act
        async.series({
            user1: function (cb) {
                user1.save(cb);
            },
            user2: function (cb) {
                user2.save(cb);
            },
            user3: function (cb) {
                user3.save(cb);
            }
        }, assert);

        // Assert
        function assert(err, results) {
            should.not.exist(err);
            results.user1[0].should.have.property('userId', 0);
            results.user2[0].should.have.property('userId', 0);
            results.user3[0].should.have.property('userId', 1);
            done();
        }
    });

    describe('helper function', function () {

        it('nextCount should return the next count for the model and field (Test 5)', function (done) {

            // Arrange
            var userSchema = new mongoose.Schema({
                name: String,
                dept: String
            });
            userSchema.plugin(autoIncrement.plugin, 'User');
            var User = conn.model('User', userSchema),
                user1 = new User({ name: 'Charlie', dept: 'Support' }),
                user2 = new User({ name: 'Charlene', dept: 'Marketing' });

            // Act
            async.series({
                count1: function (cb) {
                    user1.nextCount(cb);
                },
                user1: function (cb) {
                    user1.save(cb);
                },
                count2: function (cb) {
                    user1.nextCount(cb);
                },
                user2: function (cb) {
                    user2.save(cb);
                },
                count3: function (cb) {
                    user2.nextCount(cb);
                }
            }, assert);

            // Assert
            function assert(err, results) {
                should.not.exist(err);
                results.count1.should.equal(0);
                results.user1[0].should.have.property('_id', 0);
                results.count2.should.equal(1);
                results.user2[0].should.have.property('_id', 1);
                results.count3.should.equal(2);
                done();
            }

        });

        it('resetCount should cause the count to reset as if there were no documents yet.', function (done) {

            // Arrange
            var userSchema = new mongoose.Schema({
                name: String,
                dept: String
            });
            userSchema.plugin(autoIncrement.plugin, 'User');
            var User = conn.model('User', userSchema),
                user = new User({name: 'Charlie', dept: 'Support'});

            // Act
            async.series({
                user: function (cb) {
                    user.save(cb);
                },
                count1: function (cb) {
                    user.nextCount(cb);
                },
                reset: function (cb) {
                    user.resetCount(cb);
                },
                count2: function (cb) {
                    user.nextCount(cb);
                }
            }, assert);

            // Assert
            function assert(err, results) {
                should.not.exist(err);
                results.user[0].should.have.property('_id', 0);
                results.count1.should.equal(1);
                results.reset.should.equal(0);
                results.count2.should.equal(0);
                done();
            }

        });

        it('resetCount should work for filters increment', function (done) {

            // Arrange
            var userSchema = new mongoose.Schema({
                name: String,
                dept: String
            });
            userSchema.plugin(autoIncrement.plugin, {model: 'User', filter: 'dept', field: 'userId'});
            var User = conn.model('User', userSchema),
                user1 = new User({ name: 'Charlie', dept: 'Support'}),
                user2 = new User({ name: 'Charlene', dept: 'Marketing' }),
                user3 = new User({ name: 'Charlito', dept: 'Marketing' });

            // Act
            async.series({
                user1: function (cb) {
                    user1.save(cb);
                },
                user2: function (cb) {
                    user2.save(cb);
                },
                reset: function (cb) {
                    User.resetCount(cb);
                },
                user3: function (cb) {
                    user3.save(cb);
                }
            }, assert);

            // Assert
            function assert(err, results) {
                should.not.exist(err);
                results.user1[0].should.have.property('userId', 0);
                results.user2[0].should.have.property('userId', 0);
                results.reset.should.equal(0);
                results.user3[0].should.have.property('userId', 0);
                done();
            }

        });
    });

    describe('helper functions per counter', function (){
        it('recount should refresh counter field based on previous values', function (done) {
            // Arrange
            var userSchema = new mongoose.Schema({
                userId: Number,
                name: String,
                dept: String
            });

            userSchema.plugin(autoIncrement.plugin, {model: 'User', field: 'userId'});
            var User = conn.model('User', userSchema),
                user1 = new User({ name: 'Charlie', dept: 'Support', userId: 10}),
                user2 = new User({ name: 'Charlene', dept: 'Marketing', userId: 5 });

            // Act
            async.series({
                user1: function (cb) {
                    user1.save(cb);
                },
                user2: function (cb) {
                    user2.save(cb);
                },
                recount: function (cb) {
                    User.recount('userId', cb);
                },
                user1AfterRecount: function (cb) {
                    User.findById(user1._id, cb);
                },
                user2AfterRecount: function (cb) {
                    User.findById(user2._id, cb);
                }
            }, assert);

            // Assert
            function assert(err, results) {
                should.not.exist(err);
                results.user1[0].should.have.property('userId', 10);
                results.user2[0].should.have.property('userId', 5);
                results.user1AfterRecount.should.have.property('userId', 1);
                results.user2AfterRecount.should.have.property('userId', 0);
                done();
            }
        });

        it('helper functions should right work with more then 1 counter field', function (done) {
            // Arrange
            var userSchema = new mongoose.Schema({
                userId: Number,
                userIdDept: Number,
                name: String,
                dept: String
            });

            userSchema.plugin(autoIncrement.plugin, {model: 'User', field: 'userId'});
            userSchema.plugin(autoIncrement.plugin, {model: 'User', field: 'userIdDept', filter: 'dept', startAt: 1});
            var User = conn.model('User', userSchema),
                user1 = new User({ name: 'Charlie', dept: 'Support', userId: 10, userIdDept: 5}),
                user2 = new User({ name: 'Charlene', dept: 'Marketing', userId: 5, userIdDept: 10 });

            // Act
            async.series({
                user1: function (cb) {
                    user1.save(cb);
                },
                user2: function (cb) {
                    user2.save(cb);
                },
                recount: function (cb) {
                    User.recount('userId', cb);
                },
                recount2: function (cb) {
                    User.recount('userIdDept', cb);
                },
                user1AfterRecount: function (cb) {
                    User.findById(user1._id, cb);
                },
                user2AfterRecount: function (cb) {
                    User.findById(user2._id, cb);
                },
                userIdNextCount: function (cb) {
                    User.nextCount('userId', cb);
                },
                userIdDeptNextCount: function (cb) {
                    User.nextCount('userIdDept', 'Support', cb);
                }
            }, assert);

            // Assert
            function assert(err, results) {
                should.not.exist(err);
                results.user1[0].should.have.property('userId', 10);
                results.user2[0].should.have.property('userId', 5);
                results.user1[0].should.have.property('userIdDept', 5);
                results.user2[0].should.have.property('userIdDept', 10);

                results.user1AfterRecount.should.have.property('userId', 1);
                results.user2AfterRecount.should.have.property('userId', 0);
                results.user1AfterRecount.should.have.property('userIdDept', 1);
                results.user2AfterRecount.should.have.property('userIdDept', 1);

                results.userIdNextCount.should.equal(2);
                results.userIdDeptNextCount.should.equal(2);
                done();
            }
        });
    });
});
