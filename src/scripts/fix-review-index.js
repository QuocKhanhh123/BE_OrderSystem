/**
 * Script to fix Review collection indexes
 * Run this script once to drop old indexes and create new ones
 * 
 * Usage: node src/scripts/fix-review-index.js
 */

const mongoose = require("mongoose");
require("dotenv").config();

async function fixReviewIndexes() {
    try {
        // Connect to MongoDB
        const dbUri = process.env.MONGO_URI || "mongodb://localhost:27017/food-ordering";
        await mongoose.connect(dbUri);
        console.log("✓ Connected to MongoDB");

        const db = mongoose.connection.db;
        const reviewsCollection = db.collection("reviews");

        // Get all indexes
        const indexes = await reviewsCollection.indexes();
        console.log("\nCurrent indexes:");
        indexes.forEach(index => {
            console.log(`  - ${index.name}:`, index.key);
        });

        // Drop old indexes if they exist
        const indexesToDrop = ["user_1_dish_1"];
        for (const indexName of indexesToDrop) {
            try {
                await reviewsCollection.dropIndex(indexName);
                console.log(`\n✓ Dropped old index: ${indexName}`);
            } catch (err) {
                if (err.code === 27) {
                    console.log(`\n- Index ${indexName} not found, skipping...`);
                } else {
                    console.error(`\n✗ Error dropping index ${indexName}:`, err.message);
                }
            }
        }

        // Create new unique index
        try {
            await reviewsCollection.createIndex(
                { menuItemId: 1, userId: 1 },
                { unique: true, name: "menuItemId_1_userId_1" }
            );
            console.log("\n✓ Created new unique index: menuItemId_1_userId_1");
        } catch (err) {
            if (err.code === 85 || err.code === 86) {
                console.log("\n- Index menuItemId_1_userId_1 already exists");
            } else {
                console.error("\n✗ Error creating index:", err.message);
            }
        }

        // Show final indexes
        const finalIndexes = await reviewsCollection.indexes();
        console.log("\nFinal indexes:");
        finalIndexes.forEach(index => {
            console.log(`  - ${index.name}:`, index.key);
        });

        console.log("\n✓ Review indexes fixed successfully!");
        process.exit(0);
    } catch (error) {
        console.error("\n✗ Error fixing indexes:", error);
        process.exit(1);
    }
}

fixReviewIndexes();
