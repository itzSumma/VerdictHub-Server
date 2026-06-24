const dns = require('node:dns');
dns.setServers(['1.1.1.1', '1.0.0.1']);

const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { MongoClient, ObjectId, ServerApiVersion } = require('mongodb');
const { createRemoteJWKSet, jwtVerify } = require('jose-cjs');

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;
const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';
const client = new MongoClient(process.env.MONGODB_URI, {
  serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true },
});
const db = client.db('verdict-hub');
const lawyers = db.collection('lawyers');
const hires = db.collection('hires');
const comments = db.collection('comments');
const users = db.collection('user');
const transactions = db.collection('transactions');
const jwks = createRemoteJWKSet(new URL(`${clientUrl}/api/auth/jwks`));

app.use(cors({ origin: clientUrl, credentials: true }));
app.use(express.json());

let connected = false;
app.use(async (req, res, next) => {
  try {
    if (!connected) {
      await client.connect();
      connected = true;
    }
    next();
  } catch (error) {
    res.status(500).json({ message: 'Database connection failed.' });
  }
});

const verifyToken = async (req, res, next) => {
  const token = req.headers.authorization?.startsWith('Bearer ')
    ? req.headers.authorization.slice(7)
    : null;
  if (!token) return res.status(401).json({ message: 'Authentication is required.' });
  try {
    const { payload } = await jwtVerify(token, jwks);
    if (!payload.email) return res.status(403).json({ message: 'Invalid user token.' });
    req.user = payload;
    next();
  } catch {
    res.status(403).json({ message: 'Invalid or expired token.' });
  }
};

const requireRole = (...roles) => async (req, res, next) => {
  const user = await users.findOne({ email: req.user.email }, { projection: { role: 1 } });
  if (!user || !roles.includes(user.role)) {
    return res.status(403).json({ message: 'You do not have permission for this action.' });
  }
  req.currentRole = user.role;
  next();
};

const validId = (id, res) => {
  if (ObjectId.isValid(id)) return true;
  res.status(400).json({ message: 'Invalid resource ID.' });
  return false;
};

app.get('/', (req, res) => res.send('VerdictHub API is running.'));

app.get('/lawyers', async (req, res) => {
  const { search = '', specialization, availability, minFee, maxFee, page = 1, limit = 8, sort = 'newest' } = req.query;
  const query = { published: true };
  if (search) query.$or = [
    { name: { $regex: search, $options: 'i' } },
    { specialization: { $regex: search, $options: 'i' } },
  ];
  if (specialization && specialization !== 'All') query.specialization = specialization;
  if (availability && availability !== 'All') query.availability = availability;
  if (minFee || maxFee) query.hourlyRate = {
    ...(minFee ? { $gte: Number(minFee) } : {}),
    ...(maxFee ? { $lte: Number(maxFee) } : {}),
  };
  const sortMap = { newest: { createdAt: -1 }, feeLow: { hourlyRate: 1 }, feeHigh: { hourlyRate: -1 }, mostHired: { hireCount: -1 } };
  const safeLimit = Math.min(Math.max(Number(limit), 1), 12);
  const safePage = Math.max(Number(page), 1);
  const [data, total] = await Promise.all([
    lawyers.find(query).sort(sortMap[sort] || sortMap.newest).skip((safePage - 1) * safeLimit).limit(safeLimit).toArray(),
    lawyers.countDocuments(query),
  ]);
  res.json({ data, total, page: safePage, pages: Math.ceil(total / safeLimit) });
});

app.get('/lawyers/featured', async (req, res) => {
  res.json(await lawyers.find({ published: true }).sort({ createdAt: -1 }).limit(6).toArray());
});

app.get('/lawyers/top', async (req, res) => {
  res.json(await lawyers.find({ published: true }).sort({ hireCount: -1 }).limit(3).toArray());
});

app.get('/lawyers/:id', async (req, res) => {
  if (!validId(req.params.id, res)) return;
  const lawyer = await lawyers.findOne({ _id: new ObjectId(req.params.id) });
  if (!lawyer) return res.status(404).json({ message: 'Lawyer not found.' });
  res.json(lawyer);
});

app.post('/lawyers', verifyToken, requireRole('lawyer', 'admin'), async (req, res) => {
  const { name, bio, specialization, hourlyRate, image, availability = 'available' } = req.body;
  if (!name || !bio || !specialization || !hourlyRate || !image) {
    return res.status(400).json({ message: 'Name, bio, specialization, fee, and image are required.' });
  }
  const lawyer = {
    name, bio, specialization, hourlyRate: Number(hourlyRate), image, availability,
    email: req.user.email, ownerId: req.user.sub, published: req.currentRole === 'admin',
    hireCount: 0, createdAt: new Date(), updatedAt: new Date(),
  };
  const result = await lawyers.insertOne(lawyer);
  res.status(201).json({ insertedId: result.insertedId, lawyer });
});

app.get('/lawyers/me/listings', verifyToken, requireRole('lawyer', 'admin'), async (req, res) => {
  const query = req.currentRole === 'admin' ? {} : { email: req.user.email };
  res.json(await lawyers.find(query).sort({ createdAt: -1 }).toArray());
});

app.put('/lawyers/:id', verifyToken, requireRole('lawyer', 'admin'), async (req, res) => {
  if (!validId(req.params.id, res)) return;
  const filter = { _id: new ObjectId(req.params.id) };
  const existing = await lawyers.findOne(filter);
  if (!existing) return res.status(404).json({ message: 'Lawyer not found.' });
  if (req.currentRole !== 'admin' && existing.email !== req.user.email) return res.status(403).json({ message: 'You can only edit your own listing.' });
  const { name, bio, specialization, hourlyRate, image, availability } = req.body;
  const update = { name, bio, specialization, hourlyRate: Number(hourlyRate), image, availability, updatedAt: new Date() };
  await lawyers.updateOne(filter, { $set: update });
  res.json({ message: 'Legal profile updated.' });
});

app.patch('/lawyers/:id/publish', verifyToken, requireRole('lawyer', 'admin'), async (req, res) => {
  if (!validId(req.params.id, res)) return;
  const lawyer = await lawyers.findOne({ _id: new ObjectId(req.params.id) });
  if (!lawyer) return res.status(404).json({ message: 'Lawyer not found.' });
  if (req.currentRole !== 'admin' && lawyer.email !== req.user.email) return res.status(403).json({ message: 'You can only publish your own listing.' });
  await lawyers.updateOne({ _id: lawyer._id }, { $set: { published: Boolean(req.body.published), updatedAt: new Date() } });
  res.json({ message: 'Publication status updated.' });
});

app.delete('/lawyers/:id', verifyToken, requireRole('lawyer', 'admin'), async (req, res) => {
  if (!validId(req.params.id, res)) return;
  const lawyer = await lawyers.findOne({ _id: new ObjectId(req.params.id) });
  if (!lawyer) return res.status(404).json({ message: 'Lawyer not found.' });
  if (req.currentRole !== 'admin' && lawyer.email !== req.user.email) return res.status(403).json({ message: 'You can only delete your own listing.' });
  await lawyers.deleteOne({ _id: lawyer._id });
  res.json({ message: 'Lawyer listing deleted.' });
});

app.post('/hires', verifyToken, requireRole('user'), async (req, res) => {
  const { lawyerId } = req.body;
  if (!validId(lawyerId, res)) return;
  const lawyer = await lawyers.findOne({ _id: new ObjectId(lawyerId), published: true });
  if (!lawyer) return res.status(404).json({ message: 'Lawyer not found.' });
  const hire = { lawyerId, lawyerEmail: lawyer.email, lawyerName: lawyer.name, lawyerSpecialization: lawyer.specialization, fee: lawyer.hourlyRate, clientEmail: req.user.email, status: 'pending', paid: false, requestedAt: new Date() };
  const result = await hires.insertOne(hire);
  await lawyers.updateOne({ _id: lawyer._id }, { $inc: { hireCount: 1 } });
  res.status(201).json({ insertedId: result.insertedId, hire });
});

app.get('/hires/me', verifyToken, requireRole('user'), async (req, res) => {
  res.json(await hires.find({ clientEmail: req.user.email }).sort({ requestedAt: -1 }).toArray());
});

app.get('/hires/lawyer', verifyToken, requireRole('lawyer'), async (req, res) => {
  res.json(await hires.find({ lawyerEmail: req.user.email }).sort({ requestedAt: -1 }).toArray());
});

app.patch('/hires/:id/status', verifyToken, requireRole('lawyer'), async (req, res) => {
  if (!validId(req.params.id, res)) return;
  const hire = await hires.findOne({ _id: new ObjectId(req.params.id) });
  if (!hire) return res.status(404).json({ message: 'Hiring request not found.' });
  if (hire.lawyerEmail !== req.user.email) return res.status(403).json({ message: 'You can only manage your own requests.' });
  if (!['accepted', 'rejected'].includes(req.body.status)) return res.status(400).json({ message: 'Invalid hiring status.' });
  await hires.updateOne({ _id: hire._id }, { $set: { status: req.body.status, updatedAt: new Date() } });
  res.json({ message: 'Hiring request updated.' });
});

app.get('/comments/:lawyerId', async (req, res) => {
  if (!validId(req.params.lawyerId, res)) return;
  res.json(await comments.find({ lawyerId: req.params.lawyerId }).sort({ createdAt: -1 }).toArray());
});

app.post('/comments', verifyToken, requireRole('user'), async (req, res) => {
  const { lawyerId, text, rating = 5 } = req.body;
  if (!validId(lawyerId, res) || !text?.trim()) return;
  const hired = await hires.findOne({ lawyerId, clientEmail: req.user.email });
  if (!hired) return res.status(403).json({ message: 'Hire this lawyer before leaving a comment.' });
  const result = await comments.insertOne({ lawyerId, text: text.trim(), rating: Number(rating), userEmail: req.user.email, createdAt: new Date() });
  res.status(201).json({ insertedId: result.insertedId });
});

app.get('/comments/me', verifyToken, requireRole('user'), async (req, res) => {
  res.json(await comments.find({ userEmail: req.user.email }).sort({ createdAt: -1 }).toArray());
});

app.put('/comments/:id', verifyToken, requireRole('user'), async (req, res) => {
  if (!validId(req.params.id, res)) return;
  const comment = await comments.findOne({ _id: new ObjectId(req.params.id) });
  if (!comment) return res.status(404).json({ message: 'Comment not found.' });
  if (comment.userEmail !== req.user.email) return res.status(403).json({ message: 'You can only edit your own comments.' });
  await comments.updateOne({ _id: comment._id }, { $set: { text: req.body.text?.trim(), rating: Number(req.body.rating || comment.rating), updatedAt: new Date() } });
  res.json({ message: 'Comment updated.' });
});

app.delete('/comments/:id', verifyToken, requireRole('user'), async (req, res) => {
  if (!validId(req.params.id, res)) return;
  const comment = await comments.findOne({ _id: new ObjectId(req.params.id) });
  if (!comment) return res.status(404).json({ message: 'Comment not found.' });
  if (comment.userEmail !== req.user.email) return res.status(403).json({ message: 'You can only delete your own comments.' });
  await comments.deleteOne({ _id: comment._id });
  res.json({ message: 'Comment deleted.' });
});

app.patch('/profile', verifyToken, async (req, res) => {
  const { name, image } = req.body;
  await users.updateOne({ email: req.user.email }, { $set: { ...(name ? { name } : {}), ...(image ? { image } : {}), updatedAt: new Date() } });
  res.json({ message: 'Profile updated.' });
});

app.get('/admin/users', verifyToken, requireRole('admin'), async (req, res) => {
  res.json(await users.find({}, { projection: { password: 0 } }).sort({ createdAt: -1 }).toArray());
});

app.patch('/admin/users/:id/role', verifyToken, requireRole('admin'), async (req, res) => {
  if (!validId(req.params.id, res)) return;
  if (!['user', 'lawyer', 'admin'].includes(req.body.role)) return res.status(400).json({ message: 'Invalid role.' });
  await users.updateOne({ _id: new ObjectId(req.params.id) }, { $set: { role: req.body.role, updatedAt: new Date() } });
  res.json({ message: 'User role updated.' });
});

app.delete('/admin/users/:id', verifyToken, requireRole('admin'), async (req, res) => {
  if (!validId(req.params.id, res)) return;
  if (req.user.sub === req.params.id) return res.status(400).json({ message: 'You cannot delete your own admin account.' });
  await users.deleteOne({ _id: new ObjectId(req.params.id) });
  res.json({ message: 'User deleted.' });
});

app.get('/admin/transactions', verifyToken, requireRole('admin'), async (req, res) => {
  res.json(await transactions.find({}).sort({ createdAt: -1 }).toArray());
});

app.get('/admin/analytics', verifyToken, requireRole('admin'), async (req, res) => {
  const [totalUsers, totalLawyers, totalHires, revenue] = await Promise.all([
    users.countDocuments(), lawyers.countDocuments(), hires.countDocuments(), transactions.aggregate([{ $group: { _id: null, total: { $sum: '$amount' } } }]).toArray(),
  ]);
  res.json({ totalUsers, totalLawyers, totalHires, totalRevenue: revenue[0]?.total || 0 });
});

if (process.env.NODE_ENV !== 'production') app.listen(port, () => console.log(`VerdictHub API listening on ${port}`));
module.exports = app;
