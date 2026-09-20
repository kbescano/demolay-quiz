# DeMolay Petitioners' Quiz

A minimalist, bold quiz app for DeMolay petitioners. Next.js + [Payload CMS](https://payloadcms.com), running on **Cloudflare Workers** with **D1** (database) and **R2** (logo storage).

**Players** sign in with a Google account (required), enter their name and chapter **once**, then answer every question in random order, 15 seconds each. At the end they see their score and every question they missed, with the correct answer. They can retake the quiz as often as they like; every attempt is saved to their account, starting from attempt 1.

**Admins** sign in at `/admin` to edit questions, answers, the logo and the timer, and to see every player and their scores. Nothing else is reachable: questions, answers, players and results are locked behind the admin login.

## What is in the box

| Admin screen      | What it holds                                                                                   |
| ----------------- | ----------------------------------------------------------------------------------------------- |
| **Questions**     | The question bank. Edit text, options and which option is correct at any time.                  |
| **Players**       | Everyone who signed in: name, chapter, email, and a **Scores** array (one row per attempt).     |
| **Attempts**      | Every quiz run with its answers. Read-only.                                                     |
| **Quiz settings** | Title, subtitle, **logo upload**, and seconds per question (default 15).                        |
| **Media**         | Uploaded images (stored in R2).                                                                 |
| **Users**         | Admin accounts.                                                                                 |

80 questions from the A. Mabini Chapter petitioners' exam are included in `seed/questions.json`, each tagged with where its answer came from (exam key, the Petitioner's Handbook, the web, or general knowledge). Anything tagged "General knowledge" deserves a quick review. Only these 80 exist in the app. To add more later, use **Questions → Create New** in the admin.

## Set up Google sign-in

Players log in with Google. You create a free OAuth client once:

1. In [Google Cloud Console](https://console.cloud.google.com) create a project, then open **Google Auth Platform**.
2. **Branding:** set the app name players will see (for example `Petitioners' Quiz`) and a support email.
3. **Audience:** choose **External**, then **Publish app** so anyone with a Google account can sign in. (In "Testing" only listed test users can.) The default scopes `openid`, `email`, `profile` need no Google review.
4. **Clients → Create client → Web application.** Under **Authorized redirect URIs** add:
   - `http://localhost:3000/auth/google/callback` (local)
   - `https://<your-worker-address>/auth/google/callback` (after you deploy; each address must match exactly)
5. Copy the **Client ID** and **Client secret**.

Locally, put them in `.env` as `GOOGLE_CLIENT_ID=...` and `GOOGLE_CLIENT_SECRET=...`.

## Run it locally

```bash
npm install
cp .env.example .env        # then set PAYLOAD_SECRET (openssl rand -hex 32) and the Google values
npm run payload -- migrate  # create the local database
npm run seed                # load the 80 questions
npm run dev                 # http://localhost:3000  (admin: /admin)
```

Locally, `/admin` lets you create the first admin freely. Local data lives in `.wrangler/` and never touches Cloudflare.

## Deploy to Cloudflare

You need a Cloudflare account on the **Workers Paid plan** (about US$5 per month). The app bundles to about 4.5 MB compressed, over the 3 MB free-plan limit.

```bash
npx wrangler login

npx wrangler d1 create demolay-quiz          # copy the database_id it prints
npx wrangler r2 bucket create demolay-quiz
```

1. Put the `database_id` into `wrangler.jsonc` (`d1_databases`).
2. In `wrangler.jsonc`, under `vars`, set:
   - `ADMIN_EMAILS` to your email (comma separated for more than one). **Required:** in production nobody can create an admin account unless their email is on this list.
   - `GOOGLE_CLIENT_ID` to your Google client ID (it is not secret).
3. Set the two secrets:

   ```bash
   openssl rand -hex 32 | npx wrangler secret put PAYLOAD_SECRET   # signs sessions; keep it private
   npx wrangler secret put GOOGLE_CLIENT_SECRET                    # paste the Google client secret when asked
   ```

4. Migrate the database and deploy:

   ```bash
   npm run deploy
   ```

5. Load the questions into the live database:

   ```bash
   npm run seed:remote
   ```

6. Add your live address to the Google client's **Authorized redirect URIs**: `https://<your-worker>.workers.dev/auth/google/callback`.
7. Open `https://<your-worker>.workers.dev/admin`, create your admin account (using the email from step 2), then go to **Quiz settings** to upload your logo.

To use your own domain, add it to the Worker under **Workers & Pages → demolay-quiz → Settings → Domains & Routes**, and add that address to the Google redirect URIs too.

### After you change the data model

If you edit the collections in `src/collections/`, create a new migration and deploy it:

```bash
npm run migrate:create -- describe_the_change
npm run deploy
```

## How it works

- **Sign-in.** Google's authorization-code flow with PKCE. The server checks the ID token's signature, issuer, audience, expiry and nonce, and that the email is verified, then sets a signed, HTTP-only session cookie (30 days). Any Google account works.
- **Name and chapter are asked once**, right after the first login, and are then locked. An admin can correct them on the **Players** screen.
- **Scores.** When a quiz finishes, one row is added to that player's **Scores** array (attempt number, score, total, percent, date). The player's home screen lists every attempt, and each opens its own result with the missed questions.
- **Random, complete quiz.** The server shuffles all active questions (and the option order, except where a question is marked "Keep option order") and stores that order. There is no skipping and no going back. An unfinished attempt is resumed, not restarted.
- **The timer is enforced on the server.** The browser shows the countdown, but the server records when each question was served. Answers that arrive after the time (plus 1.5 s for network delay) count as "time is up". Reloading resumes the same question with the time that was left.
- **Answers never reach the browser early.** The player only receives question text and options. Correctness is decided on the server, and correct answers are only sent on the results page.
- **Only questions ticked "Show in quiz" that have exactly one correct option are asked.** The admin form will not let you save an active question without a correct answer.

## Editing questions

Open **Questions** in the admin. Each question has its options as rows; tick **Correct answer** on exactly one. Untick **Show in quiz** to hide a question without deleting it. The **Admin note** field is never shown to players; the seed uses it to record where each answer came from.

## Scripts

| Command                          | Does                                                                                                                      |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `npm run dev`                    | Local dev server                                                                                                          |
| `npm test`                       | Unit tests (quiz rules, Google token checks, sessions, admin sign-up rule)                                                |
| `npm run seed` / `seed:remote`   | Load `seed/questions.json` (local / live). Existing questions are never overwritten; use `SEED_OVERWRITE=1` to reset them |
| `npm run deploy`                 | Migrate the live D1 database, then build and deploy the Worker                                                            |
| `npm run preview`                | Build and run the Worker locally in the Workers runtime                                                                   |
| `npm run migrate:create -- name` | Create a database migration after changing collections                                                                    |

## Notes

- **Privacy.** The app stores each player's Google email, name and chapter, and their scores. DeMolay members are 12 to 21, so make sure your chapter or Supreme Council is comfortable with that under the Philippine Data Privacy Act, and consider adding a consent line. Deleting a player in the admin removes their record.
- The DeMolay emblem is a registered mark and is not bundled. Upload your own logo in **Quiz settings**.
- Deleting an attempt in the admin does not remove that attempt's row from the player's Scores array; delete the player to remove everything.
- Admin logins lock for 10 minutes after 5 failed attempts.
