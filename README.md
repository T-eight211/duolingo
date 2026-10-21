# 📃 Duolingo Clone: Learn Languages with Fun!

![Alt text](https://lingo.mohnd-code.com/hero.svg)

This project is a full-fledged Duolingo clone built with Next.js, Drizzle for data management, PostgresQL as the database, and Supabase for managed PostgreSQL. It provides a gamified and engaging platform for users to learn languages effectively.

- https://lingo.mohnd-code.com/

## 💻 Technologies Used:

- Frontend: Next.js (React framework)
- Backend: Drizzle (ORM for data management)
- Database: PostgreSQL (relational database)
- Authentication: Clerk (optional for secure login/registration)
- Payments: Stripe (optional for in-app purchases)

## 💡 Features

- 🌐 Next.js 16 & server actions
- 🗣 AI Voices using Elevenlabs AI
- 🎨 Beautiful component system using Shadcn UI
- 🎭 Amazing characters thanks to KenneyNL
- 🔐 Auth using Clerk
- 🔊 Sound effects
- ❤️ Hearts system
- 🌟 Points / XP system
- 💔 No hearts left popup
- 🚪 Exit confirmation popup
- 🔄 Practice old lessons to regain hearts
- 🏆 Leaderboard
- 🗺 Quests milestones
- 🛍 Shop system to exchange points with hearts
- 💳 Pro tier for unlimited hearts using Stripe
- 🏠 Landing page
- 📊 Admin dashboard React Admin
- 🌧 ORM using DrizzleORM
- 💾 PostgresDB using Supabase
- 📱 Mobile responsiveness

## ✏️ Requirements

Before you begin, ensure you have the following software installed on your local machine:

- Node.js 22 or newer and npm (or yarn): Used for managing project dependencies. Download from (https://nodejs.org/en)
- Git (optional): For version control. Download from (https://git-scm.com/downloads)

## 🤖 Commands

- `dev`: Starts the Next.js 16 development server with Turbopack and the Next.js Dev Tools menu: `npm run dev`.
- `typecheck`: Checks TypeScript with `npm run typecheck`.
- `lint`: Runs ESLint with `npm run lint`.
- `build`: Creates an optimized production build npm `npm run build`.
- `start`: Runs the production server `npm run start`.
- `db:studio`: Opens the Drizzle Kit Studio for database management `npx drizzle-kit studio`.
- `db:push`: Migrates the database schema to Postgres `npm run db:push`.
- `db:seed`: Seeds the database with initial data `tsx ./src/scripts/seed.ts`.
- `db:reset`: Resets the database schema `tsx ./src/scripts/reset.ts`.
- `db:prod`: Runs database migrations for the production environment `tsx ./src/scripts/prod.ts`.

## 🛠️ Installation

1. Clone the Repository:

```bash
git clone https://github.com/mohannadofficial/duolingo-nextjs.git
```

2. Install Dependencies:

```bash
cd duolingo-nextjs
npm install
```

3. Create a .env File:

- Create a .env file. Keep real credentials in .env, which is ignored by Git.
- Fill in the following environment variables with your own values:

```bash
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_clerk_key
CLERK_SECRET_KEY=your_clerk_secret_key
DATABASE_URL=your_postgres_connection_string
VERCELAI_GATEWAY_API_KEY=your_vercel_ai_gateway_key
STRIPE_API_KEY=your_stripe_api_key (optional)
STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret (optional)
NEXT_PUBLIC_APP_URL=your_app_url (optional for custom frontend URL)
```

4. Setup Clerk Authentication

- Follow Clerk's documentation to create a project and obtain your keys (https://clerk.com/docs/quickstarts/setup-clerk).
- Replace the placeholder values in .env with your actual keys.

5. Configure Supabase PostgreSQL

- Create a project in the [Supabase dashboard](https://supabase.com/dashboard).
- In **Connect**, copy the shared transaction-mode pooler connection string into `DATABASE_URL` in `.env`, replacing the password placeholder. URL-encode special characters in the password.
- The app uses Postgres.js with `prepare: false` for compatibility with transaction pooling. Keep the existing schema in `src/db/schema.ts`; you do not need the sample `users` table from the Supabase tutorial.
- Disable the Supabase Data API in the project's API settings if you only use this app's server-side Drizzle connection. If you enable the Data API, configure RLS and appropriate policies for exposed tables.
- Run `npm run db:push` to create the application tables. For migration operations, use a direct or session-mode connection if transaction pooling causes problems.
- On a new, empty database, run `npm run db:seed` to add starter content. **The seed, reset, and prod scripts delete existing application data.**
- The starter seed only adds lesson content for Spanish. Other seeded languages are placeholders and stay hidden from course selection until their first unit has lessons.
- Clerk remains the authentication provider; Supabase Auth is not required.

See [Supabase's Drizzle guide](https://supabase.com/docs/guides/database/drizzle).

6. Stripe Integration

- If you plan to use Stripe for in-app purchases, follow Stripe's documentation (https://docs.stripe.com/) to create an account and obtain your API keys.
- Set the STRIPE_API_KEY and STRIPE_WEBHOOK_SECRET environment variables accordingly.
- The /api/webhooks/stripe endpoint should handle Stripe webhook events (refer to Stripe's documentation for details).

## 🚀 Deployment on Vercel

1. Create a Vercel Account: Sign up for a free Vercel account at (https://vercel.com/).
2. Connect your GitHub Repository: Link your GitHub repository containing the Duolingo clone project to your Vercel account.
3. Import Project: Vercel will automatically detect your Next.js project and provide deployment options.
4. Configure Environment Variables: Set the required environment variables (listed in the Setup Instructions section) within Vercel's environment settings.
5. Deploy: Once configured, deploy your project to Vercel. Vercel will handle building and deploying the application.

## ⭐ Like this project?

If you find this Duolingo clone project helpful, consider giving it a star on GitHub to show your support! This helps others discover the project and motivates me to continue development.

## 🙌 Contributing

We welcome contributions from the community! Feel free to fork the repository, make changes, and create pull requests.

## 🔰 License

This project is licensed under the MIT License

## 📬 Feedback

If you have any feedback, please reach out to us at info@mohnd-info.com

## Arabic course

Arabic includes three beginner Modern Standard Arabic lessons (greetings, family, food and drink), with 12 multiple-choice challenges. Choose **Arabic** on `/courses`, then start a lesson on `/learn`. Completed lessons can be practiced again.

To add Arabic to an existing database, run `npm run db:arabic`. This command is safe to repeat and preserves existing courses and learner progress. It also repairs serial sequences left behind by older seeds that used explicit IDs. The regular seed scripts include Arabic too, but those scripts reset existing data.

Arabic answers use right-to-left text. These starter lessons are text-based; recorded Arabic audio is not included.

## Styling and dependency maintenance

Tailwind CSS v4 is configured in `src/app/globals.css` and uses `@tailwindcss/postcss`. Theme tokens, the dark variant, and animations live in that stylesheet; there is no `tailwind.config.ts`. The shadcn and Prettier configurations point to the same stylesheet.

Clerk uses its Core 3 `Show` component. Drizzle uses the PostgreSQL dialect and `dbCredentials.url` in the root `drizzle.config.ts`; `npm run db:push` is the current schema-sync command. Updating the packages does not require pushing or resetting the database.

The dependency refresh upgrades Tailwind to 4.3.3, Clerk to 7.9.17, Drizzle ORM/Kit to 0.45.4/0.31.11, and Sharp to 0.35.5. React 19.2, TypeScript 5, ESLint 9, and Zustand 4 remain on their existing compatible versions. Stripe remains pinned to its existing `2024-04-10` API contract; upgrading billing needs a separate webhook and checkout migration.

Validation included a production build, TypeScript, ESLint (one existing lesson-navigation warning), desktop/mobile component checks for buttons, modal animations, dark mode and Arabic vocabulary, schema SQL export, and a read-only Drizzle relationship query. Live sign-in and payment flows were not exercised. npm still reports transitive advisories in the admin UI and development tooling; its suggested major downgrades were not applied.


## Import Arabic vocabulary

In Arabic **Practice → Words**, use **Camera**, **Image**, or **PDF** to extract vocabulary. Camera requests the rear camera on supported devices and falls back to a file picker elsewhere. Supported files are JPEG, PNG, WebP and unlocked PDF, up to 20 MB; images are limited to 60 megapixels. An upload returns at most 100 words, phrases and sentences. Crop large notes or split long PDFs into smaller sections.

The server uses AI SDK 7 structured output through Vercel AI Gateway, explicitly authenticated with `VERCELAI_GATEWAY_API_KEY`. The default model is `google/gemini-4-argon`; set `VOCABULARY_AI_MODEL` to another Gateway model with image, PDF and structured-output support if needed. The Gateway account must have access and credits for that model. Node.js 22+ is required by AI SDK 7.

The AI prompt requests Modern Standard Arabic, English translations, full tashkeel, spelling and translation correction, original text, uncertainty flags, and sentence-to-word links. It performs no grammar classification. Model output is schema-validated; users review and edit it before **Add Words** saves anything. Photos/PDFs go to the Gateway for extraction and are not persisted by this app. Image metadata is removed before sending. Closing review keeps the draft in memory on that page; navigating away discards it.

For an existing database, run `npm run db:vocabulary` once to add the two vocabulary tables; it is safe to repeat. This additive setup preserves courses and progress. `user_vocabulary` holds private user/course-scoped entries, originals, correction flags and final edits. `user_vocabulary_links` preserves relationships between sentences/phrases and words. Both tables have RLS enabled with no browser/Data API grants or policies; Clerk-authorized server code uses the existing privileged Drizzle connection. Do not grant public API access without designing matching Clerk-aware policies.

Saving validates all entries before a single transaction. Duplicate bilingual pairs ignore tashkeel, tatweel, punctuation, spacing and English case, while retaining different contextual meanings and Arabic letter distinctions. Database uniqueness handles simultaneous/repeated saves. Duplicate words can gain links to additional sentences. A failed save rolls back entries and links together and keeps the editable draft. Saved vocabulary appears alongside the starter words; existing matching exercises continue to use their starter content.

### Verification

- `npm test`: upload validation, bilingual validation, duplicate normalization and sentence relationships; no network or credentials.
- `npm run typecheck`, `npm run lint`, `npm run build`: project checks.
- `npm run test:db`: integration test against `DATABASE_URL`; seeds synthetic users inside a transaction and rolls back every test record. Requires the new tables plus Arabic and another course.
- `postman simulation run postman/simulations/vocabulary.sim.yaml --port 4911 --no-history`, then `npm run test:gateway` in another terminal: runs the real SDK over local HTTP for image/PDF inputs, valid/invalid structured responses, duplicate IDs, uncertainty, access failures, rate limits and timeout handling. Stop the simulation with Ctrl-C.

The local Postman fixture models the installed Gateway LanguageModelV4 protocol; it does not call a real model or assess Arabic translation accuracy. No Postman cloud workspace or published mock is required. Browser checks also exercised review/edit/remove, retained drafts, validation, save failure/retry, final edited payloads, Arabic RTL, English LTR and mobile layout with synthetic data. A live synthetic Gateway test reached the service but was rejected with HTTP 403 (`no_providers_available`, free-tier model access/credits); live extraction accuracy remains unverified until the account has access.
