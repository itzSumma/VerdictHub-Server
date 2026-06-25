const dns = require('node:dns');
dns.setServers(['1.1.1.1', '1.0.0.1']);

require('dotenv').config();
const { MongoClient, ObjectId } = require('mongodb');

const now = new Date();
const lawyerEmail = 'demo.lawyer@verdicthub.com';

const listings = [
  {
    name: 'Demo Lawyer - Corporate Counsel',
    specialization: 'Corporate',
    hourlyRate: 125,
    availability: 'available',
    image: 'https://images.unsplash.com/photo-1551836022-d5d88e9218df?auto=format&fit=crop&w=900&q=80',
    bio: 'Corporate counsel helping founders and small businesses with contracts, compliance, company formation, and investor documentation.',
    published: true,
    hireCount: 12,
  },
  {
    name: 'Demo Lawyer - Property Advisor',
    specialization: 'Property',
    hourlyRate: 95,
    availability: 'available',
    image: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=900&q=80',
    bio: 'Property law support for land disputes, tenancy agreements, sale deeds, mutation, and registration due diligence.',
    published: true,
    hireCount: 8,
  },
  {
    name: 'Demo Lawyer - Family Mediation',
    specialization: 'Family',
    hourlyRate: 80,
    availability: 'busy',
    image: 'https://images.unsplash.com/photo-1589571894960-20bbe2828d0a?auto=format&fit=crop&w=900&q=80',
    bio: 'Family mediation and legal guidance for custody, guardianship, divorce settlement, and sensitive family matters.',
    published: false,
    hireCount: 5,
  },
];

const clients = [
  'demo.client@verdicthub.com',
  'client.one@verdicthub.com',
  'client.two@verdicthub.com',
  'client.three@verdicthub.com',
  'client.four@verdicthub.com',
  'client.five@verdicthub.com',
  'client.six@verdicthub.com',
  'client.seven@verdicthub.com',
];

const statuses = ['accepted', 'pending', 'accepted', 'rejected', 'accepted', 'pending', 'accepted', 'accepted'];

async function seedLawyerDashboard() {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is missing.');

  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();

  const db = client.db(process.env.DB_NAME || 'verdictHub');
  const users = db.collection('user');
  const lawyers = db.collection('lawyers');
  const hires = db.collection('hires');
  const comments = db.collection('comments');
  const transactions = db.collection('transactions');

  await users.updateOne(
    { email: lawyerEmail },
    {
      $set: {
        name: 'Demo Lawyer',
        email: lawyerEmail,
        role: 'lawyer',
        image: 'https://images.unsplash.com/photo-1551836022-d5d88e9218df?auto=format&fit=crop&w=400&q=80',
        emailVerified: true,
        updatedAt: now,
      },
      $setOnInsert: { createdAt: now },
    },
    { upsert: true },
  );

  await Promise.all([
    lawyers.deleteMany({ lawyerDashboardDemo: true }),
    hires.deleteMany({ lawyerDashboardDemo: true }),
    comments.deleteMany({ lawyerDashboardDemo: true }),
    transactions.deleteMany({ lawyerDashboardDemo: true }),
  ]);

  const lawyerDocs = listings.map((listing, index) => ({
    ...listing,
    email: lawyerEmail,
    ownerId: lawyerEmail,
    createdAt: new Date(now.getTime() - (index + 1) * 86400000),
    updatedAt: now,
    lawyerDashboardDemo: true,
  }));

  const inserted = await lawyers.insertMany(lawyerDocs);
  const insertedListings = await lawyers.find({ _id: { $in: Object.values(inserted.insertedIds) } }).sort({ createdAt: -1 }).toArray();

  const hireDocs = [];
  const transactionDocs = [];
  const commentDocs = [];

  clients.forEach((clientEmail, index) => {
    const listing = insertedListings[index % insertedListings.length];
    const status = statuses[index];
    const paid = status === 'accepted' && index !== 2;
    const hireId = new ObjectId();
    const requestedAt = new Date(now.getTime() - (index + 1) * 43200000);
    const paidAt = paid ? new Date(requestedAt.getTime() + 21600000) : undefined;
    const paymentIntentId = paid ? `pi_lawyer_dashboard_${hireId.toString()}` : undefined;

    hireDocs.push({
      _id: hireId,
      lawyerId: listing._id.toString(),
      lawyerEmail,
      lawyerName: listing.name,
      lawyerSpecialization: listing.specialization,
      fee: listing.hourlyRate,
      clientEmail,
      status,
      paid,
      ...(paymentIntentId ? { paymentIntentId } : {}),
      requestedAt,
      updatedAt: requestedAt,
      ...(paidAt ? { paidAt } : {}),
      lawyerDashboardDemo: true,
    });

    if (paid) {
      transactionDocs.push({
        paymentIntentId,
        hireId: hireId.toString(),
        clientEmail,
        lawyerEmail,
        lawyerName: listing.name,
        amount: listing.hourlyRate,
        currency: 'usd',
        status: 'succeeded',
        paidAt,
        createdAt: paidAt,
        updatedAt: now,
        lawyerDashboardDemo: true,
      });

      commentDocs.push({
        lawyerId: listing._id.toString(),
        text: `${listing.specialization} consultation was clear, professional, and easy to act on.`,
        rating: index % 2 === 0 ? 5 : 4,
        userEmail: clientEmail,
        createdAt: new Date(paidAt.getTime() + 43200000),
        lawyerDashboardDemo: true,
      });
    }
  });

  await hires.insertMany(hireDocs);
  await transactions.insertMany(transactionDocs);
  await comments.insertMany(commentDocs);

  console.log('Lawyer dashboard database updated.');
  console.log(`Demo lawyer listings: ${await lawyers.countDocuments({ email: lawyerEmail })}`);
  console.log(`Demo lawyer hires: ${await hires.countDocuments({ lawyerEmail })}`);
  console.log(`Demo lawyer transactions: ${await transactions.countDocuments({ lawyerEmail })}`);
  console.log(`Demo lawyer comments: ${await comments.countDocuments({ lawyerId: { $in: insertedListings.map((item) => item._id.toString()) } })}`);

  await client.close();
}

seedLawyerDashboard().catch((error) => {
  console.error(error);
  process.exit(1);
});
