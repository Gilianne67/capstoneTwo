const mongoose = require('mongoose');
const dns = require('dns');

// Force Node to use Google/Cloudflare public DNS for SRV lookups
dns.setServers(['8.8.8.8', '1.1.1.1']);

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`⚠️ MongoDB Connection Warning: ${error.message}`);
    console.log('👉 Tip: Ensure IP is whitelisted in Atlas (0.0.0.0/0) or verify database user password.');
  }
};

module.exports = connectDB;