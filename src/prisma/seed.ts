import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Seed Roles
  const roles = [
    { name: 'Owner' },
    { name: 'Admin' },
    { name: 'Moderator' },
    { name: 'User' },
  ];

  for (const role of roles) {
    await prisma.role.upsert({
      where: { name: role.name },
      update: {},
      create: { name: role.name },
    });
  }

  console.log('Roles have been seeded successfully.');

  // Seed PostMethods
  const postMethods = [
    { name: 'Email', post_address: 'email@example.com' },
    { name: 'WhatsApp', post_address: 'https://wa.me/1234567890' },
    { name: 'Instagram', post_address: 'https://instagram.com/myprofile' },
    { name: 'Facebook', post_address: 'https://facebook.com/myprofile' },
  ];

  for (const method of postMethods) {
    await prisma.postMethod.upsert({
      where: { name: method.name },
      update: {},
      create: method,
    });
  }

  console.log('PostMethods have been seeded successfully.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
