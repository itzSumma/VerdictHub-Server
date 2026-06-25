const dns = require('node:dns');
dns.setServers(['1.1.1.1', '1.0.0.1']);

require('dotenv').config();
const { MongoClient, ObjectId } = require('mongodb');

const now = new Date();
const clientEmail = 'demo.client@verdicthub.com';

const showcaseLawyers = [
  ['Sadia Islam', 'Corporate', 180, 'available', 42, 'Mergers, acquisitions, commercial contracts, and company governance.', 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=900&q=80'],
  ['Mahmud Reza', 'Criminal', 115, 'available', 38, 'Bail hearings, criminal defense, investigations, and courtroom advocacy.', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=900&q=80'],
  ['Tanzila Noor', 'Family', 95, 'available', 31, 'Divorce, child custody, mediation, guardianship, and family settlements.', 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=900&q=80'],
  ['Arif Mahmud', 'Property', 125, 'busy', 29, 'Land registration, real estate disputes, leases, and title due diligence.', 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=900&q=80'],
  ['Lamia Chowdhury', 'Immigration', 160, 'available', 35, 'Visa petitions, appeals, documentation, and relocation compliance.', 'https://images.unsplash.com/photo-1531123897727-8f129e1688ce?auto=format&fit=crop&w=900&q=80'],
  ['Shakil Ahmed', 'Tax', 175, 'available', 27, 'Tax planning, audit response, VAT disputes, and business tax strategy.', 'https://images.unsplash.com/photo-1564564321837-a57b7070ac4f?auto=format&fit=crop&w=900&q=80'],
  ['Rumana Kabir', 'Employment', 105, 'available', 22, 'Workplace policy, termination, harassment claims, and employee contracts.', 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=900&q=80'],
  ['Nabil Hasan', 'Cyber Law', 190, 'busy', 44, 'Data privacy, online fraud, SaaS contracts, and cyber incident response.', 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=900&q=80'],
  ['Samira Akter', 'Corporate', 150, 'available', 19, 'Startup formation, founder agreements, compliance, and investor documents.', 'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?auto=format&fit=crop&w=900&q=80'],
  ['Ibrahim Hossain', 'Property', 90, 'available', 15, 'Apartment handover, tenancy claims, mutation, and sale deed reviews.', 'https://images.unsplash.com/photo-1531891437562-4301cf35b7e4?auto=format&fit=crop&w=900&q=80'],
  ['Mim Sultana', 'Family', 85, 'busy', 17, 'Family settlements, adoption guidance, custody hearings, and mediation.', 'https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?auto=format&fit=crop&w=900&q=80'],
  ['Rashed Karim', 'Criminal', 130, 'available', 26, 'Trial preparation, defense strategy, and criminal appeal consultation.', 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=900&q=80'],
];

const extraClients = [
  'client.one@verdicthub.com',
  'client.two@verdicthub.com',
  'client.three@verdicthub.com',
  clientEmail,
];

async function fillShowcaseData() {
  const mongo = new MongoClient(process.env.MONGODB_URI);
  await mongo.connect();

  const db = mongo.db(process.env.DB_NAME || 'verdictHub');
  const lawyers = db.collection('lawyers');
  const hires = db.collection('hires');
  const comments = db.collection('comments');
  const transactions = db.collection('transactions');

  await Promise.all([
    lawyers.deleteMany({ showcase: true }),
    hires.deleteMany({ showcase: true }),
    comments.deleteMany({ showcase: true }),
    transactions.deleteMany({ showcase: true }),
  ]);

  const lawyerDocs = showcaseLawyers.map(([name, specialization, hourlyRate, availability, hireCount, bio, image], index) => ({
    name,
    email: `${name.toLowerCase().replace(/\s+/g, '.')}@showcase.verdicthub.com`,
    specialization,
    hourlyRate,
    availability,
    image,
    bio,
    published: true,
    hireCount,
    ownerId: `${name.toLowerCase().replace(/\s+/g, '.')}@showcase.verdicthub.com`,
    createdAt: new Date(now.getTime() - (index + 1) * 43200000),
    updatedAt: now,
    showcase: true,
  }));

  const inserted = await lawyers.insertMany(lawyerDocs);
  const insertedLawyers = await lawyers.find({ _id: { $in: Object.values(inserted.insertedIds) } }).toArray();

  const hireDocs = [];
  const transactionDocs = [];
  const commentDocs = [];

  insertedLawyers.forEach((lawyer, index) => {
    const baseDate = new Date(now.getTime() - (index + 2) * 86400000);
    const client = extraClients[index % extraClients.length];
    const status = index % 5 === 0 ? 'pending' : index % 7 === 0 ? 'rejected' : 'accepted';
    const paid = status === 'accepted' && index % 3 !== 0;
    const hireId = new ObjectId();
    const paymentIntentId = paid ? `pi_showcase_${hireId.toString()}` : undefined;

    hireDocs.push({
      _id: hireId,
      lawyerId: lawyer._id.toString(),
      lawyerEmail: lawyer.email,
      lawyerName: lawyer.name,
      lawyerSpecialization: lawyer.specialization,
      fee: lawyer.hourlyRate,
      clientEmail: client,
      status,
      paid,
      ...(paymentIntentId ? { paymentIntentId } : {}),
      requestedAt: baseDate,
      ...(paid ? { paidAt: new Date(baseDate.getTime() + 86400000) } : {}),
      updatedAt: now,
      showcase: true,
    });

    if (paid) {
      transactionDocs.push({
        paymentIntentId,
        hireId: hireId.toString(),
        clientEmail: client,
        lawyerEmail: lawyer.email,
        lawyerName: lawyer.name,
        amount: lawyer.hourlyRate,
        currency: 'usd',
        status: 'succeeded',
        paidAt: new Date(baseDate.getTime() + 86400000),
        createdAt: new Date(baseDate.getTime() + 86400000),
        updatedAt: now,
        showcase: true,
      });

      commentDocs.push({
        lawyerId: lawyer._id.toString(),
        text: `Excellent ${lawyer.specialization.toLowerCase()} consultation. Clear advice and fast response.`,
        rating: 4 + (index % 2),
        userEmail: client,
        createdAt: new Date(baseDate.getTime() + 172800000),
        showcase: true,
      });
    }
  });

  if (hireDocs.length) await hires.insertMany(hireDocs);
  if (transactionDocs.length) await transactions.insertMany(transactionDocs);
  if (commentDocs.length) await comments.insertMany(commentDocs);

  console.log(`Showcase lawyers added: ${insertedLawyers.length}`);
  console.log(`Showcase hires added: ${hireDocs.length}`);
  console.log(`Showcase transactions added: ${transactionDocs.length}`);
  console.log(`Showcase comments added: ${commentDocs.length}`);
  console.log(`Total lawyers: ${await lawyers.countDocuments()}`);
  console.log(`Total hires: ${await hires.countDocuments()}`);
  console.log(`Total transactions: ${await transactions.countDocuments()}`);
  console.log(`Total comments: ${await comments.countDocuments()}`);

  await mongo.close();
}

fillShowcaseData().catch((error) => {
  console.error(error);
  process.exit(1);
});
