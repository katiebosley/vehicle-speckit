import path from "path";
import { pathToFileURL } from "url";
import db from "../app/models/index.js";
import logger from "../app/config/logger.js";

const Area = db.area;
const VehicleType = db.vehicleType;
const Vehicle = db.vehicle;

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

const TYPES = [
  { name: "Car", defaultPassengerCapacity: 5 },
  { name: "Truck", defaultPassengerCapacity: 3 },
  { name: "Van", defaultPassengerCapacity: 12 },
  { name: "Golf Cart", defaultPassengerCapacity: 4 },
];

const VEHICLES = [
  {
    areaName: "Athletics",
    typeName: "Car",
    vin: "ATHCAR000001",
    licensePlate: "ATH-001",
    make: "Toyota",
    model: "Camry",
    year: 2022,
    color: "White",
    capacity: 5,
    status: "available",
  },
  {
    areaName: "Support Central",
    typeName: "Truck",
    vin: "SUPTRK000001",
    licensePlate: "SUP-001",
    make: "Ford",
    model: "F-150",
    year: 2021,
    color: "Black",
    capacity: 3,
    status: "available",
  },
  {
    areaName: "Maintenance",
    typeName: "Van",
    vin: "MNTVAN000001",
    licensePlate: "MNT-001",
    make: "Ford",
    model: "Transit",
    year: 2020,
    color: "White",
    capacity: 12,
    status: "available",
  },
  {
    areaName: "Maintenance",
    typeName: "Golf Cart",
    vin: "MNTGLF000001",
    licensePlate: "MNT-002",
    make: "Club Car",
    model: "Onward",
    year: 2023,
    color: "Red",
    capacity: 4,
    status: "maintenance",
  },
];

async function findByName(model, name) {
  return model.findOne({
    where: db.sequelize.where(db.sequelize.fn("LOWER", db.sequelize.col("name")), name.toLowerCase()),
  });
}

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

export async function seedFleet() {
  const typesByName = new Map();

  for (const type of TYPES) {
    const existing = await findByName(VehicleType, type.name);
    if (existing) {
      typesByName.set(type.name, existing);
      continue;
    }
    const created = await VehicleType.create({
      name: type.name,
      defaultPassengerCapacity: type.defaultPassengerCapacity,
      isActive: true,
    });
    typesByName.set(type.name, created);
  }

  for (const sample of VEHICLES) {
    const existing = await Vehicle.findOne({
      where: db.sequelize.where(db.sequelize.fn("LOWER", db.sequelize.col("vin")), sample.vin.toLowerCase()),
    });
    if (existing) {
      continue;
    }

    const area = await Area.findOne({ where: { name: sample.areaName } });
    if (!area) {
      throw new Error(`Area ${sample.areaName} was not found. Run the Feature 2 seed first.`);
    }

    const type = typesByName.get(sample.typeName);
    await Vehicle.create({
      areaId: area.id,
      vehicleTypeId: type.id,
      make: sample.make,
      model: sample.model,
      year: sample.year,
      vin: sample.vin,
      purchasedDate: "2020-01-15",
      color: sample.color,
      capacity: sample.capacity,
      licensePlate: sample.licensePlate,
      licensePlateExpireMonth: 6,
      currentMileage: 1000,
      status: sample.status,
    });
  }
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isDirectRun) {
  try {
    await db.sequelize.sync();
    await seed();
    await seedFleet();
    logger.info("Seed completed.");
  } catch (err) {
    logger.error(`Seed failed: ${err.message}`);
    process.exitCode = 1;
  } finally {
    await db.sequelize.close();
  }
}
