/**
 * The mongoose models: validation and the pre-save hooks.
 *
 * No MongoDB server is used. Validation needs none, and for save() the driver
 * collection is replaced by a fake that records what would be written, so the
 * real mongoose save path (validation, hooks, casting) still runs.
 *
 * The hooks are the part a mongoose major upgrade breaks: mongoose 9 no longer
 * passes next() to pre hooks.
 */

const mongoose = require('mongoose');
const User = require('../models/User');
const ChatSession = require('../models/ChatSession');
const Message = require('../models/Message');

/** Replace the collection's insertOne/updateOne so save() needs no server. */
const fakeCollection = (Model) => {
  const written = [];
  jest.spyOn(Model.collection, 'insertOne').mockImplementation(async (doc) => {
    written.push(doc);
    return { acknowledged: true, insertedId: doc._id };
  });
  jest.spyOn(Model.collection, 'updateOne').mockImplementation(async (filter, update) => {
    written.push(update);
    return { acknowledged: true, matchedCount: 1, modifiedCount: 1 };
  });
  return written;
};

const id = () => new mongoose.Types.ObjectId();
const newUser = (fields = {}) => new User({ age: 20, termsAccepted: true, ...fields });

afterEach(() => {
  jest.restoreAllMocks();
});

describe('User', () => {
  test('save hashes the password and writes the hash, not the password', async () => {
    const written = fakeCollection(User);
    const user = newUser({ email: 'A@Example.com', password: 'correct horse' });
    await user.save();

    expect(written).toHaveLength(1);
    expect(written[0].password).not.toBe('correct horse');
    expect(written[0].password).toMatch(/^\$2[aby]\$12\$/);
    expect(await user.comparePassword('correct horse')).toBe(true);
    expect(await user.comparePassword('wrong horse')).toBe(false);
  });

  test('a later save that does not touch the password leaves the hash alone', async () => {
    fakeCollection(User);
    const user = newUser({ password: 'correct horse' });
    await user.save();
    const hash = user.password;

    user.age = 21;
    await user.save();
    expect(user.password).toBe(hash);
  });

  test('a user without a password saves', async () => {
    const written = fakeCollection(User);
    await newUser().save();
    expect(written).toHaveLength(1);
    expect(written[0].password).toBeUndefined();
  });

  test('a hashing failure rejects the save and nothing is written', async () => {
    const written = fakeCollection(User);
    jest.spyOn(require('bcryptjs'), 'hash').mockRejectedValue(new Error('hash failed'));

    await expect(newUser({ password: 'correct horse' }).save()).rejects.toThrow('hash failed');
    expect(written).toHaveLength(0);
  });

  test.each([
    ['no age', 'age', { age: undefined }],
    ['age under 13', 'age', { age: 12 }],
    ['age over 120', 'age', { age: 121 }],
    ['terms not accepted', 'termsAccepted', { termsAccepted: undefined }]
  ])('validation rejects %s and save writes nothing', async (_name, path, fields) => {
    const written = fakeCollection(User);
    const user = newUser(fields);
    expect(user.validateSync().errors).toHaveProperty(path);
    await expect(user.save()).rejects.toMatchObject({ name: 'ValidationError' });
    expect(written).toHaveLength(0);
  });
});

describe('ChatSession', () => {
  const session = (over = {}) =>
    new ChatSession({ userId: id(), sessionId: `s_${id()}`, ...over });

  test('save works and recomputes the duration in minutes when activity moves', async () => {
    fakeCollection(ChatSession);
    const doc = session();
    await doc.save();

    doc.stats.lastActivity = new Date(doc.createdAt.getTime() + 42.5 * 60 * 1000);
    await doc.save();
    expect(doc.stats.duration).toBe(42);
  });

  test('validation rejects a session without a user or with an unknown status', () => {
    expect(new ChatSession({ sessionId: 's' }).validateSync().errors).toHaveProperty('userId');
    expect(session({ status: 'deleted' }).validateSync().errors).toHaveProperty('status');
  });
});

describe('Message', () => {
  const fields = (over = {}) => ({
    sessionId: id(),
    userId: id(),
    sender: 'user',
    content: 'hello',
    ...over
  });

  test('validation passes for a complete message', async () => {
    await expect(new Message(fields({ messageId: 'msg_1' })).validate()).resolves.toBeUndefined();
  });

  test.each(['content', 'sender', 'userId', 'sessionId'])('validation rejects a message without %s', (field) => {
    const error = new Message(fields({ messageId: 'msg_1', [field]: undefined })).validateSync();
    expect(error.errors).toHaveProperty(field);
  });

  test('validation rejects a sender outside user and ai', () => {
    const error = new Message(fields({ messageId: 'msg_1', sender: 'admin' })).validateSync();
    expect(error.errors).toHaveProperty('sender');
  });

  test('save keeps a messageId that was given', async () => {
    const written = fakeCollection(Message);
    await new Message(fields({ messageId: 'msg_given' })).save();
    expect(written[0].messageId).toBe('msg_given');
  });
});
