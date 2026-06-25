const dns = require('node:dns');
dns.setServers(['1.1.1.1', '1.0.0.1']);

require('dotenv').config();
const { MongoClient } = require('mongodb');

const collections = ['lawyers', 'hires', 'comments', 'user', 'transactions'];

async function prepareDatabase() {
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();

  const db = client.db(process.env.DB_NAME || 'verdictHub');
  const existing = new Set((await db.listCollections().toArray()).map((collection) => collection.name));

  for (const collection of collections) {
    if (!existing.has(collection)) await db.createCollection(collection);
  }

  await db.collection('lawyers').createIndex({ published: 1, createdAt: -1 });
  await db.collection('lawyers').createIndex({ specialization: 1, availability: 1, hourlyRate: 1 });
  await db.collection('hires').createIndex({ clientEmail: 1, requestedAt: -1 });
  await db.collection('hires').createIndex({ lawyerEmail: 1, requestedAt: -1 });
  await db.collection('comments').createIndex({ lawyerId: 1, createdAt: -1 });
  await db.collection('transactions').createIndex({ paymentIntentId: 1 }, { unique: true, sparse: true });

  console.log(`Database ready: ${db.databaseName}`);
  await client.close();
}

prepareDatabase().catch((error) => {
  console.error(error);
  process.exit(1);
});
