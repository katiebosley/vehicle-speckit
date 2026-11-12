import path from "path";
import { pathToFileURL } from "url";
import db from "../app/models/index.js";

const Area = db.area;
const VehicleType = db.vehicleType;
const Vehicle = db.vehicle;

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
  seedFleet()
    .then(async () => {
      await db.sequelize.close();
    })
    .catch(async (err) => {
      console.error(err.message);
      await db.sequelize.close();
      process.exit(1);
    });
}
