const dns = require('node:dns');
dns.setServers(['1.1.1.1', '1.0.0.1']);

require('dotenv').config();
const { MongoClient, ObjectId } = require('mongodb');

const now = new Date();

const demoUsers = [
  { name: 'Admin User', email: 'admin@verdicthub.com', role: 'admin', image: 'https://i.ibb.co.com/CKDPRGm/lawyer-1.jpg', createdAt: now },
  { name: 'Client User', email: 'client@verdicthub.com', role: 'user', image: 'https://i.ibb.co.com/wJdK7JH/lawyer-2.jpg', createdAt: now },
  { name: 'Lawyer User', email: 'lawyer@verdicthub.com', role: 'lawyer', image: 'https://i.ibb.co.com/PzN3nLp/lawyer-3.jpg', createdAt: now },
];

const demoLawyers = [
  {
    name: 'Ayesha Rahman',
    email: 'ayesha.law@verdicthub.com',
    specialization: 'Corporate',
    hourlyRate: 120,
    availability: 'available',
    image: 'https://images.unsplash.com/photo-1551836022-d5d88e9218df?auto=format&fit=crop&w=900&q=80',
    bio: 'Corporate counsel focused on contracts, startup formation, compliance, and shareholder agreements.',
    published: true,
    hireCount: 18,
  },
  {
    name: 'Farhan Chowdhury',
    email: 'farhan.law@verdicthub.com',
    specialization: 'Criminal',
    hourlyRate: 95,
    availability: 'available',
    image: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=900&q=80',
    bio: 'Criminal defense lawyer with practical courtroom experience and strong client advocacy.',
    published: true,
    hireCount: 24,
  },
  {
    name: 'Nusrat Karim',
    email: 'nusrat.law@verdicthub.com',
    specialization: 'Family',
    hourlyRate: 80,
    availability: 'busy',
    image: 'https://images.unsplash.com/photo-1589571894960-20bbe2828d0a?auto=format&fit=crop&w=900&q=80',
    bio: 'Family law specialist handling divorce, custody, guardianship, and mediation cases.',
    published: true,
    hireCount: 16,
  },
  {
    name: 'Rafi Hasan',
    email: 'rafi.law@verdicthub.com',
    specialization: 'Property',
    hourlyRate: 110,
    availability: 'available',
    image: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=900&q=80',
    bio: 'Property and real estate lawyer helping with land disputes, registration, and due diligence.',
    published: true,
    hireCount: 12,
  },
  {
    name: 'Maliha Sultana',
    email: 'maliha.law@verdicthub.com',
    specialization: 'Immigration',
    hourlyRate: 130,
    availability: 'available',
    image: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=900&q=80',
    bio: 'Immigration advisor for visa petitions, appeals, documentation, and relocation planning.',
    published: true,
    hireCount: 21,
  },
  {
    name: 'Tanvir Ahmed',
    email: 'tanvir.law@verdicthub.com',
    specialization: 'Tax',
    hourlyRate: 140,
    availability: 'available',
    image: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=900&q=80',
    bio: 'Tax lawyer for businesses and individuals, including audits, planning, and dispute resolution.',
    published: true,
    hireCount: 9,
  },
  {
    name: 'Sabina Hoque',
    email: 'sabina.law@verdicthub.com',
    specialization: 'Employment',
    hourlyRate: 100,
    availability: 'available',
    image: 'https://images.unsplash.com/photo-1594744803329-e58b31de8bf5?auto=format&fit=crop&w=900&q=80',
    bio: 'Employment lawyer handling workplace disputes, contracts, compliance, and termination claims.',
    published: true,
    hireCount: 14,
  },
  {
    name: 'Imran Kabir',
    email: 'imran.law@verdicthub.com',
    specialization: 'Cyber Law',
    hourlyRate: 150,
    availability: 'busy',
    image: 'https://images.unsplash.com/photo-1556157382-97eda2d62296?auto=format&fit=crop&w=900&q=80',
    bio: 'Cyber law expert focused on privacy, digital contracts, online fraud, and technology compliance.',
    published: true,
    hireCount: 30,
  },
];

async function seedDemoData() {
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();

  const db = client.db(process.env.DB_NAME || 'verdictHub');
  const users = db.collection('user');
  const lawyers = db.collection('lawyers');
  const hires = db.collection('hires');
  const comments = db.collection('comments');
  const transactions = db.collection('transactions');

  await Promise.all([
    users.deleteMany({ email: { $in: demoUsers.map((user) => user.email) } }),
    lawyers.deleteMany({ email: { $in: demoLawyers.map((lawyer) => lawyer.email) } }),
    hires.deleteMany({ demo: true }),
    comments.deleteMany({ demo: true }),
    transactions.deleteMany({ demo: true }),
  ]);

  await users.insertMany(demoUsers.map((user) => ({ ...user, updatedAt: now })));
  const insertedLawyers = await lawyers.insertMany(demoLawyers.map((lawyer) => ({
    ...lawyer,
    ownerId: lawyer.email,
    createdAt: new Date(now.getTime() - Math.floor(Math.random() * 12) * 86400000),
    updatedAt: now,
  })));

  const lawyerDocs = await lawyers.find({ _id: { $in: Object.values(insertedLawyers.insertedIds) } }).toArray();
  const acceptedLawyer = lawyerDocs[0];
  const pendingLawyer = lawyerDocs[1];
  const rejectedLawyer = lawyerDocs[2];

  const hireDocs = [
    {
      _id: new ObjectId(),
      lawyerId: acceptedLawyer._id.toString(),
      lawyerEmail: acceptedLawyer.email,
      lawyerName: acceptedLawyer.name,
      lawyerSpecialization: acceptedLawyer.specialization,
      fee: acceptedLawyer.hourlyRate,
      clientEmail: 'client@verdicthub.com',
      status: 'accepted',
      paid: true,
      paymentIntentId: 'pi_demo_verdict_paid',
      requestedAt: new Date(now.getTime() - 5 * 86400000),
      paidAt: new Date(now.getTime() - 3 * 86400000),
      demo: true,
    },
    {
      _id: new ObjectId(),
      lawyerId: pendingLawyer._id.toString(),
      lawyerEmail: pendingLawyer.email,
      lawyerName: pendingLawyer.name,
      lawyerSpecialization: pendingLawyer.specialization,
      fee: pendingLawyer.hourlyRate,
      clientEmail: 'client@verdicthub.com',
      status: 'pending',
      paid: false,
      requestedAt: new Date(now.getTime() - 2 * 86400000),
      demo: true,
    },
    {
      _id: new ObjectId(),
      lawyerId: rejectedLawyer._id.toString(),
      lawyerEmail: rejectedLawyer.email,
      lawyerName: rejectedLawyer.name,
      lawyerSpecialization: rejectedLawyer.specialization,
      fee: rejectedLawyer.hourlyRate,
      clientEmail: 'client@verdicthub.com',
      status: 'rejected',
      paid: false,
      requestedAt: new Date(now.getTime() - 1 * 86400000),
      demo: true,
    },
  ];

  await hires.insertMany(hireDocs);
  await comments.insertMany([
    {
      lawyerId: acceptedLawyer._id.toString(),
      text: 'Very professional consultation. The advice was clear and practical.',
      rating: 5,
      userEmail: 'client@verdicthub.com',
      createdAt: new Date(now.getTime() - 2 * 86400000),
      demo: true,
    },
    {
      lawyerId: acceptedLawyer._id.toString(),
      text: 'Helped us understand the contract risks before signing.',
      rating: 4,
      userEmail: 'client@verdicthub.com',
      createdAt: new Date(now.getTime() - 86400000),
      demo: true,
    },
  ]);

  await transactions.insertOne({
    paymentIntentId: 'pi_demo_verdict_paid',
    hireId: hireDocs[0]._id.toString(),
    clientEmail: 'client@verdicthub.com',
    lawyerEmail: acceptedLawyer.email,
    lawyerName: acceptedLawyer.name,
    amount: acceptedLawyer.hourlyRate,
    currency: 'usd',
    status: 'succeeded',
    paidAt: hireDocs[0].paidAt,
    createdAt: hireDocs[0].paidAt,
    updatedAt: now,
    demo: true,
  });

  console.log('Demo data seeded successfully.');
  console.log(`Users: ${await users.countDocuments()}`);
  console.log(`Lawyers: ${await lawyers.countDocuments()}`);
  console.log(`Hires: ${await hires.countDocuments()}`);
  console.log(`Comments: ${await comments.countDocuments()}`);
  console.log(`Transactions: ${await transactions.countDocuments()}`);

  await client.close();
}

seedDemoData().catch((error) => {
  console.error(error);
  process.exit(1);
});
