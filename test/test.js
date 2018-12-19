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

afterEach(async () => {
  await mongoose.connection.db.dropDatabase();
  delete mongoose.connection.models.User;
});

afterAll(async () => {
  await mongoose.disconnect();
});

describe('mongoose-auto-increment plugin', () => {
  const getModel = (model, options) => {
    const userSchema = new mongoose.Schema({
      name: String,
      dept: String,
    });
    userSchema.plugin(autoIncrement.plugin, options);
    return mongoose.model(model, userSchema);
  };

  describe('when not given a field', () => {
    let user1;
    let user2;

    beforeEach(async () => {
      const User = getModel('User', 'User');
      user1 = await new User({ name: 'Charlie', dept: 'Support' }).save();
      user2 = await new User({ name: 'Charlene', dept: 'Marketing' }).save();
    });

    it('should set first user _id field on save', () => {
      expect(user1._id).toBe(0);
    });

    it('should increment the _id for the second user', () => {
      expect(user2._id).toBe(1);
    });
  });

  describe('when counter field also exists in schema', () => {
    let user1;
    let user2;

    beforeEach(async () => {
      const userSchema = new mongoose.Schema({
        name: String,
        dept: String,
        userId: Number,
      });
      userSchema.plugin(autoIncrement.plugin, { model: 'User', field: 'userId' });
      const User = mongoose.model('User', userSchema);
      user1 = await new User({ name: 'Charlie', dept: 'Support' }).save();
      user2 = await new User({ name: 'Charlie', dept: 'Support' }).save();
    });

    it('should set first user userId field on save', () => {
      expect(user1.userId).toBe(0);
    });

    it('should set first user userId field on save', () => {
      expect(user2.userId).toBe(1);
    });
  });

  describe('when given a field', () => {
    let user1;
    let user2;

    beforeEach(async () => {
      const User = getModel('User', { model: 'User', field: 'userId' });
      user1 = await new User({ name: 'Charlie', dept: 'Support' }).save();
      user2 = await new User({ name: 'Charlene', dept: 'Marketing' }).save();
    });

    it('should set specified field instead of default for first user', () => {
      expect(user1.userId).toBe(0);
    });

    it('should the specified field for the second user', () => {
      expect(user2.userId).toBe(1);
    });
  });

  describe('when given a value to start the sequence from', () => {
    let user1;
    let user2;

    beforeEach(async () => {
      const User = getModel('User', { model: 'User', startAt: 3 });
      user1 = await new User({ name: 'Charlie', dept: 'Support' }).save();
      user2 = await new User({ name: 'Charlene', dept: 'Marketing' }).save();
    });

    it('uses the startAt value for the first user', () => {
      expect(user1._id).toBe(3);
    });

    it('uses the incremented startAt value for the second user', () => {
      expect(user2._id).toBe(4);
    });
  });

  describe('when given value to increment by', () => {
    let user1;
    let user2;

    beforeEach(async () => {
      const User = getModel('User', { model: 'User', incrementBy: 5 });
      user1 = await new User({ name: 'Charlie', dept: 'Support' }).save();
      user2 = await new User({ name: 'Charlene', dept: 'Marketing' }).save();
    });

    it('uses the default value for the first user', () => {
      expect(user1._id).toBe(0);
    });

    it('uses the incrementBy to set the value for the second value', () => {
      expect(user2._id).toBe(5);
    });
  });

  describe('when given maxExplicitValue', () => {
    let user1;
    let user2;
    let user3;

    beforeEach(async () => {
      const User = getModel('User', { model: 'User', maxExplicitValue: 1000000 });
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

  describe('when unique setting is not passed in', () => {
    let User;

    beforeAll(async () => {
      User = getModel('User', { model: 'User', field: 'userId' });
      await new User({ name: 'Charlie', dept: 'Support', nonUniqueId: 10 }).save();
    });

    it('unique setting is passed to mongoose schema', () => {
      expect(User.schema.path('userId').options.unique).toBe(true);
    });
  });

  describe('when unique is set to false in options', () => {
    let indices;
    let User;

    beforeAll(async () => {
      User = getModel('User', { model: 'User', field: 'nonUniqueId', unique: false });
      await new User({ name: 'Charlie', dept: 'Support', nonUniqueId: 10 }).save();
      indices = await User.collection.getIndexes();
    });

    it('unique setting is passed to mongoose schema', () => {
      expect(User.schema.path('nonUniqueId').options.unique).toBe(undefined);
    });

    it('the counter field does not have an index', () => {
      expect(Object.keys(indices)).toEqual(expect.arrayContaining(['_id_']));
    });
  });

  describe('when used in subdocument', () => {
    let project1;
    let project2;
    let projectSchema;
    let storeSchema;

    beforeEach(async () => {
      storeSchema = new mongoose.Schema({
        name: String,
      });
      storeSchema.plugin(autoIncrement.plugin, { model: 'Store' });
      mongoose.model('Store', storeSchema);

      projectSchema = new mongoose.Schema({
        name: String,
        apple: storeSchema,
        google: storeSchema,
      });
      const Project = mongoose.model('Project', projectSchema);

      project1 = await new Project({ name: 'Cool project', apple: { name: 'Apple' }, google: { name: 'Google' } }).save();
      project2 = await new Project({ name: 'Another Cool project' }).save();
      project2.google = { name: 'Google' };
      project2 = await project2.save();
    });

    afterEach(() => {
      delete mongoose.connection.models.Project;
      delete mongoose.connection.models.Store;
    });

    it('increases counter when subdocument is created with the main document', () => {
      expect([project1.apple._id, project1.google._id]).toEqual(expect.arrayContaining([0, 1]));
    });

    it('increases counter when subdocument is created after main document', () => {
      expect(project2.google._id).toEqual(2);
    });
  });

  describe('nextCount()', () => {
    let user1;
    let user2;
    let count1;
    let count2;
    let count3;

    beforeEach(async () => {
      const User = getModel('User', { model: 'User' });
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

    beforeEach(async () => {
      const User = getModel('User', { model: 'User' });
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
