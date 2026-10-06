import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadEnv } from 'dotenv';
import { createPrismaClient } from '../dist/index.js';

const dirname = path.dirname(fileURLToPath(import.meta.url));
loadEnv({ path: path.resolve(dirname, '../../../.env'), quiet: true });

const INTERESTS = {
  'Spor ve Aktivite': [
    ['fitness', 'Fitness'],
    ['yoga', 'Yoga'],
    ['running', 'Koşu'],
    ['hiking', 'Doğa yürüyüşü'],
    ['cycling', 'Bisiklet'],
    ['swimming', 'Yüzme'],
    ['football', 'Futbol'],
    ['basketball', 'Basketbol'],
    ['tennis', 'Tenis'],
    ['climbing', 'Tırmanış'],
  ],
  'Sanat ve Kültür': [
    ['music', 'Müzik'],
    ['concerts', 'Konserler'],
    ['cinema', 'Sinema'],
    ['theatre', 'Tiyatro'],
    ['photography', 'Fotoğrafçılık'],
    ['painting', 'Resim'],
    ['reading', 'Kitap okumak'],
    ['writing', 'Yazmak'],
    ['museums', 'Müzeler'],
    ['dance', 'Dans'],
  ],
  'Yeme İçme': [
    ['cooking', 'Yemek yapmak'],
    ['coffee', 'Kahve'],
    ['wine', 'Şarap'],
    ['street-food', 'Sokak lezzetleri'],
    ['vegan', 'Vegan mutfak'],
    ['baking', 'Pasta ve fırın'],
  ],
  'Yaşam Tarzı': [
    ['travel', 'Seyahat'],
    ['camping', 'Kamp'],
    ['pets', 'Evcil hayvanlar'],
    ['gardening', 'Bahçecilik'],
    ['meditation', 'Meditasyon'],
    ['volunteering', 'Gönüllülük'],
    ['fashion', 'Moda'],
  ],
  'Teknoloji ve Oyun': [
    ['gaming', 'Video oyunları'],
    ['board-games', 'Kutu oyunları'],
    ['technology', 'Teknoloji'],
    ['science', 'Bilim'],
    ['podcasts', 'Podcast'],
    ['anime', 'Anime'],
  ],
};

const prisma = createPrismaClient(process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL);

let sortOrder = 0;
for (const [category, items] of Object.entries(INTERESTS)) {
  for (const [slug, name] of items) {
    sortOrder += 1;
    await prisma.interest.upsert({
      where: { slug },
      update: { name, category, sortOrder },
      create: { slug, name, category, sortOrder },
    });
  }
}

console.log(`Seeded ${sortOrder} interests.`);
await prisma.$disconnect();
