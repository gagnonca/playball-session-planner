# PlayBall v3 — manual test checklist

Test on the **preview**: https://playball-session-planner-git-v3-820e23-coreys-projects-5a13656d.vercel.app
(not a per-build `…-xxxxxxxx-…vercel.app` link — Google sign-in only allows the `-git-v3-820e23-` address).

The preview uses the **production database**. Don't edit the same session on www.getplayball.app and the
preview at the same time — the old live site can still overwrite edits.

Before starting: migration 0005 run (team archive column), Resend DNS verified (only needed for section 1c).

---

## 1. Sign-in (no passwords)

### 1a. Google
- [ ] "Continue with Google" shows Google's own button
- [ ] Google's screen names **PlayBall / getplayball.app** (not `…supabase.co`)
- [ ] Lands in the app signed in; header shows your initial and "Saved"

### 1b. Apple
- [ ] "Continue with Apple" → Apple's screen shows the name you expect (Services ID description)
- [ ] Lands in the app signed in
- [ ] Same email as Google → same account (same teams). "Hide My Email" → a separate account (expected)

### 1c. Email code *(needs Resend DNS verified)*
- [ ] Enter an email → "Email me a sign-in code" → email arrives within a minute, from your sender address
- [ ] Email shows a 6-digit code **and** a sign-in link
- [ ] Typing the code signs you in
- [ ] Clicking the link (same browser) signs you in
- [ ] Wrong code shows an error, doesn't sign in

### 1d. Signed-out experience
- [ ] Signed out, `/` shows the sign-in page with the three benefits and the privacy line
- [ ] "Look around first — try a demo team" opens a demo team with the "Demo — nothing is saved" banner
- [ ] Edits in the demo don't reach the server (reload → demo is gone, back to sign-in)
- [ ] "Create a free account" in the banner returns to sign-in
- [ ] `/privacy` loads signed out and mentions accounts, the Community, and account deletion

### 1e. Account
- [ ] Settings → Your account shows your email and provider
- [ ] Sign out → back to the sign-in page; sign back in → your data is there
- [ ] (Use a **test** account) Settings → "Delete account and all data" → type DELETE → account and its teams are gone; signing in again starts empty

---

## 2. Your existing data moves to your account
*(Test with a test account first; do it for real with your main account at launch.)*

- [ ] Browser that was synced before (device link copied to the preview, or www.getplayball.app after launch): first sign-in shows your existing teams and sessions
- [ ] A "Brought N items from this browser into your account" message appears if that browser had anything the server didn't
- [ ] Sessions deleted on another device do **not** come back
- [ ] A second browser/device, same account: signs in to the same data; doesn't create duplicates
- [ ] Settings shows no "Found data only in this browser" panel afterwards (or only items that genuinely failed)
- [ ] The old live site (www.getplayball.app, old code) still works for the same data until launch

---

## 3. Saving & leaving

### 3a. Session builder
- [ ] Opening a session shows "Saved" and a greyed **Save** button at the far right
- [ ] Any edit → "Unsaved changes", Save enabled, nothing saved to the server yet
- [ ] Save (or ⌘S / Ctrl+S) → "Session saved", chip back to "Saved"
- [ ] There is no "Save as…" button
- [ ] Unsaved edits + the **← team** button → "Leave without saving?" (Save and leave / Leave without saving / Keep editing)
- [ ] Each of the three choices does what it says
- [ ] Unsaved edits + the **browser's Back** button → same prompt; "Keep editing" leaves you on the session
- [ ] Unsaved edits + reload/close tab → the browser's "Leave site?" warning
- [ ] Opening a section's diagram or "insert from library" does **not** prompt (edits stay in the session)

### 3b. Diagram builder
- [ ] Change something → Back → "Leave without saving?" (Save diagram / Leave without saving / Keep editing)
- [ ] "Save to session" returns to the session with "Unsaved changes" (the diagram is in the session's draft)
- [ ] No "Upload image" button on sections or variations anywhere
- [ ] New diagrams use the dark striped pitch; field lines are thin and even at every pitch size/view

### 3c. Two tabs / two devices
- [ ] Tab A and tab B on the same session: edit in A, Save; then edit in B, Save → B shows "This session changed somewhere else"
- [ ] "Save my version over it" keeps B's version; "Discard my edits, load latest" shows A's
- [ ] Rename a team in tab A, archive it in tab B → both changes survive
- [ ] Delete a session in tab A → it disappears from tab B (switch to B / wait a moment)
- [ ] Tab B that was left open for a while shows current data when you click back into it

---

## 4. Teams, sessions, library
- [ ] Create a team → it stays (no "Team not found")
- [ ] Rename / change age group / archive a team → sticks after reload
- [ ] New session: blank, Play-Practice-Play, and from a template → each has the right sections after reload
- [ ] New session with a date → date is kept
- [ ] Session cards show **Copy** but no **Save**
- [ ] New session → "Pick from your library" lists sessions from **every** team, each labelled "From <team>"
- [ ] Picking one creates a new session on this team
- [ ] Old "Save as" copies (if any) still appear; "Remove saved copies" only removes those
- [ ] Library → Sessions and Exercises tabs list everything; hide / unhide sticks after reload
- [ ] ★ favorite an exercise → it sorts first, stays after reload and on another device
- [ ] Templates: create, edit, delete in the New session dialog → stick after reload and on another device
- [ ] Games: create / edit / delete a game on a team → sticks
- [ ] Deep links work on reload: `/library`, `/diagrams`, `/<team>`, `/<team>/<session>`, `/community`

---

## 5. Sharing with assistant coaches & iOS
- [ ] Share dialog → "Create code and link" → shows the **iOS app code** and a link
- [ ] Copy Link → open in a private window (signed out) → read-only sessions, no account needed
- [ ] Edit + Save a session → the shared link shows the change (saved version only, not unsaved edits)
- [ ] iOS app: enter the code → this team's sessions appear (sessions only)
- [ ] iOS app: session detail shows its diagrams
- [ ] "Stop Sharing" → link and iOS code stop working
- [ ] An existing iOS-shared team (roster / games pushed from iOS) still shows its games on the web

---

## 6. Community (Public)

### 6a. Publishing
- [ ] Session share menu → **Public** → confirm → the top-bar button says "Public"
- [ ] Unsaved edits + Public → it saves first, then publishes
- [ ] Edit the session after publishing → Community still shows the old version until "Update public copy"
- [ ] Share menu → Private or Co-coaches → the session leaves the Community
- [ ] Playbook → Exercises card → **Publish** → "Public ✓" → Update / Unpublish work
- [ ] Playbook → Diagrams card → Publish works for drawn diagrams; old image-only diagrams can't be published (tooltip explains)

### 6b. Browsing & adding
- [ ] Signed out: `/community` (and the "Browse sessions shared by other coaches" link) shows published items
- [ ] Diagrams in the Community are drawn as pitches (no uploaded images anywhere)
- [ ] Filters (Sessions / Exercises / Diagrams, search, age, moment) narrow the list
- [ ] Opening an item shows details; no name/email of the author, just "Shared by a PlayBall coach"
- [ ] Signed out → "Sign in to add"
- [ ] Second account: **Add** a session → it appears on the chosen team with diagram thumbnails
- [ ] Add an exercise → appears in your Exercises; add a diagram → appears in your Diagrams with a preview
- [ ] Added copies are yours: editing them doesn't change the published original

### 6c. Reporting & moderation
- [ ] Second account: open someone else's item → **Report** → "Thanks — we will take a look"
- [ ] As you (admin): Community shows **Needs review** with that item, its report count and reason
- [ ] **Dismiss reports** clears it; **Remove** hides it for everyone
- [ ] Open another coach's item as you → **Remove from Community** works
- [ ] Removed item: the owner sees "Public · hidden"; re-publishing does **not** bring it back
- [ ] **Restore** in Needs review brings it back
- [ ] Non-admin account: no Needs review button, no Remove button on others' items

---

## 7. Phone check (the field)
- [ ] Sign in on your phone → teams and sessions load
- [ ] Open a session with weak/no signal → it still shows (read-only cache)
- [ ] Saving while offline shows a clear "you're offline" message instead of silently failing

---

## Notes / bugs found
-
