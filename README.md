# DeMolay Petitioners' Quiz

A minimalist, bold quiz app for DeMolay petitioners. Next.js + [Payload CMS](https://payloadcms.com), with Google sign-in. It runs entirely on free tiers: **Netlify** (hosting), **Turso** (database) and **Google** (sign-in).

**Players** sign in with a Google account (required), enter their name and chapter **once**, then answer every question in random order, 15 seconds each (the time is a setting). At the end they see their score and every question they missed, with the correct answer. They can retake the quiz as often as they like; every attempt is saved to their account, starting from attempt 1.

**Admins** sign in at `/admin` to edit questions, answers, the logo and the timer, and to see every player and their scores. Nothing else is reachable: questions, answers, players and results are locked behind the admin login.

## What is in the box

| Admin screen      | What it holds                                                                               |
| ----------------- | ------------------------------------------------------------------------------------------- |
| **Questions**     | The question bank. Edit text, options and which option is correct at any time.              |
| **Players**       | Everyone who signed in: name, chapter, email, and a **Scores** array (one row per attempt). |
| **Attempts**      | Every quiz run with its answers. Read-only.                                                 |
| **Quiz settings** | Title, subtitle, **logo upload**, and seconds per question.                                 |
| **Media**         | Uploaded images. Files are stored inside the database, so no separate storage is needed.    |
| **Users**         | Admin accounts.                                                                             |

80 questions from the A. Mabini Chapter petitioners' exam are included in `seed/questions.json`, each tagged with where its answer came from (exam key, the Petitioner's Handbook, the web, or general knowledge). Anything tagged "General knowledge" deserves a quick review. To add more later, use **Questions → Create New** in the admin.

## Run it locally

```bash
npm install
cp .env.example .env        # then set PAYLOAD_SECRET (openssl rand -hex 32) and the Google values
npm run migrate             # creates the local database file, local.db
npm run seed                # loads the 80 questions
npm run dev                 # http://localhost:3000  (admin: /admin)
```

Locally the database is a plain file (`local.db`). Delete it and run `migrate` and `seed` again to start fresh. Locally, `/admin` lets you create the first admin freely.

## Set up Google sign-in

Players log in with Google. You create a free OAuth client once:

1. In [Google Cloud Console](https://console.cloud.google.com) create a project, then open **Google Auth Platform**.
2. **Branding:** set the app name players will see (for example `Petitioners' Quiz`) and a support email.
3. **Audience:** choose **External**, then **Publish app** so anyone with a Google account can sign in. (In "Testing" only listed test users can.) The default scopes `openid`, `email`, `profile` need no Google review.
4. **Clients → Create client → Web application.** Under **Authorized redirect URIs** add:
   - `http://localhost:3000/auth/google/callback` (local)
   - `https://<your-site>.netlify.app/auth/google/callback` (once you know your Netlify address)
5. Copy the **Client ID** and **Client secret** into `.env` locally (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`).

## Deploy for free (Netlify + Turso)

Free-tier limits change, so check them before you rely on them. When this was set up: Netlify's free plan gives 300 credits a month with a hard cap (each production deploy costs about 15 credits, so deploy sparingly; if the credits run out the site pauses instead of charging you), and Turso's free plan gives 5 GB and 500 million row reads a month.

### 1. Create the database (Turso)

Sign up at [turso.tech](https://turso.tech), then either use the dashboard or the CLI:

```bash
brew install tursodatabase/tap/turso
turso auth login
turso db create demolay-quiz
turso db show demolay-quiz --url          # copy the libsql://... address
turso db tokens create demolay-quiz       # copy the token
```

### 2. Connect the repository (Netlify)

Import the GitHub repository in Netlify. The build settings come from `netlify.toml`, so leave them alone. In particular **Publish directory must not be `build`**. `netlify.toml` sets it to `.next`, which overrides the dashboard value.

### 3. Add environment variables

In **Site configuration → Environment variables**, add:

| Variable               | Value                                                                                |
| ---------------------- | ------------------------------------------------------------------------------------ |
| `PAYLOAD_SECRET`       | A long random string: `openssl rand -hex 32`. Keep it private.                       |
| `DATABASE_URI`         | The `libsql://...` address from Turso.                                               |
| `DATABASE_AUTH_TOKEN`  | The Turso token.                                                                     |
| `ADMIN_EMAILS`         | Your email (comma separated for more than one). **Required:** in production nobody can create an admin account unless their email is on this list. |
| `GOOGLE_CLIENT_ID`     | From Google.                                                                         |
| `GOOGLE_CLIENT_SECRET` | From Google. Mark it as a secret.                                                    |
| `APP_URL`              | Your site's address, for example `https://your-site.netlify.app` (no trailing slash). |

### 4. Deploy

Push to GitHub. Netlify runs `npm run build:netlify`, which creates or updates the tables in Turso and then builds the site. If Turso answers the migration with a brief error (a 502 while an idle database wakes up), the step retries up to 4 times before the deploy fails.

### 5. Load the questions

From your computer, once, pointing at the live database (do not commit these values):

```bash
DATABASE_URI="libsql://..." DATABASE_AUTH_TOKEN="..." npm run seed
```

### 6. Finish

1. Add `https://<your-site>.netlify.app/auth/google/callback` to the Google client's **Authorized redirect URIs**.
2. Open `https://<your-site>.netlify.app/admin`, create your admin account (using an email from `ADMIN_EMAILS`), and open **Quiz settings** to upload your logo.

To use your own domain, add it in Netlify's **Domain management**, update `APP_URL`, and add the new callback address in Google.

### After you change the data model

If you edit the collections in `src/collections/`, create a migration. The next deploy applies it automatically.

```bash
npm run migrate:create -- describe_the_change
npm run migrate          # apply it to your local database
```

## How it works

- **Sign-in.** Google's authorization-code flow with PKCE. The server checks the ID token's signature, issuer, audience, expiry and nonce, and that the email is verified, then sets a signed, HTTP-only session cookie (30 days). Any Google account works.
- **Name and chapter are asked once**, right after the first login, and are then locked. An admin can correct them on the **Players** screen.
- **Scores.** When a quiz finishes, one row is added to that player's **Scores** array (attempt number, score, total, percent, date). The player's home screen lists every attempt, and each opens its own result with the missed questions.
- **Random, complete quiz.** The server shuffles all active questions (and the option order, except where a question is marked "Keep option order") and stores that order. There is no skipping and no going back. An unfinished attempt is resumed, not restarted.
- **The timer is enforced on the server.** The browser shows the countdown, but the server records when each question was served. Answers that arrive after the time (plus 1.5 s for network delay) count as "time is up". Reloading resumes the same question with the time that was left.
- **Answers never reach the browser early.** The player only receives question text and options. Correctness is decided on the server, and correct answers are only sent on the results page.
- **Always fresh.** Pages render on every request, so changes in the admin (title, logo, timer, questions) show up straight away. The browser tab title and description follow Quiz settings.
- **Only questions ticked "Show in quiz" that have exactly one correct option are asked.** The admin form will not let you save an active question without a correct answer.
- **The logo lives in the database.** Uploads are capped at 2 MB and limited to PNG, JPEG, WebP and GIF.

## Editing questions

Open **Questions** in the admin. Each question has its options as rows; tick **Correct answer** on exactly one. Untick **Show in quiz** to hide a question without deleting it. The **Admin note** field is never shown to players; the seed uses it to record where each answer came from.

## Scripts

| Command                          | Does                                                                                                                      |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `npm run dev`                    | Local dev server                                                                                                          |
| `npm test`                       | Unit tests (quiz rules, Google token checks, sessions, admin sign-up rule, file storage)                                  |
| `npm run migrate`                | Apply database migrations (local file, or Turso when `DATABASE_URI` is set)                                               |
| `npm run migrate:create -- name` | Create a migration after changing collections                                                                             |
| `npm run seed`                   | Load `seed/questions.json`. Existing questions are never overwritten; use `SEED_OVERWRITE=1` to reset them               |
| `npm run build:netlify`          | What Netlify runs: migrate (with retries), then build                                                                     |

## Notes

- **Privacy.** The app stores each player's Google email, name and chapter, and their scores. DeMolay members are 12 to 21, so make sure your chapter or Supreme Council is comfortable with that under the Philippine Data Privacy Act, and consider adding a consent line. Deleting a player in the admin removes their record.
- The DeMolay emblem is a registered mark and is not bundled. Upload your own logo in **Quiz settings**.
- Deleting an attempt in the admin does not remove that attempt's row from the player's Scores array; delete the player to remove everything.
- Admin logins lock for 10 minutes after 5 failed attempts.
- The site favicon files in `src/app/` were generated from the chapter logo. Replace `icon.png`, `apple-icon.png` and `favicon.ico` to change them.
