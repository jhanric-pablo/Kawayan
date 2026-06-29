import { DatabaseService } from './services/databaseService';
import { BrandProfile, GeneratedPost } from './types';
import { logger } from './utils/logger';

async function seed() {
  console.log('🌱 Seeding database...');
  const dbService = new DatabaseService();

  try {
    // 1. Create Users
    const users = [
      { email: 'admin@kawayan.ph', password: 'Admin123!', role: 'admin' as const, businessName: 'Kawayan Admin' },
      { email: 'support@kawayan.ph', password: 'Support123!', role: 'support' as const, businessName: 'Kawayan Support' },
      { email: 'cafe@kawayan.ph', password: 'Password123!', role: 'user' as const, businessName: 'Kapihan sa Nayon' },
      { email: 'bakery@kawayan.ph', password: 'Password123!', role: 'user' as const, businessName: 'Panaderia de Manila' },
      { email: 'tech@kawayan.ph', password: 'Password123!', role: 'user' as const, businessName: 'Gadget Hub PH' },
      { email: 'fashion@kawayan.ph', password: 'Password123!', role: 'user' as const, businessName: 'Manila Threads' },
      { email: 'food@kawayan.ph', password: 'Password123!', role: 'user' as const, businessName: 'Lutong Bahay Express' }
    ];

    const createdUsers = [];
    for (const u of users) {
      try {
        const user = await dbService.createUser(u.email, u.password, u.role, u.businessName);
        if (user) {
          console.log(`✓ Created user: ${u.email}`);
          createdUsers.push(user);
        } else {
          // If user exists, fetch it
          const db = (dbService as any).dbConfig.getDatabase();
          const existing = db.prepare('SELECT id, email, role, business_name FROM users WHERE email = ?').get(u.email);
          console.log(`- User already exists: ${u.email}`);
          createdUsers.push({
            id: existing.id,
            email: existing.email,
            role: existing.role,
            businessName: existing.business_name
          });
        }
      } catch (e) {
        // If it failed due to validation or something else, but user exists, fetch it
        const db = (dbService as any).dbConfig.getDatabase();
        const existing = db.prepare('SELECT id, email, role, business_name FROM users WHERE email = ?').get(u.email);
        if (existing) {
          console.log(`- User already exists (after error): ${u.email}`);
          createdUsers.push({
            id: existing.id,
            email: existing.email,
            role: existing.role,
            businessName: existing.business_name
          });
        } else {
          throw e;
        }
      }
    }

    // 2. Create Brand Profiles for Users
    const profiles = [
      {
        id: 'prof-cafe',
        userId: createdUsers[2].id, // cafe
        businessName: 'Kapihan sa Nayon',
        industry: 'Food & Beverage',
        targetAudience: 'Locals, students, and remote workers looking for a cozy place.',
        brandVoice: 'Warm, welcoming, and community-focused.',
        keyThemes: 'Freshly brewed coffee, local pastries, cozy ambiance, community.'
      },
      {
        id: 'prof-bakery',
        userId: createdUsers[3].id, // bakery
        businessName: 'Panaderia de Manila',
        industry: 'Bakery',
        targetAudience: 'Families and commuters who love traditional Filipino bread.',
        brandVoice: 'Nostalgic, authentic, and appetizing.',
        keyThemes: 'Hot pandesal, traditional recipes, family traditions, morning energy.'
      },
      {
        id: 'prof-tech',
        userId: createdUsers[4].id, // tech
        businessName: 'Gadget Hub PH',
        industry: 'Electronics',
        targetAudience: 'Tech enthusiasts and value-conscious gadget seekers.',
        brandVoice: 'Expert, trendy, and helpful.',
        keyThemes: 'Latest tech, value for money, expert reviews, digital lifestyle.'
      },
      {
        id: 'prof-fashion',
        userId: createdUsers[5].id, // fashion
        businessName: 'Manila Threads',
        industry: 'Fashion',
        targetAudience: 'Fashion-forward young adults.',
        brandVoice: 'Stylish, bold, and energetic.',
        keyThemes: 'Local design, sustainable fashion, street style.'
      },
      {
        id: 'prof-food',
        userId: createdUsers[6].id, // food
        businessName: 'Lutong Bahay Express',
        industry: 'Food & Beverage',
        targetAudience: 'Busy professionals and students.',
        brandVoice: 'Homely, reliable, and delicious.',
        keyThemes: 'Home-cooked meals, quick delivery, affordable nutrition.'
      }
    ];

    for (const p of profiles) {
      await dbService.saveProfile(p as BrandProfile);
      console.log(`✓ Created profile for: ${p.businessName}`);
    }

    // 2b. Auto-verify seeded SME users (legacy accounts without verification records)
    const adminId = createdUsers[0].id;
    for (const user of createdUsers.slice(2)) {
      const existingVerif = await dbService.getVerification(user.id);
      if (!existingVerif) {
        await dbService.submitVerification(
          user.id,
          'Manila, Philippines',
          '+639000000000',
          'seed-business-permit.pdf',
          'seed-business-permit.pdf'
        );
        const verif = await dbService.getVerification(user.id);
        if (verif) {
          await dbService.approveVerification(verif.id, adminId);
          console.log(`✓ Auto-verified seeded user: ${user.email}`);
        }
      }
    }

    // 3. Create Generated Posts (Past, Present, Future)
    const today = new Date();
    const months = [-2, -1, 0, 1]; // Last two months, current month, next month
    
    for (const user of createdUsers.slice(2)) { // Only for regular users
      console.log(`Generating posts for ${user.email}...`);
      for (const m of months) {
        const date = new Date(today);
        date.setMonth(today.getMonth() + m);
        
        const postsCount = m < 0 ? 8 : 4; // More posts in the past
        for (let i = 0; i < postsCount; i++) {
          const postDate = new Date(date);
          postDate.setDate(1 + i * 3);
          
          const status = postDate < today ? 'Published' : (i % 2 === 0 ? 'Scheduled' : 'Draft');
          
          const post: GeneratedPost = {
            id: `seed-post-${user.id}-${m}-${i}`,
            userId: user.id,
            date: postDate.toISOString().split('T')[0],
            topic: `Topic ${i+1} for month ${m}`,
            caption: `This is a sample caption for ${user.businessName}. We are excited to share this update about ${m === 0 ? 'this month' : 'our journey'}. #KawayanAI #SMEPH`,
            imagePrompt: `A high quality photo of ${user.businessName} products, professional lighting, social media style`,
            imageUrl: `https://picsum.photos/seed/${user.id}${m}${i}/800/800`,
            status: status as any,
            viralityScore: Math.floor(Math.random() * 40) + 50, // 50-90
            viralityReason: 'Strong emotional hook and trending keywords.',
            format: i % 2 === 0 ? 'Image' : 'Carousel',
            regenCount: 0,
            history: []
          };
          
          await dbService.savePost(post);
        }
      }
      console.log(`✓ Created sample posts for: ${user.email}`);
    }

    // 4. Create Content Plans
    for (const user of createdUsers.slice(2)) {
      const currentMonthName = today.toLocaleString('default', { month: 'long' });
      const ideas = [
        { day: 5, title: 'Morning Special', topic: 'Highlighting our morning bestsellers', format: 'Image' },
        { day: 12, title: 'Behind the Scenes', topic: 'How we prepare our signature products', format: 'Video' },
        { day: 20, title: 'Customer Spotlight', topic: 'Featuring a happy customer of the week', format: 'Carousel' },
        { day: 28, title: 'Weekend Promo', topic: 'Upcoming weekend discount announcement', format: 'Image' }
      ];
      
      await dbService.savePlan(user.id, currentMonthName, ideas);
      console.log(`✓ Created content plan for: ${user.email} (${currentMonthName})`);
    }

    // 5. Create Transactions
    console.log('Generating transactions...');
    const db = (dbService as any).dbConfig.getDatabase();
    for (const user of createdUsers.slice(2)) {
      // Ensure wallet exists
      const wallet = db.prepare('SELECT user_id FROM wallets WHERE user_id = ?').get(user.id);
      if (!wallet) {
        db.prepare('INSERT INTO wallets (user_id, balance, currency, subscription) VALUES (?, ?, ?, ?)').run(user.id, 0, 'PHP', 'FREE');
      }

      // Completed Credits
      const compId = `seed_txn_comp_${user.id}_${Date.now()}`;
      db.prepare("INSERT INTO transactions (id, user_id, description, amount, status, type) VALUES (?, ?, ?, ?, ?, ?)").run(
        compId, user.id, 'Top-up via Xendit', 1000 + Math.random() * 5000, 'COMPLETED', 'CREDIT'
      );
      // Update balance manually for completed ones
      db.prepare('UPDATE wallets SET balance = balance + ? WHERE user_id = ?').run(1000, user.id);

      // Pending
      const pendId = `seed_txn_pend_${user.id}_${Date.now()}`;
      db.prepare("INSERT INTO transactions (id, user_id, description, amount, status, type) VALUES (?, ?, ?, ?, ?, ?)").run(
        pendId, user.id, 'Pending Xendit Invoice', 500, 'PENDING', 'CREDIT'
      );

      // Cancelled
      const cancelId = `seed_txn_cancel_${user.id}_${Date.now()}`;
      db.prepare("INSERT INTO transactions (id, user_id, description, amount, status, type) VALUES (?, ?, ?, ?, ?, ?)").run(
        cancelId, user.id, 'Cancelled Manual Top-up', 200, 'CANCELLED', 'CREDIT'
      );
    }
    console.log('✓ Transactions seeded');

    // 6. Create Support Tickets
    console.log('Generating support tickets...');
    const ticketSubjects = [
      { subject: 'Extension sync not working', category: 'Technical' },
      { subject: 'Billing issue — wallet top-up', category: 'Billing' },
      { subject: 'Slow calendar load', category: 'Technical' },
      { subject: 'General inquiry', category: 'General' },
    ];
    for (let i = 0; i < 5; i++) {
      const user = createdUsers[2 + (i % (createdUsers.length - 2))];
      const ticketId = `seed-ticket-${user.id}-${Date.now()}-${i}`;
      const meta = ticketSubjects[i % ticketSubjects.length];
      const ticketNum = await dbService.getNextTicketNum();
      const ticket = {
        id: ticketId,
        ticketNum,
        userId: user.id,
        userEmail: user.email,
        subject: meta.subject,
        category: meta.category,
        priority: i === 0 ? 'Critical' : 'Medium',
        status: i % 2 === 0 ? 'Open' : 'Pending',
        createdAt: new Date().toISOString(),
        messages: [{ sender: 'user', text: 'Help me with my account!', timestamp: new Date().toISOString() }]
      };
      await dbService.createTicket(ticket);
    }
    console.log('✓ Tickets seeded');

    // 7. Create Audit Logs
    console.log('Generating audit logs...');
    const actions = ['login', 'update_profile', 'create_post', 'topup_wallet', 'resolve_ticket'];
    for (let i = 0; i < 15; i++) {
      const user = createdUsers[i % createdUsers.length];
      const logId = `seed-log-${user.id}-${Date.now()}-${i}`;
      db.prepare("INSERT INTO audit_logs (id, user_id, action, details, timestamp) VALUES (?, ?, ?, ?, ?)").run(
        logId, 
        user.id, 
        actions[i % actions.length], 
        `Seeded activity for ${user.email}`, 
        new Date(Date.now() - i * 3600000).toISOString()
      );
    }
    console.log('✓ Audit logs seeded');

    console.log('\n✅ Database seeded successfully!');
  } catch (error) {
    console.error('❌ Seeding failed:', error);
  } finally {
    await dbService.close();
  }
}

seed();
