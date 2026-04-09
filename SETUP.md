# CageLeague — Setup Guide

Follow these steps in order. The whole process takes about 30–45 minutes.
You need: a computer, a GitHub account, and an internet connection.

---

## PART 1 — Install the tools you need

### 1.1 Install Node.js
1. Go to https://nodejs.org
2. Download the **LTS** version (the left green button)
3. Run the installer, click through all the defaults
4. To verify it worked: open Terminal (Mac) or Command Prompt (Windows) and type:
   ```
   node --version
   ```
   You should see something like `v20.11.0`. If you do, you're good.

### 1.2 Install Git
1. Go to https://git-scm.com/downloads
2. Download and install for your operating system
3. Verify: in Terminal, type `git --version`

---

## PART 2 — Create a Supabase project (your database)

1. Go to https://supabase.com and click **Start your project**
2. Sign up with GitHub (easiest) or email
3. Click **New project**
4. Fill in:
   - **Organization**: your name or anything
   - **Project name**: `cagelague`
   - **Database password**: create a strong password and **save it somewhere** — you'll need it
   - **Region**: pick the closest to you (US East if you're on the east coast)
5. Click **Create new project** — it takes about 2 minutes to set up

### 2.1 Set up the database tables

Once your project is ready:

1. In the left sidebar, click **SQL Editor**
2. Click **+ New query**
3. Open the file `supabase/migrations/001_initial.sql` from this project
4. Copy the entire contents and paste it into the SQL editor
5. Click **Run** (the green button) — you should see "Success. No rows returned"
6. Repeat for `supabase/migrations/002_seed_data.sql`

### 2.2 Get your API keys

1. In the left sidebar, click **Project Settings** (gear icon at the bottom)
2. Click **API**
3. You'll see two keys — copy and save both:
   - **Project URL** (looks like `https://abcdefgh.supabase.co`)
   - **anon / public key** (long string starting with `eyJ...`)
   - **service_role key** (another long string — keep this secret)

---

## PART 3 — Get the code running locally

### 3.1 Open the project folder

1. Put the `cagelague` folder somewhere on your computer (like your Desktop)
2. Open Terminal (Mac: press Cmd+Space, type Terminal) or Command Prompt (Windows)
3. Navigate to the folder:
   ```
   cd Desktop/cagelague
   ```
   (adjust the path if you put it somewhere else)

### 3.2 Set up your environment variables

1. In the `cagelague` folder, find the file called `.env.example`
2. Make a copy of it and name the copy `.env.local`
3. Open `.env.local` in a text editor (Notepad works, VS Code is better)
4. Fill in your values from Step 2.2:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...your anon key...
   SUPABASE_SERVICE_ROLE_KEY=eyJ...your service role key...
   ```
5. Save the file

### 3.3 Install dependencies and run the app

In Terminal, from the `cagelague` folder, run these commands one at a time:

```bash
npm install
```
(this installs all the code libraries — takes 1–2 minutes)

```bash
npm run dev
```

You should see:
```
▲ Next.js 14.1.0
- Local: http://localhost:3000
```

Open your browser and go to **http://localhost:3000** — you should see the login page.

---

## PART 4 — Create your commissioner account

1. Go to https://supabase.com and open your project
2. In the left sidebar, click **Authentication** → **Users**
3. Click **Invite user** (or **Add user** depending on your version)
4. Enter your own email and a password
5. Click **Create user**

Now make yourself commissioner:

1. Go back to **SQL Editor**
2. Open and run `supabase/migrations/003_make_commissioner.sql`
3. **Replace** `your-email@example.com` with your actual email before running

Now go back to http://localhost:3000, log in with your email and password, and you should see the **Commissioner** tab.

---

## PART 5 — Set up your league in the app

Do this from the Commissioner tab in the app:

### 5.1 Rename your teams
1. Go to Supabase → **Table Editor** → `fantasy_teams`
2. Click on each team row and update `name`, `owner_name`, and `icon` to match your real teams

### 5.2 Create accounts for your league mates
1. In the app, click **Commissioner** → **Manage Users**
2. For each person, enter their display name, email, a temporary password, and assign them to their team
3. Text them their email and password — they go to your site URL and sign in
4. They can change their password by... (for v1, they'll need to ask you — password change UI can be added later)

### 5.3 Update the schedule (optional)
The default schedule has 3 bye/double-header weeks (weeks 3, 5, and 9) built in.
If you want different weeks or different teams, edit the `week_schedule` and `matchups` tables directly in Supabase Table Editor.

---

## PART 6 — Deploy to the internet (Vercel)

So far the app only runs on your computer. To make it available for everyone:

### 6.1 Push to GitHub

1. Go to https://github.com and create a new repository called `cagelague`
2. Make it **Private**
3. In Terminal, from your `cagelague` folder:
   ```bash
   git init
   git add .
   git commit -m "initial commit"
   git remote add origin https://github.com/YOUR_USERNAME/cagelague.git
   git push -u origin main
   ```
   (replace YOUR_USERNAME with your GitHub username)

### 6.2 Deploy on Vercel

1. Go to https://vercel.com and sign up with GitHub
2. Click **Add New Project**
3. Find and select your `cagelague` repository
4. Click **Import**
5. Before clicking Deploy, click **Environment Variables** and add all three:
   - `NEXT_PUBLIC_SUPABASE_URL` → your Supabase project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` → your anon key
   - `SUPABASE_SERVICE_ROLE_KEY` → your service role key
6. Click **Deploy**

After 1–2 minutes, Vercel gives you a URL like `cagelague.vercel.app`.
That's your app — send it to everyone!

---

## PART 7 — Weekly workflow (during the season)

Each week after PLL games:

1. Log in as Commissioner
2. Go to **Commissioner → Enter Scores**
3. Select the week
4. Enter each player's fantasy points
5. Click Save

The standings, matchups, and team scores all update automatically.

---

## Troubleshooting

**The app won't start (`npm run dev` fails)**
- Make sure you ran `npm install` first
- Make sure your `.env.local` file exists and has all three variables filled in

**"Not authenticated" error when logging in**
- Double-check your Supabase URL and anon key in `.env.local`

**Commissioner tab doesn't appear**
- Make sure you ran the SQL in `003_make_commissioner.sql` with your correct email
- Sign out and sign back in after running it

**Deployed app works locally but not on Vercel**
- Check that you added all three environment variables in the Vercel project settings
- Go to Vercel → your project → Settings → Environment Variables

---

## Getting help

If something breaks, the best approach is to copy the exact error message
and ask Claude (or your group chat) — most setup issues have a simple fix.
