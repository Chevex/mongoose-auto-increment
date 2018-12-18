const util = require('util');
const mongoose = require('mongoose');
const autoIncrement = require('..');

beforeAll((done) => {
  // eslint-disable-next-line no-console
  mongoose.connection.on('error', done);
  mongoose.connection.on('open', () => {
    autoIncrement.initialize(mongoose.connection);
    done();
  });
  mongoose.connect('mongodb://127.0.0.1/mongoose-auto-increment-test', { useCreateIndex: true, useNewUrlParser: true });
});

afterAll(async () => {
  await mongoose.connection.db.dropDatabase();
  await mongoose.disconnect();
});

describe('mongoose-auto-increment plugin', () => {
  describe('when not given a field', () => {
    let user1;
    let user2;

    beforeEach(async () => {
      const userSchema = new mongoose.Schema({
        name: String,
        dept: String,
      });
      userSchema.plugin(autoIncrement.plugin, 'UserNoField');
      const User = mongoose.model('UserNoField', userSchema);

      user1 = await new User({ name: 'Charlie', dept: 'Support' }).save();
      user2 = await new User({ name: 'Charlene', dept: 'Marketing' }).save();
    });

    it('should increment the _id field on save', () => {
      expect(user1._id).toBe(0);
      expect(user2._id).toBe(1);
    });
  });

  describe('when given a field', () => {
    let user1;
    let user2;

    beforeEach(async () => {
      const userSchema = new mongoose.Schema({
        name: String,
        dept: String,
      });
      userSchema.plugin(autoIncrement.plugin, { model: 'UserWithField', field: 'userId' });
      const User = mongoose.model('UserWithField', userSchema);

      user1 = await new User({ name: 'Charlie', dept: 'Support' }).save();
      user2 = await new User({ name: 'Charlene', dept: 'Marketing' }).save();
    });

    it('increments the specified field instead of default', () => {
      expect(user1.userId).toBe(0);
      expect(user2.userId).toBe(1);
    });
  });

  describe('when given a value to start the sequence from', () => {
    let user1;
    let user2;

    beforeEach(async () => {
      const userSchema = new mongoose.Schema({
        name: String,
        dept: String,
      });
      userSchema.plugin(autoIncrement.plugin, { model: 'UserWithStartsAt', startAt: 3 });
      const User = mongoose.model('UserWithStartsAt', userSchema);

      user1 = await new User({ name: 'Charlie', dept: 'Support' }).save();
      user2 = await new User({ name: 'Charlene', dept: 'Marketing' }).save();
    });

    it('starts incrementing from the given start value', () => {
      expect(user1._id).toBe(3);
      expect(user2._id).toBe(4);
    });
  });

  describe('when given value to increment by', () => {
    let user1;
    let user2;

    beforeEach(async () => {
      const userSchema = new mongoose.Schema({
        name: String,
        dept: String,
      });
      userSchema.plugin(autoIncrement.plugin, { model: 'UserIncrementBy', incrementBy: 5 });
      const User = mongoose.model('UserIncrementBy', userSchema);

      user1 = await new User({ name: 'Charlie', dept: 'Support' }).save();
      user2 = await new User({ name: 'Charlene', dept: 'Marketing' }).save();
    });

    it('increments with the given value instead of default', () => {
      expect(user1._id).toBe(0);
      expect(user2._id).toBe(5);
    });
  });

  describe('when given maxExplicitValue', () => {
    let user1;
    let user2;
    let user3;

    beforeAll(async () => {
      const userSchema = new mongoose.Schema({
        name: String,
        dept: String,
      });
      userSchema.plugin(autoIncrement.plugin, { model: 'UserMaxExplicitValue', maxExplicitValue: 1000000 });
      const User = mongoose.model('UserMaxExplicitValue', userSchema);

      user1 = await new User({ name: 'Charlie', dept: 'Support', _id: 10 }).save();
      user2 = await new User({ name: 'Charlene', dept: 'Marketing', _id: 1000001 }).save();
      user3 = await new User({ name: 'Jack', dept: 'Marketing' }).save();
    });

    it('uses explicit value if given', () => {
      expect(user1._id).toBe(10);
    });

    it('uses the given explicit value if it exceeds maxExplicitValue', () => {
      expect(user2._id).toBe(1000001);
    });

    it('giving a value that exceeds maxExplicitValue does not alter counter value', () => {
      expect(user3._id).toBe(11);
    });
  });

  describe('when unique is set to false in options', () => {
    let indices;
    let userSchema;

    beforeAll(async () => {
      userSchema = new mongoose.Schema({
        name: String,
        dept: String,
      });
      userSchema.plugin(autoIncrement.plugin, { model: 'UserNonUnique', field: 'nonUniqueId', unique: false });
      const User = mongoose.model('UserNonUnique', userSchema);

      await new User({ name: 'Charlie', dept: 'Support', nonUniqueId: 10 }).save();
      indices = await User.collection.getIndexes();
    });

    it('unique setting is passed to mongoose schema', () => {
      expect(userSchema.path('nonUniqueId').options.unique).toBe(undefined);
    });

    it('the counter field does not have an index', () => {
      expect(Object.keys(indices)).toEqual(expect.arrayContaining(['_id_']));
    });
  });

  describe('nextCount()', () => {
    let user1;
    let user2;
    let count1;
    let count2;
    let count3;

    beforeAll(async () => {
      const userSchema = new mongoose.Schema({
        name: String,
        dept: String,
      });
      userSchema.plugin(autoIncrement.plugin, 'UserNextCount');
      const User = mongoose.model('UserNextCount', userSchema);

      user1 = await new User({ name: 'Charlie', dept: 'Support' });
      count1 = await util.promisify(user1.nextCount)();
      user1 = await user1.save();
      count2 = await util.promisify(user1.nextCount)();
      user2 = await new User({ name: 'Charlene', dept: 'Marketing' }).save();
      count3 = await util.promisify(user2.nextCount)();
    });

    it('returns initial counter value before the counter is used', async () => {
      expect(count1).toBe(0);
    });

    it('the value returned by nextCount() assigned to the next entity that is saved', () => {
      expect(user1._id).toBe(0);
    });

    it('the next counter value is incremented', () => {
      expect(count2).toBe(1);
    });

    it('the value returned by nextCount() is used again when another entity is saved', () => {
      expect(user2._id).toBe(1);
    });

    it('the next counter value is incremented again', () => {
      expect(count3).toBe(2);
    });
  });

  describe('resetCount()', () => {
    let user1;
    let count1;
    let count2;
    let reset;

    beforeAll(async () => {
      const userSchema = new mongoose.Schema({
        name: String,
        dept: String,
      });
      userSchema.plugin(autoIncrement.plugin, 'UserResetCount');
      const User = mongoose.model('UserResetCount', userSchema);

      user1 = await new User({ name: 'Charlie', dept: 'Support' }).save();
      count1 = await util.promisify(user1.nextCount)();
      reset = await util.promisify(user1.resetCount)();
      count2 = await util.promisify(user1.nextCount)();
    });

    it('next counter value is incremented properly after saving', () => {
      expect(count1).toBe(1);
    });

    it('calling resetCount sets the counter back to it\'s initial value', () => {
      expect(reset).toBe(0);
    });

    it('after reseting the next count would be the initial value', () => {
      expect(count2).toBe(0);
    });
  });
});
