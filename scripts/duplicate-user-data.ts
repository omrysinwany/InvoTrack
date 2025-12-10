import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

// Initialize Firebase Admin
if (!getApps().length) {
  // You'll need to download your service account key from Firebase Console
  // Go to: Project Settings > Service Accounts > Generate New Private Key
  const serviceAccount = require('../firebase-admin-key.json');

  initializeApp({
    credential: cert(serviceAccount)
  });
}

const db = getFirestore();
const auth = getAuth();

const COLLECTIONS_TO_COPY = [
  'inventoryProducts',
  'documents',
  'suppliers',
  'otherExpenses',
  'expenseCategories'
];

async function getUserIdByEmail(email: string): Promise<string> {
  try {
    const userRecord = await auth.getUserByEmail(email);
    return userRecord.uid;
  } catch (error) {
    throw new Error(`User not found with email: ${email}`);
  }
}

async function duplicateUserData(sourceEmail: string, targetEmail: string) {
  console.log(`\n🔄 Starting data duplication...`);
  console.log(`Source: ${sourceEmail}`);
  console.log(`Target: ${targetEmail}\n`);

  // Get user IDs
  const sourceUserId = await getUserIdByEmail(sourceEmail);
  const targetUserId = await getUserIdByEmail(targetEmail);

  console.log(`✓ Source User ID: ${sourceUserId}`);
  console.log(`✓ Target User ID: ${targetUserId}\n`);

  // Copy each subcollection
  for (const collectionName of COLLECTIONS_TO_COPY) {
    console.log(`📦 Copying ${collectionName}...`);

    const sourceCollectionRef = db
      .collection('users')
      .doc(sourceUserId)
      .collection(collectionName);

    const targetCollectionRef = db
      .collection('users')
      .doc(targetUserId)
      .collection(collectionName);

    const snapshot = await sourceCollectionRef.get();

    if (snapshot.empty) {
      console.log(`  ⚠️  No documents found in ${collectionName}`);
      continue;
    }

    const batch = db.batch();
    let count = 0;

    snapshot.forEach((doc) => {
      const data = doc.data();

      // Update userId field to target user
      if (data.userId) {
        data.userId = targetUserId;
      }

      // Update supplierId references if needed
      // (We'll keep the same IDs for suppliers to maintain relationships)

      const targetDocRef = targetCollectionRef.doc(doc.id);
      batch.set(targetDocRef, data);
      count++;
    });

    await batch.commit();
    console.log(`  ✓ Copied ${count} documents from ${collectionName}\n`);
  }

  // Copy settings
  console.log(`⚙️  Copying settings...`);
  const sourceSettingsRef = db
    .collection('users')
    .doc(sourceUserId)
    .collection('settings')
    .doc('userProfile');

  const targetSettingsRef = db
    .collection('users')
    .doc(targetUserId)
    .collection('settings')
    .doc('userProfile');

  const settingsDoc = await sourceSettingsRef.get();
  if (settingsDoc.exists) {
    await targetSettingsRef.set(settingsDoc.data()!);
    console.log(`  ✓ Settings copied\n`);
  } else {
    console.log(`  ⚠️  No settings found\n`);
  }

  console.log(`✅ Data duplication complete!`);
  console.log(`\nSummary:`);
  console.log(`  Source: ${sourceEmail} (${sourceUserId})`);
  console.log(`  Target: ${targetEmail} (${targetUserId})`);
}

// Run the script
const SOURCE_EMAIL = 'omrysinwanyy@gmail.com';
const TARGET_EMAIL = 'demo@gmail.com';

duplicateUserData(SOURCE_EMAIL, TARGET_EMAIL)
  .then(() => {
    console.log('\n✨ Script completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  });
