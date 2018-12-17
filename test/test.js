const async = require('async');
const mongoose = require('mongoose');
const autoIncrement = require('..');

let connection;

beforeAll((done) => {
  connection = mongoose.createConnection('mongodb://127.0.0.1/mongoose-auto-increment-test');
  // eslint-disable-next-line no-console
  connection.on('error', console.error.bind(console));
  connection.once('open', () => {
    autoIncrement.initialize(connection);
    done();
  });
});

afterAll((done) => {
  connection.db.dropDatabase((err) => {
    if (err) return done(err);
    return connection.close(done);
  });
});

afterEach((done) => {
  connection.model('User').collection.drop(() => {
    delete connection.models.User;
    connection.model('IdentityCounter').collection.drop(done);
  });
});

describe('mongoose-auto-increment', () => {
  it('should increment the _id field on save', (done) => {
    // Arrange
    const userSchema = new mongoose.Schema({
      name: String,
      dept: String,
    });
    userSchema.plugin(autoIncrement.plugin, 'User');
    const User = connection.model('User', userSchema);


    const user1 = new User({ name: 'Charlie', dept: 'Support' });


    const user2 = new User({ name: 'Charlene', dept: 'Marketing' });


    // Assert
    function assert(err, results) {
      expect(err).toBe(null);
      expect(results.user1[0]).toMatchObject({
        _id: 0,
      });
      expect(results.user2[0]).toMatchObject({
        _id: 1,
      });
      done();
    }

    async.series({
      user1(cb) {
        user1.save(cb);
      },
      user2(cb) {
        user2.save(cb);
      },
    }, assert);
  });

  it('should increment the specified field instead (Test 2)', (done) => {
    // Arrange
    const userSchema = new mongoose.Schema({
      name: String,
      dept: String,
    });
    userSchema.plugin(autoIncrement.plugin, { model: 'User', field: 'userId' });
    const User = connection.model('User', userSchema);


    const user1 = new User({ name: 'Charlie', dept: 'Support' });


    const user2 = new User({ name: 'Charlene', dept: 'Marketing' });

    function assert(err, results) {
      expect(err).toBe(null);
      expect(results.user1[0]).toMatchObject({
        userId: 0,
      });
      expect(results.user2[0]).toMatchObject({
        userId: 1,
      });
      done();
    }

    async.series({
      user1(cb) {
        user1.save(cb);
      },
      user2(cb) {
        user2.save(cb);
      },
    }, assert);
  });


  it('should start counting at specified number (Test 3)', (done) => {
    // Arrange
    const userSchema = new mongoose.Schema({
      name: String,
      dept: String,
    });
    userSchema.plugin(autoIncrement.plugin, { model: 'User', startAt: 3 });
    const User = connection.model('User', userSchema);

    const user1 = new User({ name: 'Charlie', dept: 'Support' });
    const user2 = new User({ name: 'Charlene', dept: 'Marketing' });

    // Assert
    function assert(err, results) {
      expect(err).toBe(null);
      expect(results.user1[0]).toMatchObject({
        _id: 3,
      });
      expect(results.user2[0]).toMatchObject({
        _id: 4,
      });
      done();
    }

    // Act
    async.series({
      user1(cb) {
        user1.save(cb);
      },
      user2(cb) {
        user2.save(cb);
      },
    }, assert);
  });

  it('should increment by the specified amount (Test 4)', (done) => {
    // Arrange
    const userSchema = new mongoose.Schema({
      name: String,
      dept: String,
    });

    expect(() => userSchema.plugin(autoIncrement.plugin)).toThrowError(Error);

    userSchema.plugin(autoIncrement.plugin, { model: 'User', incrementBy: 5 });
    const User = connection.model('User', userSchema);


    const user1 = new User({ name: 'Charlie', dept: 'Support' });


    const user2 = new User({ name: 'Charlene', dept: 'Marketing' });


    function assert(err, results) {
      expect(err).toBe(null);
      expect(results.user1[0]).toMatchObject({
        _id: 0,
      });
      expect(results.user2[0]).toMatchObject({
        _id: 5,
      });
      done();
    }

    async.series({
      user1(cb) {
        user1.save(cb);
      },
      user2(cb) {
        user2.save(cb);
      },
    }, assert);
  });

  it('should not increment if the value is present in the document and would exceed maxExplicitValue', (done) => {
    // Arrange
    const userSchema = new mongoose.Schema({
      name: String,
      dept: String,
    });

    expect(() => userSchema.plugin(autoIncrement.plugin)).toThrowError(Error);

    userSchema.plugin(autoIncrement.plugin, { model: 'User', maxExplicitValue: 1000000 });
    const User = connection.model('User', userSchema);


    const user1 = new User({ name: 'Charlie', dept: 'Support', _id: 10 });


    const user2 = new User({ name: 'Charlene', dept: 'Marketing', _id: 1000001 });


    const user3 = new User({ name: 'Jack', dept: 'Marketing' });

    function assert(err, results) {
      expect(err).toBe(null);
      expect(results.user1[0]).toMatchObject({
        _id: 10,
      });
      expect(results.user2[0]).toMatchObject({
        _id: 1000001,
      });
      expect(results.user3[0]).toMatchObject({
        _id: 11,
      });
      done();
    }

    async.series({
      user1(cb) {
        user1.save(cb);
      },
      user2(cb) {
        user2.save(cb);
      },
      user3(cb) {
        user3.save(cb);
      },
    }, assert);
  });

  it('should not add a unique index if unique=false in options', () => {
    // Arrange
    const userSchema = new mongoose.Schema({
      name: String,
      dept: String,
    });
    userSchema.plugin(autoIncrement.plugin, { model: 'User', field: 'userId', unique: false });
    const User = connection.model('User', userSchema);

    // Assert
    expect(userSchema.path('userId').options.unique).toBe(undefined);

    return new User({ name: 'Charlie', dept: 'Support', userId: 10 }).save()
      .then(() => User.collection.getIndexes())
      .then((indexes) => {
        expect(Object.keys(indexes)).toEqual(expect.arrayContaining(['_id_']));
      });
  });

  describe('helper function', () => {
    it('nextCount should return the next count for the model and field (Test 5)', (done) => {
      // Arrange
      const userSchema = new mongoose.Schema({
        name: String,
        dept: String,
      });
      userSchema.plugin(autoIncrement.plugin, 'User');
      const User = connection.model('User', userSchema);


      const user1 = new User({ name: 'Charlie', dept: 'Support' });


      const user2 = new User({ name: 'Charlene', dept: 'Marketing' });
      function assert(err, results) {
        expect(err).toBe(null);
        expect(results.count1).toBe(0);
        expect(results.count2).toBe(1);
        expect(results.count3).toBe(2);
        expect(results.user1[0]).toMatchObject({
          _id: 0,
        });
        expect(results.user2[0]).toMatchObject({
          _id: 1,
        });
        done();
      }

      async.series({
        count1(cb) {
          user1.nextCount(cb);
        },
        user1(cb) {
          user1.save(cb);
        },
        count2(cb) {
          user1.nextCount(cb);
        },
        user2(cb) {
          user2.save(cb);
        },
        count3(cb) {
          user2.nextCount(cb);
        },
      }, assert);
    });

    it('resetCount should cause the count to reset as if there were no documents yet.', (done) => {
      // Arrange
      const userSchema = new mongoose.Schema({
        name: String,
        dept: String,
      });
      userSchema.plugin(autoIncrement.plugin, 'User');
      const User = connection.model('User', userSchema);


      const user = new User({ name: 'Charlie', dept: 'Support' });

      function assert(err, results) {
        expect(err).toBe(null);
        expect(results.user1[0]).toMatchObject({
          _id: 0,
        });
        expect(results.count1).toBe(1);
        expect(results.reset).toBe(0);
        expect(results.count2).toBe(0);
        done();
      }

      async.series({
        user(cb) {
          user.save(cb);
        },
        count1(cb) {
          user.nextCount(cb);
        },
        reset(cb) {
          user.resetCount(cb);
        },
        count2(cb) {
          user.nextCount(cb);
        },
      }, assert);
    });
  });
});
