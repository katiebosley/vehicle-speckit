import db from "../models/index.js";

const email = process.argv[2]?.trim().toLowerCase();

if (!email) {
  console.error("Usage: npm run promote-admin --prefix backend -- <email>");
  process.exit(1);
}

try {
  const user = await db.user.findOne({ where: { email } });

  if (!user) {
    console.error(`No user has email ${email}. They must sign in with Google once first.`);
    process.exitCode = 1;
  } else {
    await user.update({ role: "admin" });
    console.log(`${email} is now an admin.`);
  }
} catch (err) {
  console.error(`promote-admin failed: ${err.message}`);
  process.exitCode = 1;
} finally {
  await db.sequelize.close();
}
