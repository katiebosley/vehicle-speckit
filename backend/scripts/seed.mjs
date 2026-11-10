import path from "path";
import { pathToFileURL } from "url";
import db from "../app/models/index.js";
import logger from "../app/config/logger.js";

const ADMIN_EMAIL = "admin@oc.edu";
const ALEX_REED_EMAIL = "areed@oc.edu";
const SAM_COLE_EMAIL = "scole@oc.edu";
const BOB_JONES_EMAIL = "bjones@oc.edu";
const CASEY_NGUYEN_EMAIL = "cnguyen@oc.edu";
const RILEY_PATEL_EMAIL = "rpatel@oc.edu";
const DRIVER_LICENSE_EXPIRATION = "2099-12-31";

const SEED_USERS = [
  { email: ADMIN_EMAIL, firstName: "Jordan", lastName: "Blake", role: "admin" },
  { email: ALEX_REED_EMAIL, firstName: "Alex", lastName: "Reed", role: "area_admin" },
  { email: SAM_COLE_EMAIL, firstName: "Sam", lastName: "Cole", role: "area_admin" },
  { email: BOB_JONES_EMAIL, firstName: "Bob", lastName: "Jones", role: "requestor" },
  {
    email: CASEY_NGUYEN_EMAIL,
    firstName: "Casey",
    lastName: "Nguyen",
    role: "requestor",
    isApprovedDriver: true,
    licenseExpiration: DRIVER_LICENSE_EXPIRATION,
  },
  { email: RILEY_PATEL_EMAIL, firstName: "Riley", lastName: "Patel", role: "requestor" },
];

const SEED_AREAS = [
  { name: "Athletics", description: "Team vans and buses for OC Athletics." },
  { name: "Support Central", description: "Vans and carts for Support Central." },
  { name: "Maintenance", description: "Trucks and service vehicles for Maintenance." },
];

async function findOrCreateUser(record) {
  const [user] = await db.user.findOrCreate({
    where: { email: record.email },
    defaults: {
      firstName: record.firstName,
      lastName: record.lastName,
      role: record.role,
      isApprovedDriver: record.isApprovedDriver ?? false,
      licenseExpiration: record.licenseExpiration ?? null,
      isActive: true,
    },
  });
  return user;
}

async function findOrCreateArea(record) {
  const [area] = await db.area.findOrCreate({
    where: { name: record.name },
    defaults: { description: record.description, isActive: true },
  });
  return area;
}

export async function seed() {
  const users = [];
  for (const record of SEED_USERS) {
    users.push(await findOrCreateUser(record));
  }

  const areas = [];
  for (const record of SEED_AREAS) {
    areas.push(await findOrCreateArea(record));
  }

  const byEmail = Object.fromEntries(users.map((user) => [user.email, user]));
  const byName = Object.fromEntries(areas.map((area) => [area.name, area]));
  const assignments = [
    [byEmail[ALEX_REED_EMAIL], byName.Athletics],
    [byEmail[SAM_COLE_EMAIL], byName["Support Central"]],
    [byEmail[SAM_COLE_EMAIL], byName.Maintenance],
  ];

  for (const [user, area] of assignments) {
    await db.areaAdmin.findOrCreate({
      where: { userId: user.id, areaId: area.id },
      defaults: { assignedAt: new Date() },
    });
  }
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isDirectRun) {
  try {
    await db.sequelize.sync();
    await seed();
    logger.info("Seed completed.");
  } catch (err) {
    logger.error(`Seed failed: ${err.message}`);
    process.exitCode = 1;
  } finally {
    await db.sequelize.close();
  }
}
