# Uniuyo Pulse

Uniuyo Pulse is a geofence-based attendance portal for the University of Uyo
Department of Computer Science. Students check in to active sessions, while
lecturers manage courses, open sessions, and review attendance reports.

## Account roles

- **Student** — checks in to attendance sessions and views personal records.
- **Lecturer** — manages courses and sessions and reviews department reports.
- **Course Rep / Admin** — lecturer-assigned course-representative operations.
  These roles cannot grant roles.
- **Dev Admin** — institution-wide monitoring and audited, narrowly scoped
  management overrides. Dev Admin self-registration requires the separate
  Firebase-stored Dev Admin authorization passkey; course reps cannot grant
  this role.

Student and lecturer accounts sign up with the shared Firebase-stored academic
signup passkey and provide their academic affiliation during registration.
Dev Admin registration instead requires its separate Firebase-stored
authorization passkey. All new accounts verify their email before signing in.

## Run locally

**Prerequisite:** Node.js

1. Install the web dependencies with `npm install`.
2. Copy `.env.example` to `.env.local` and configure it with the public web-app
   settings from **Firebase Console → Project settings → General → Your apps**.
   These Firebase web configuration values are public identifiers, not
   credentials. Restart Vite after changing the environment.
3. Enable **Authentication → Sign-in method → Email/Password**, configure
   email verification, and create a Cloud Firestore database.
4. Deploy the Firestore rules and Functions described below before registering
   users or using real student data.
5. Start the app with `npm run dev`.

## Trusted Firebase setup

The browser is not trusted to grant roles or write attendance results.
Callable Functions validate the signup passkeys, create profiles and role
claims, validate attendance check-ins, manage sessions, and save semester
tables. Firestore rules scope reads to the signed-in account or its department
and deny client writes to sensitive collections.

1. Use Node.js 20 for `functions/`. In that folder install the function
   dependencies with `npm install`. Install the Firebase CLI separately if it
   is not already available.
2. Select the intended Firebase project with `firebase use <project-id>`.
   Back up existing Firestore data before changing an established project.
   Review the target project, then deploy Functions from the repository root
   with `firebase deploy --only functions`. Functions deployment may require a
   billing-enabled Firebase plan.
3. For an existing installation, verify and migrate each legitimate account
   with the Admin SDK script below. Complete a separate reviewed migration
   for legacy course, session, record, and notification documents that lack
   the department/ownership fields required by the new rules before proceeding.
   A new project has no legacy data to migrate.
4. Bootstrap the first lecturer:
   - Create an email/password user in Firebase Authentication, verify the
     email, and note the user's Auth UID.
   - Authenticate the local Admin SDK with Application Default Credentials
     for an operator authorized for this Firebase project.
   - From `functions/`, run
     `node scripts/bootstrap-lecturer.js <verified-auth-uid> "<department>" <staff-id>`.
     The lecturer should sign out and back in to refresh the role claim.
5. After accounts and legacy data are ready, deploy the restrictive rules with
   `firebase deploy --only firestore:rules` and release the updated web app as
   a coordinated cutover. Old clients will be denied by the new rules. Do not
   use the new web app before its Functions are deployed.
6. Configure the separate Student/Lecturer signup passkey once per Firebase
   project. From `functions/`, using trusted Admin SDK credentials, run:

   ```powershell
   $env:SIGNUP_PASSKEY_PROJECT_ID = "your-firebase-project-id"
   node scripts/set-signup-passkey.js
   ```

   The script prints the passkey once and stores only its salted scrypt hash in
   `appConfig/registrationAuthorization`. Firestore rules deny client access
   to this document. Anyone with this shared passkey can register as either a
   Student or a Lecturer, so provide it only to authorized campus users and
   rotate it immediately if exposed. Users enter their faculty, department,
   registration number or staff ID, and (for Students) level in the signup
   form, then verify their email before signing in.
7. Dev Admins use the separate authorization passkey described below.
   Lecturers can assign
   `course_rep_admin` or `assistant_course_rep` in the Student Directory.
   Users whose role changed must sign out and back in to refresh their tokens.
8. Configure the Dev Admin signup authorization passkey once per Firebase
   project. From `functions/`, using trusted Admin SDK credentials, run:

   ```powershell
   $env:DEV_ADMIN_PASSKEY_PROJECT_ID = "your-firebase-project-id"
   node scripts/set-dev-admin-passkey.js
   ```

   Save the generated passkey securely; it is printed once and is never sent
   to the browser from Firebase. The callable function verifies it against a
   salted scrypt hash in `appConfig/devAuthorization`; Firestore rules deny
   client access to this document. Anyone who knows this shared authorization
   passkey can create a Dev Admin account, so only share it with trusted
   management staff and rotate it immediately if exposed by rerunning the
   script. Dev Admins then sign in with their own verified email and password.
9. For a separate demo Firebase project only, seed institution-wide demo data
   with Node.js 20 and Admin SDK credentials. The seeder creates lecturer and
   course-rep accounts with independently generated passwords, students,
   faculties, departments, and sample live/stale/closed/scheduled sessions;
   it does not create a Dev Admin account. In PowerShell, from `functions/`:

   ```powershell
   $env:SEED_UNIUYO_DEMO = "yes"
   $env:DEMO_FIREBASE_PROJECT_ID = "your-demo-project-id"
   node scripts/seed-dev-demo.js
   ```

   The script prints each generated demo email/password once; save them
   privately. These credentials are demo-only, are not checked into source,
   and must never be seeded into production. The
   `rep.csc.demo@uniuyo.edu.ng` course-rep account opens the seeded live
   Computer Science session. Its session verification code is `482196` in the
   demo dataset.

Do not publish permissive legacy rules or make the
`appConfig/devAuthorization` or `appConfig/registrationAuthorization` document readable to clients. Existing accounts
from the earlier passkey flow do not automatically receive custom role claims.
Verify each user's identity and existing role, then run
`node scripts/migrate-existing-user.js <verified-auth-uid> <role> <department> <registration-or-staff-id> [faculty] [level]`
from `functions/` using Admin SDK credentials. Students also require faculty
and level. Existing academic and attendance documents missing
department/ownership fields need a separately reviewed data migration. Back up
and verify existing data before changing rules or migrating accounts.

Both signup passkeys are shared authorization credentials, not WebAuthn
hardware passkeys. The Student/Lecturer passkey authorizes self-selected
academic roles; verify that it is distributed only to eligible users.
Individual accounts use Firebase email/password authentication. Passkeys are
hashed in Firestore and verified only by the callable backend, with failed
attempts rate-limited. Dev Admin data reads and overrides use authenticated
callable Functions; Firestore rules continue to deny client writes to
sensitive collections. Never put
Firebase Admin credentials in `VITE_*` variables, browser code,
`.env` files, or source control. The Firebase web API key is public client
configuration; restrict it to required APIs and authorized websites. Firestore
rules and trusted server functions enforce access control.

The Dev / Management Console polls its authorized Firebase snapshot every five
seconds, so updates from other browsers/devices appear without relying on
browser-local storage. The browser storage event is only a same-browser refresh
hint; the Firebase backend is the cross-device source of truth. Its current
audit and telemetry records are demo/application-level signals, not a
cryptographically attested hardware identity.

GitHub Pages hosts static files and cannot set HTTP response headers such as
CSP or HSTS from this repository. Configure headers on a hosting platform or
CDN that supports them if required. GitHub Pages provides HTTPS for its hosted
domain.

## Semester courses and timetable

Lecturers and assigned course representatives manage courses from the
**Courses** tab and timetable entries from **Calendar**. Semester data is
validated and replaced by a trusted callable function. Students see data for
their department and level.

If Firebase reports an unauthorized domain, add `localhost` (or the deployed
hostname) in **Authentication → Settings → Authorized domains**. Restrict the
Firebase API key only to the APIs this app needs and ensure Firebase
Authentication is permitted.

## Validation

- `npm run lint` — TypeScript type-check
- `npm run build` — production build
- `npm run lint --prefix functions` — Firebase Functions syntax check

## Dev Admin test checklist

- Configure the project authorization passkey with
  `node scripts/set-dev-admin-passkey.js`; create a Dev Admin account from the
  signup page using its own email/password and that passkey, then verify the
  email and sign in through **Dev Admin**.
- Verify the default page is **Live Operations** and includes the rep-opened
  live session.
- Open its detail drawer, confirm the check-in feed and geofence visualization,
  then force-close the session with a written reason. Confirm the action appears
  in **Activity & Audit**.
- Sign in as the generated course rep and confirm the session is now closed.
- Sign in as a student and confirm no Dev navigation is present; manually
  attempting a `dev_*` tab is blocked. The server also rejects dev-only calls
  from non-dev accounts.
