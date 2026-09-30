# IskolarMatch Regression Test Cases

Manual regression suite for the current IskolarMatch codebase. Execute these cases after a merge to staging, and run the full set before a prototype presentation or final defense.

This document describes behavior that is implemented today. It does not describe planned features. Prototype-only screens are called out in the test case and again in `docs/REGRESSION_CHECKLIST.md`.

Do not change application source code to make a case pass. Do not edit database records except temporary accounts and scholarships created for the test. Remove or clearly label that temporary data when the run is finished.

## How to run

1. Start the API from `backend` so it listens on port `5000`.
2. Start the Vite app from `frontend` so it listens on port `5173`. The dev server proxies `/api` to the API. Do not run these cases against `frontend/dist` unless that host also proxies `/api`.
3. Use a browser. For API-only checks, use the browser Network panel or PowerShell `Invoke-RestMethod` against `http://localhost:5000/api/v1`.
4. Use a unique email for every new account: `qa.<caseid>.<yyyymmddhhmm>@example.com`.
5. Record **Actual Result** and set **Status** to `Pass`, `Fail`, or `Blocked`. Leave **Status** as `Not Run` until the case is executed.
6. API failures from the auth error handler return JSON `{ "success": false, "error": "..." }`. The sign-in screen often shows a generic sentence because it reads `message`, which that handler does not set. Judge the UI by the sentence on screen and the API by the `error` field.
7. A dark connection strip at the top of every page is expected. It is not a product failure.
8. Admin accounts cannot be created from the registration form or `POST /api/v1/auth/register`. A pre-seeded admin is required. See the test-account section in `docs/REGRESSION_CHECKLIST.md`.

## Environment under test

| Item | Value |
| --- | --- |
| Frontend | `http://localhost:5173` |
| API | `http://localhost:5000/api/v1` |
| Health | `GET /api/v1/health` returns `{ "status": "success" }` |
| Roles | `student`, `provider`, `admin` (also `superadmin` / `super_admin` on admin routes) |
| Auth | JWT in an HttpOnly cookie and a copy in `localStorage` key `token` |

## Shared test data

Use these values unless a case names different data.

**Adult college student profile (complete)**

- Date of birth: `2004-05-15` (age 18 or older on the test date)
- Academic level: `College`
- Year level: `2nd Year`
- Course: `BS Computer Science`
- GWA: `1.50`
- GWA scale: `1.00-5.00`
- Income: `Below ₱10,000 / month`
- Region: `Bicol Region`
- Province: `Albay`
- Municipality / city: a city listed under Albay in the profile form
- Citizenship: `Filipino`
- Special eligibility: none

**Matching scholarship (verified provider)**

- Name: `QA College Grant`
- Type: `Merit`
- Description: `Regression scholarship for college students in Bicol.`
- Benefits: `Tuition support`
- Grant value: `20000`
- Academic level: `College`
- Course: `BS Computer Science`
- Location scope: `Region`
- Region: `Bicol Region`
- Citizenship: `Filipino`
- Academic requirement: scale `1.00-5.00`, maximum allowable GWA `2.00`
- Also add scale `60-100`, minimum GPA `80`, when the case says both scales
- Monthly income cap: `21190`
- Deadline: 30 days from today
- Application URL: `https://example.com/apply`
- Weights: GWA `40`, income `40`, tags `20`
- Status: `Open`
- Not archived

**Score check for that pair**

Student GWA `1.50` against maximum `2.00` on the `1.00-5.00` scale scores **80**. Income bracket `Below ₱10,000 / month` under a `21190` cap scores **80**. No preferred tags score **100**. Weights `0.40 / 0.40 / 0.20` produce total **84**, classification **Recommended**.

## Result columns

Every case below includes: Test Case ID, Module, Feature, Test Scenario, Preconditions, Test Data, Steps, Expected Result, Actual Result, Status, Priority, Test Type, Regression Required?, Notes.

---

# 1. AUTHENTICATION & RBAC

### AUTH-001

- **Module:** Authentication & RBAC
- **Feature:** Student registration
- **Test Scenario:** A visitor can register as a student and receive a session.
- **Preconditions:** The email has never been used.
- **Test Data:** Name `QA Student`, email `qa.auth001.<stamp>@example.com`, password `Secret1`, role Student.
- **Steps:**
  1. Open `http://localhost:5173/auth?mode=signup`.
  2. Leave the role on **Student**.
  3. Enter the name, email, and password.
  4. Submit the form.
- **Expected Result:** Registration succeeds. The browser stores a token. The address becomes `/onboarding`. `POST /api/v1/auth/register` returns `201` with `role` `student`, `isOnboarded` false, and `status` `active`.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** Critical
- **Test Type:** Positive
- **Regression Required?** Critical smoke
- **Notes:** Signup buttons are only Student and Sponsor / Provider. There is no Admin choice.

### AUTH-002

- **Module:** Authentication & RBAC
- **Feature:** Provider registration
- **Test Scenario:** A visitor can register as a scholarship provider.
- **Preconditions:** The email has never been used.
- **Test Data:** Organization `QA Foundation`, email `qa.auth002.<stamp>@example.com`, password `Secret1`.
- **Steps:**
  1. Open `/auth?mode=signup`.
  2. Choose **Sponsor / Provider**.
  3. Enter the organization name, email, and password.
  4. Submit.
- **Expected Result:** Registration succeeds with role `provider`. A provider record is created with verification status `Pending` and `isOnboarded` false. The app then leaves `/dashboard/provider` and lands on `/provider/onboarding`.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** Critical
- **Test Type:** Positive
- **Regression Required?** Critical smoke
- **Notes:** The first navigation target in code is `/dashboard/provider`. The onboarding guard must redirect before the dashboard is usable.

### AUTH-003

- **Module:** Authentication & RBAC
- **Feature:** Attempt to register as admin
- **Test Scenario:** A caller cannot create an admin account through registration.
- **Preconditions:** API is running. No admin role is offered in the signup form.
- **Test Data:** Email `qa.auth003.<stamp>@example.com`, password `Secret1`, role `admin`. Repeat with `superadmin` and `super_admin`.
- **Steps:**
  1. Confirm the signup form has no Admin role.
  2. Send `POST /api/v1/auth/register` with JSON `{ "name": "QA Admin", "email": "<email>", "password": "Secret1", "role": "admin" }`.
  3. Repeat with roles `superadmin` and `super_admin`.
- **Expected Result:** Each API call returns `403`. The error text is `You cannot register directly as an admin role.` No user is created. The form never offers an admin role.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** Critical
- **Test Type:** Negative / Security
- **Regression Required?** Critical smoke
- **Notes:**

### AUTH-004

- **Module:** Authentication & RBAC
- **Feature:** Login with valid credentials
- **Test Scenario:** An active onboarded student can sign in.
- **Preconditions:** AUTH-001 student has finished adult onboarding, or use the seeded active student from the checklist.
- **Test Data:** That student's email and password.
- **Steps:**
  1. Open `/auth?mode=signin`.
  2. Enter the email and password.
  3. Submit.
- **Expected Result:** `POST /api/v1/auth/login` returns `200`, `success: true`, and a token. The app opens `/dashboard/student` for an onboarded active student.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** Critical
- **Test Type:** Positive
- **Regression Required?** Critical smoke
- **Notes:** A student who is not onboarded is sent to `/onboarding` by the guard. A provider who is not verified is sent to onboarding or pending approval. See AUTH-016.

### AUTH-005

- **Module:** Authentication & RBAC
- **Feature:** Invalid credentials
- **Test Scenario:** A wrong password does not create a session.
- **Preconditions:** The email belongs to a real user.
- **Test Data:** Correct email, password `WrongPass1`.
- **Steps:**
  1. Open `/auth?mode=signin`.
  2. Submit the correct email and the wrong password.
- **Expected Result:** The user stays on the sign-in page. An error is shown (`Invalid email or password.` on the form). The API returns `401` and `error` `Invalid credentials`. `localStorage` does not gain a new token.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** Critical
- **Test Type:** Negative
- **Regression Required?** Critical smoke
- **Notes:** Unknown email uses the same invalid-credentials response.

### AUTH-006

- **Module:** Authentication & RBAC
- **Feature:** Login validation
- **Test Scenario:** Login without email or password is rejected.
- **Preconditions:** Signed out.
- **Test Data:** Blank email, blank password, then email only.
- **Steps:**
  1. Submit the sign-in form with both fields empty.
  2. Call `POST /api/v1/auth/login` with `{}`.
  3. Call it with only an email.
- **Expected Result:** No session is created. The API returns `400` and `error` `Please provide email and password`.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** High
- **Test Type:** Validation
- **Regression Required?** Full regression
- **Notes:**

### AUTH-007

- **Module:** Authentication & RBAC
- **Feature:** Logout
- **Test Scenario:** Logout clears the local session and returns to sign-in.
- **Preconditions:** Signed in as any role.
- **Test Data:** Current session token.
- **Steps:**
  1. Open a dashboard page.
  2. Use the sidebar logout control.
  3. Refresh the sign-in page.
  4. Press Back.
- **Expected Result:** `GET /api/v1/auth/logout` returns `200`. The token cookie and `localStorage.token` are removed. The address is `/auth?mode=signin`. Refresh stays signed out. Back does not restore the dashboard.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** Critical
- **Test Type:** Positive
- **Regression Required?** Critical smoke
- **Notes:** If Redis is down, blacklist is skipped and the API still clears the cookie. The UI must still drop `localStorage.token`. A later call with the old Bearer token is rejected only when Redis blacklist is available.

### AUTH-008

- **Module:** Authentication & RBAC
- **Feature:** Session restoration
- **Test Scenario:** A valid stored token restores the user after refresh.
- **Preconditions:** Signed in. Token present in `localStorage`.
- **Test Data:** Active student session.
- **Steps:**
  1. Open `/dashboard/student`.
  2. Refresh the browser.
  3. Watch `GET /api/v1/auth/me`.
- **Expected Result:** The request returns `200` and the same email and role. The dashboard remains open. The user is not sent to sign-in.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** Critical
- **Test Type:** Persistence
- **Regression Required?** Critical smoke
- **Notes:**

### AUTH-009

- **Module:** Authentication & RBAC
- **Feature:** Missing token
- **Test Scenario:** A protected API call without a token is rejected.
- **Preconditions:** Signed out. No `token` cookie and no Authorization header.
- **Test Data:** None.
- **Steps:**
  1. Call `GET /api/v1/auth/me` with no cookie and no Authorization header.
  2. Call `GET /api/v1/students/profile` the same way.
  3. Open `/dashboard/student` while signed out.
- **Expected Result:** Both API calls return `401` and `Not authorized to access this route`. The dashboard route redirects to `/auth?mode=signin`.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** Critical
- **Test Type:** Negative / Security
- **Regression Required?** Critical smoke
- **Notes:**

### AUTH-010

- **Module:** Authentication & RBAC
- **Feature:** Expired or invalid token
- **Test Scenario:** A bad token does not restore a session.
- **Preconditions:** Signed out.
- **Test Data:** Authorization `Bearer not-a-jwt`. Then a JWT signed with the wrong secret, or a JWT whose `exp` is in the past.
- **Steps:**
  1. Put `not-a-jwt` in `localStorage` key `token`.
  2. Refresh `/dashboard/student`.
  3. Call `GET /api/v1/auth/me` with `Authorization: Bearer not-a-jwt`.
- **Expected Result:** The API returns `401` and `Token verification failed`. The app clears the token and shows the sign-in page.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** High
- **Test Type:** Negative / Security
- **Regression Required?** Full regression
- **Notes:** The default token lifetime is 30 days, so do not wait for natural expiry. A tampered or already-expired token is enough.

### AUTH-011

- **Module:** Authentication & RBAC
- **Feature:** Student accessing provider routes
- **Test Scenario:** A student cannot use provider pages or provider APIs.
- **Preconditions:** Signed in as an active student.
- **Test Data:** Student token.
- **Steps:**
  1. Open `/dashboard/provider`.
  2. Open `/dashboard/provider/create`.
  3. Open `/provider/onboarding`.
  4. Call `GET /api/v1/scholarships/my` with the student token.
- **Expected Result:** Provider pages redirect to `/dashboard/student`. The API returns `403` and `User is not authorized to access this route`.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** Critical
- **Test Type:** Negative / Security
- **Regression Required?** Critical smoke
- **Notes:**

### AUTH-012

- **Module:** Authentication & RBAC
- **Feature:** Provider accessing student routes
- **Test Scenario:** A verified provider cannot use student pages or student APIs.
- **Preconditions:** Signed in as a verified provider. If the provider is not verified, the guard sends them to onboarding or pending approval first. Use a verified provider for this case.
- **Test Data:** Provider token.
- **Steps:**
  1. Open `/dashboard/student`.
  2. Open `/dashboard/student/matches`.
  3. Open `/onboarding`.
  4. Call `GET /api/v1/matching` with the provider token.
- **Expected Result:** Student pages redirect to `/dashboard/provider`. Matching returns `403`.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** Critical
- **Test Type:** Negative / Security
- **Regression Required?** Full regression
- **Notes:**

### AUTH-013

- **Module:** Authentication & RBAC
- **Feature:** Student accessing admin routes
- **Test Scenario:** A student cannot open the admin area.
- **Preconditions:** Signed in as a student.
- **Test Data:** Student token.
- **Steps:**
  1. Open `/dashboard/admin`.
  2. Open `/dashboard/admin/verification`.
  3. Call `GET /api/v1/admin/dashboard` with the student token.
- **Expected Result:** The browser redirects to `/dashboard/student`. The API returns `403` and `Not authorized to access this route`.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** Critical
- **Test Type:** Negative / Security
- **Regression Required?** Critical smoke
- **Notes:**

### AUTH-014

- **Module:** Authentication & RBAC
- **Feature:** Provider accessing admin routes
- **Test Scenario:** A provider cannot open the admin area.
- **Preconditions:** Signed in as a verified provider.
- **Test Data:** Provider token.
- **Steps:**
  1. Open `/dashboard/admin`.
  2. Call `GET /api/v1/admin/verifications` with the provider token.
- **Expected Result:** The browser redirects to `/dashboard/provider`. The API returns `403`.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** Critical
- **Test Type:** Negative / Security
- **Regression Required?** Full regression
- **Notes:**

### AUTH-015

- **Module:** Authentication & RBAC
- **Feature:** Admin accessing admin routes
- **Test Scenario:** An admin can open the admin dashboard.
- **Preconditions:** Seeded admin credentials.
- **Test Data:** Admin email and password.
- **Steps:**
  1. Sign in as admin.
  2. Open `/dashboard/admin`.
  3. Open `/dashboard/admin/verification`.
- **Expected Result:** Both pages render for the admin. The dashboard requests `GET /api/v1/admin/dashboard` and receives `200`.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** Critical
- **Test Type:** Positive
- **Regression Required?** Critical smoke
- **Notes:** Roles `admin`, `superadmin`, and `super_admin` are allowed. There is no in-app admin registration.

### AUTH-016

- **Module:** Authentication & RBAC
- **Feature:** Role-based dashboard redirects
- **Test Scenario:** Sign-in and `/dashboard` land on the role-specific destination.
- **Preconditions:** One active onboarded student, one verified provider, one pending provider, one admin.
- **Test Data:** Those four accounts.
- **Steps:**
  1. Sign in as the onboarded student and then open `/dashboard`.
  2. Sign out. Sign in as the verified provider and open `/dashboard`.
  3. Sign out. Sign in as the pending provider.
  4. Sign out. Sign in as admin and open `/dashboard`.
- **Expected Result:**
  - Onboarded active student ends on `/dashboard/student`.
  - Verified provider ends on `/dashboard/provider`.
  - Provider who has not finished onboarding ends on `/provider/onboarding`.
  - Provider who finished onboarding but is not `Verified` or `Approved` ends on `/provider/pending-approval`.
  - Admin ends on `/dashboard/admin`.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** Critical
- **Test Type:** Navigation
- **Regression Required?** Critical smoke
- **Notes:** Login first navigates to `/dashboard/<role>`. Guards then apply onboarding and verification rules.

### AUTH-017

- **Module:** Authentication & RBAC
- **Feature:** Duplicate registration
- **Test Scenario:** The same email cannot be registered twice.
- **Preconditions:** AUTH-001 email already exists.
- **Test Data:** That email, any unused name, password `Secret1`.
- **Steps:**
  1. Submit signup again with the same email.
  2. Confirm with `POST /api/v1/auth/register`.
- **Expected Result:** Registration fails. API returns `400` and `error` `Email already registered`. No second account is created. Email comparison is case-insensitive.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** High
- **Test Type:** Negative / Validation
- **Regression Required?** Full regression
- **Notes:**

### AUTH-018

- **Module:** Authentication & RBAC
- **Feature:** Provider organization required
- **Test Scenario:** Provider registration without an organization name is rejected.
- **Preconditions:** None.
- **Test Data:** Role `provider`, email `qa.auth018.<stamp>@example.com`, password `Secret1`, no organization.
- **Steps:**
  1. On the signup form, choose Sponsor / Provider and submit with an empty organization name.
  2. Call the register API with `role` `provider` and no `organization`.
- **Expected Result:** The form shows `Please enter your name or organization name.` The API returns `400` and `Organization name is required for scholarship providers.`
- **Actual Result:**
- **Status:** Not Run
- **Priority:** High
- **Test Type:** Validation
- **Regression Required?** Full regression
- **Notes:**

### AUTH-019

- **Module:** Authentication & RBAC
- **Feature:** Password length
- **Test Scenario:** A password shorter than 6 characters is rejected.
- **Preconditions:** Unused email.
- **Test Data:** Password `abc`.
- **Steps:**
  1. Submit student registration with password `abc`.
- **Expected Result:** The account is not created. The API returns `400` from validation (`Please add a password` / minimum length). The UI may show the generic `Registration failed.` because the handler puts the text in `error`.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** Medium
- **Test Type:** Validation
- **Regression Required?** Full regression
- **Notes:**

### AUTH-020

- **Module:** Authentication & RBAC
- **Feature:** Signed-out access to a dashboard
- **Test Scenario:** A signed-out visitor cannot stay on a protected page.
- **Preconditions:** Logged out.
- **Test Data:** None.
- **Steps:**
  1. Open `/dashboard/student/matches` directly.
  2. Open `/dashboard/provider/listings` directly.
  3. Open `/dashboard/admin` directly.
- **Expected Result:** Each URL ends on `/auth?mode=signin`.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** High
- **Test Type:** Negative / Navigation
- **Regression Required?** Full regression
- **Notes:**

### AUTH-021

- **Module:** Authentication & RBAC
- **Feature:** Forgot password, unknown email
- **Test Scenario:** An unknown email does not get a reset success state.
- **Preconditions:** Email is not registered.
- **Test Data:** `qa.missing.<stamp>@example.com`.
- **Steps:**
  1. Open `/auth?mode=forgot`.
  2. Submit the unknown email.
- **Expected Result:** The form shows an error. API `POST /api/v1/auth/forgotpassword` returns `404` and `There is no user with that email`.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** Medium
- **Test Type:** Negative
- **Regression Required?** Full regression
- **Notes:**

### AUTH-022

- **Module:** Authentication & RBAC
- **Feature:** Forgot password, known email
- **Test Scenario:** A known email is accepted, but no reset page exists in the app.
- **Preconditions:** A registered user.
- **Test Data:** That user's email.
- **Steps:**
  1. Open `/auth?mode=forgot` and submit the email.
  2. Open `/reset-password/test-token`.
- **Expected Result:** The forgot form shows a success state and the API returns `200` with data `Email sent`. The API writes a reset link to the server log. It does not send a working reset email, and `/reset-password/...` is not a route. That URL falls through to `/auth?mode=signin`. Do not expect the password to change.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** Medium
- **Test Type:** Negative / Known limitation
- **Regression Required?** Full regression
- **Notes:** This is implemented behavior, not a password-reset feature. Do not file a failure solely because no reset email arrives.

---

# 2. STUDENT REGISTRATION & ONBOARDING

### STU-001

- **Module:** Student Registration & Onboarding
- **Feature:** Registration creates a student account
- **Test Scenario:** Signup creates a student user and opens onboarding.
- **Preconditions:** Unused email.
- **Test Data:** Name `QA Student Onboard`, email `qa.stu001.<stamp>@example.com`, password `Secret1`.
- **Steps:**
  1. Register as Student.
  2. Confirm the landing page.
  3. Call `GET /api/v1/auth/me` with the new token.
- **Expected Result:** Role is `student`, `isOnboarded` is false, `status` is `active`. The page is `/onboarding`.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** Critical
- **Test Type:** Positive
- **Regression Required?** Critical smoke
- **Notes:** Same flow as AUTH-001, checked from the student-onboarding side.

### STU-002

- **Module:** Student Registration & Onboarding
- **Feature:** Adult onboarding saves data
- **Test Scenario:** An adult student can submit onboarding and keep the saved profile.
- **Preconditions:** STU-001 account, still on `/onboarding`.
- **Test Data:** Date of birth `2004-05-15`, academic level `College`, year `2nd Year`, course `BS Computer Science`, GWA `1.50`, region `Bicol Region`, income `Below ₱10,000 / month`.
- **Steps:**
  1. Fill every required onboarding field.
  2. Confirm guardian fields are hidden.
  3. Submit **Activate Profile**.
  4. On the "Get Better Scholarship Matches" dialog, choose the profile or dashboard action.
  5. Open Student Profile.
- **Expected Result:** `POST /api/v1/user/onboarding` returns `200` and `Profile activated successfully.` User `isOnboarded` is true and `status` is `active`. Student profile stores the submitted course, GWA, region, income, academic level, and year. GWA scale is stored as `1.00-5.00` because `1.50` falls in that range. Province and municipality are still empty, so the profile is not yet complete for matching.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** Critical
- **Test Type:** Positive
- **Regression Required?** Critical smoke
- **Notes:** A GWA from 60 through 100 is stored as scale `60-100`.

### STU-003

- **Module:** Student Registration & Onboarding
- **Feature:** Required onboarding fields
- **Test Scenario:** Onboarding cannot be submitted with required fields empty.
- **Preconditions:** New student on `/onboarding`.
- **Test Data:** Empty form.
- **Steps:**
  1. Submit the form without filling it.
  2. Fill only the date of birth and submit again.
- **Expected Result:** The browser blocks submit or the API returns an error. `isOnboarded` stays false. No complete student profile is stored.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** High
- **Test Type:** Validation
- **Regression Required?** Full regression
- **Notes:** Required onboarding inputs are date of birth, academic level, year level, course, GWA, region, and household income.

### STU-004

- **Module:** Student Registration & Onboarding
- **Feature:** Adult student
- **Test Scenario:** A student 18 or older is not asked for a guardian.
- **Preconditions:** Student on `/onboarding`.
- **Test Data:** Date of birth at least 18 years before today.
- **Steps:**
  1. Enter that date of birth.
  2. Inspect the form.
- **Expected Result:** The parent/guardian block is not shown. The button reads **Activate Profile**. Submit does not set `status` to `pending_consent`.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** High
- **Test Type:** Positive
- **Regression Required?** Full regression
- **Notes:** Age is calculated in the browser from the date of birth.

### STU-005

- **Module:** Student Registration & Onboarding
- **Feature:** Minor identification on the form
- **Test Scenario:** A date of birth under 18 reveals guardian fields.
- **Preconditions:** Student on `/onboarding`.
- **Test Data:** Date of birth less than 18 years before today.
- **Steps:**
  1. Enter that date of birth.
- **Expected Result:** A **Parent / Guardian Consent Required (Under 18)** section appears. Guardian name and guardian email are required. The button reads **Submit & Send Guardian Email**.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** Critical
- **Test Type:** Positive
- **Regression Required?** Critical smoke
- **Notes:** Approval behavior is covered in the consent module.

### STU-006

- **Module:** Student Registration & Onboarding
- **Feature:** Unauthorized onboarding
- **Test Scenario:** A signed-out visitor cannot open onboarding.
- **Preconditions:** Logged out.
- **Test Data:** None.
- **Steps:**
  1. Open `/onboarding`.
- **Expected Result:** The app redirects to `/auth?mode=signin`.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** High
- **Test Type:** Negative / Security
- **Regression Required?** Full regression
- **Notes:**

### STU-007

- **Module:** Student Registration & Onboarding
- **Feature:** Wrong-role onboarding
- **Test Scenario:** A provider cannot open student onboarding.
- **Preconditions:** Signed in as a provider.
- **Test Data:** Provider session.
- **Steps:**
  1. Open `/onboarding`.
- **Expected Result:** The app redirects to the provider destination (`/dashboard/provider`, `/provider/onboarding`, or `/provider/pending-approval`), not the student form.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** High
- **Test Type:** Negative / Security
- **Regression Required?** Full regression
- **Notes:**

### STU-008

- **Module:** Student Registration & Onboarding
- **Feature:** Onboarding persistence
- **Test Scenario:** Submitted onboarding is still present after refresh.
- **Preconditions:** STU-002 completed.
- **Test Data:** The values submitted in STU-002.
- **Steps:**
  1. Open `/dashboard/student/profile`.
  2. Refresh the page.
- **Expected Result:** Course, GWA, academic level, year, region, and income match the onboarding submission.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** High
- **Test Type:** Persistence
- **Regression Required?** Full regression
- **Notes:**

### STU-009

- **Module:** Student Registration & Onboarding
- **Feature:** Invalid onboarding values
- **Test Scenario:** A year level or academic level outside the allowed list is rejected by the API.
- **Preconditions:** Student token, onboarding not yet valid.
- **Test Data:** `academicLevel` `Elementary`, `yearLevel` `Grade 1`, other fields otherwise valid, `isMinor` false.
- **Steps:**
  1. `POST /api/v1/user/onboarding` with those values and the student token.
- **Expected Result:** The request fails. The stored academic level is not `Elementary`. The form itself only offers Senior High School, College, and Graduate Studies, and the year levels defined for those levels.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** Medium
- **Test Type:** Validation
- **Regression Required?** Full regression
- **Notes:** Allowed academic levels are `Senior High School`, `College`, and `Graduate Studies`.

### STU-010

- **Module:** Student Registration & Onboarding
- **Feature:** Dashboard after onboarding while profile is still incomplete
- **Test Scenario:** An onboarded adult can open the student dashboard before province and municipality are filled.
- **Preconditions:** STU-002 completed. Province and municipality still blank.
- **Test Data:** That student.
- **Steps:**
  1. Open `/dashboard/student`.
  2. Open `/dashboard/student/matches`.
- **Expected Result:** The dashboard route stays available because `isOnboarded` is true and status is `active`. Match Feed does not list scholarships. It asks the student to complete the profile.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** High
- **Test Type:** Positive / Empty state
- **Regression Required?** Full regression
- **Notes:** Matching completeness is separate from the onboarding flag. See PROF-006.

---

# 3. STUDENT PROFILE

### PROF-001

- **Module:** Student Profile
- **Feature:** View profile
- **Test Scenario:** The student profile page loads the saved student profile.
- **Preconditions:** Onboarded student.
- **Test Data:** STU-002 student.
- **Steps:**
  1. Open `/dashboard/student/profile`.
- **Expected Result:** `GET /api/v1/students/profile` returns `200` and that student's profile. The form shows the onboarding values.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** High
- **Test Type:** Positive
- **Regression Required?** Full regression
- **Notes:**

### PROF-002

- **Module:** Student Profile
- **Feature:** Profile update
- **Test Scenario:** The student can save province, municipality, and an updated GWA.
- **Preconditions:** Onboarded student.
- **Test Data:** Region `Bicol Region`, province `Albay`, a municipality listed for Albay, GWA `1.50`, scale `1.00-5.00`, citizenship `Filipino`, income `Below ₱10,000 / month`.
- **Steps:**
  1. Open the profile page.
  2. Select the province, then the municipality.
  3. Set GWA to `1.50` and scale `1.00-5.00` if they are not already set.
  4. Save.
- **Expected Result:** A success message says the profile was saved. `PUT /api/v1/students/profile` returns `200`. The response profile includes the province and municipality.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** Critical
- **Test Type:** Positive
- **Regression Required?** Critical smoke
- **Notes:** Municipality stays disabled until a province is selected.

### PROF-003

- **Module:** Student Profile
- **Feature:** Persistence after refresh
- **Test Scenario:** Saved profile fields survive a refresh.
- **Preconditions:** PROF-002 saved.
- **Test Data:** The saved province and municipality.
- **Steps:**
  1. Refresh `/dashboard/student/profile`.
- **Expected Result:** Province, municipality, GWA, course, income, and region are unchanged.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** Critical
- **Test Type:** Persistence
- **Regression Required?** Critical smoke
- **Notes:**

### PROF-004

- **Module:** Student Profile
- **Feature:** Persistence after logout and login
- **Test Scenario:** Saved profile fields survive a new session.
- **Preconditions:** PROF-002 saved.
- **Test Data:** Same student credentials.
- **Steps:**
  1. Log out.
  2. Sign in again.
  3. Open `/dashboard/student/profile`.
- **Expected Result:** The same province, municipality, GWA, and course are loaded from the API.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** Critical
- **Test Type:** Persistence
- **Regression Required?** Critical smoke
- **Notes:**

### PROF-005

- **Module:** Student Profile
- **Feature:** Required GWA
- **Test Scenario:** Clearing GWA does not save an empty academic record.
- **Preconditions:** Profile page open.
- **Test Data:** GWA field cleared.
- **Steps:**
  1. Clear Current GWA.
  2. Save.
- **Expected Result:** The page reports that Current GWA is required, or the API rejects the update. The previously saved GWA remains after refresh.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** High
- **Test Type:** Validation
- **Regression Required?** Full regression
- **Notes:**

### PROF-006

- **Module:** Student Profile
- **Feature:** Required profile fields for matching
- **Test Scenario:** Matching treats the profile as complete only when personal, academic, and financial sections are all filled.
- **Preconditions:** Ability to read `GET /api/v1/students/profile` and `GET /api/v1/matching`.
- **Test Data:** Complete set from the shared adult profile. Then remove province.
- **Steps:**
  1. Save the full shared profile.
  2. Call `GET /api/v1/matching`.
  3. Clear province, save, and call matching again.
- **Expected Result:** With every required field present, matching does not return `profileComplete: false`. After province is cleared, matching returns `200` with `profileComplete: false`, `count: 0`, and `matches: []`. Required personal fields are date of birth, citizenship, region, province, and municipality. Required academic fields are academic level, year level, course, GWA, and GWA scale. Required financial field is income bracket. School name and school type are not part of this gate.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** Critical
- **Test Type:** Validation
- **Regression Required?** Critical smoke
- **Notes:**

### PROF-007

- **Module:** Student Profile
- **Feature:** Incomplete profile behavior
- **Test Scenario:** Search and Match Feed do not show scholarship cards when the profile is incomplete.
- **Preconditions:** Onboarded student missing province or municipality.
- **Test Data:** That student.
- **Steps:**
  1. Open `/dashboard/student/search`.
  2. Open `/dashboard/student/matches`.
- **Expected Result:** Both pages show a complete-profile message and a way to continue the profile. They do not render scholarship cards and they do not show sample grants.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** Critical
- **Test Type:** Negative / Empty state
- **Regression Required?** Critical smoke
- **Notes:**

### PROF-008

- **Module:** Student Profile
- **Feature:** Complete profile behavior
- **Test Scenario:** A complete profile can request matches.
- **Preconditions:** Shared complete profile saved. At least one Open scholarship can match it, or none exist.
- **Test Data:** Shared adult profile.
- **Steps:**
  1. Open Match Feed.
  2. Confirm the matching response.
- **Expected Result:** The page does not show the incomplete-profile message. The API returns `200` and a `matches` array. If a qualifying Open scholarship exists, it can appear. If none exist, the feed shows an empty state, not an error and not fake cards.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** Critical
- **Test Type:** Positive
- **Regression Required?** Critical smoke
- **Notes:**

### PROF-009

- **Module:** Student Profile
- **Feature:** Another user cannot read this profile by swapping identity
- **Test Scenario:** The profile endpoint returns only the signed-in student.
- **Preconditions:** Two students, A and B, both with profiles.
- **Test Data:** Token of student B.
- **Steps:**
  1. Call `GET /api/v1/students/profile` as student B.
- **Expected Result:** The payload is student B's profile, not student A's. There is no profile id parameter that selects another student.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** High
- **Test Type:** Security
- **Regression Required?** Full regression
- **Notes:**

### PROF-010

- **Module:** Student Profile
- **Feature:** Provider cannot update a student profile
- **Test Scenario:** A provider token is rejected by the student profile API.
- **Preconditions:** Verified provider token.
- **Test Data:** Any profile JSON.
- **Steps:**
  1. `PUT /api/v1/students/profile` with the provider token.
- **Expected Result:** `403`. Student A's profile is unchanged.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** High
- **Test Type:** Negative / Security
- **Regression Required?** Full regression
- **Notes:**

---

# 4. MINOR / GUARDIAN CONSENT

### CONSENT-001

- **Module:** Minor / Guardian Consent
- **Feature:** Minor identification
- **Test Scenario:** Age under 18 is treated as a minor during onboarding.
- **Preconditions:** New student account.
- **Test Data:** Date of birth `2012-01-15`.
- **Steps:**
  1. Open `/onboarding`.
  2. Enter that date of birth.
- **Expected Result:** The form sets the minor state and shows the guardian section.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** Critical
- **Test Type:** Positive
- **Regression Required?** Critical smoke
- **Notes:** The cutoff is the 18th birthday in the browser's local date calculation.

### CONSENT-002

- **Module:** Minor / Guardian Consent
- **Feature:** Guardian name and email required
- **Test Scenario:** A minor cannot submit without guardian name and email.
- **Preconditions:** Minor date of birth entered. Other onboarding fields valid.
- **Test Data:** Blank guardian name and blank guardian email.
- **Steps:**
  1. Submit the form.
  2. Call `POST /api/v1/user/onboarding` with `isMinor: true` and no `guardianEmail`.
- **Expected Result:** The form does not finish onboarding. The API returns `400` and `Guardian email is required for minors.` Status does not become `pending_consent` for that failed request.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** Critical
- **Test Type:** Validation
- **Regression Required?** Critical smoke
- **Notes:** The form also marks guardian name required.

### CONSENT-003

- **Module:** Minor / Guardian Consent
- **Feature:** Student cannot use their own email as guardian email
- **Test Scenario:** Guardian email equal to the student email is rejected.
- **Preconditions:** Minor onboarding otherwise valid.
- **Test Data:** Guardian email exactly equal to the student account email, including different letter case.
- **Steps:**
  1. Enter the student's own email in Guardian email.
  2. Submit.
- **Expected Result:** The form shows that the guardian email cannot match the student email. The API returns `400` and `Guardian email cannot be the same as your student account email.`
- **Actual Result:**
- **Status:** Not Run
- **Priority:** Critical
- **Test Type:** Negative / Validation
- **Regression Required?** Critical smoke
- **Notes:**

### CONSENT-004

- **Module:** Minor / Guardian Consent
- **Feature:** Consent email and token generation
- **Test Scenario:** Valid minor onboarding stores a guardian and attempts a consent email.
- **Preconditions:** SMTP may be unconfigured. That must not be treated as a missing feature.
- **Test Data:** Guardian name `QA Guardian`, guardian email `qa.guardian.<stamp>@example.com`, other minor onboarding fields valid.
- **Steps:**
  1. Submit minor onboarding.
  2. Read the API response and the server log.
- **Expected Result:** Response is `200` and `Onboarding completed. Consent email sent to guardian.` User status is `pending_consent`, `isOnboarded` is true, and guardian name and email are stored. The server log contains a consent link of the form `<client>/consent/verify?token=...`. If SMTP fails, the API can still return success and the log contains `MAILER ERROR`. Record the log link so CONSENT-007 can be executed.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** Critical
- **Test Type:** Positive
- **Regression Required?** Critical smoke
- **Notes:** Do not expect the admin dashboard "Pending Minor Consents" count to increase. That count reads a different `ParentalConsent` collection, which this flow does not write.

### CONSENT-005

- **Module:** Minor / Guardian Consent
- **Feature:** Pending consent state
- **Test Scenario:** After minor onboarding, the student sees the waiting screen.
- **Preconditions:** CONSENT-004 completed in this session.
- **Test Data:** That minor student.
- **Steps:**
  1. Stay on the onboarding result.
  2. Refresh `/onboarding`.
- **Expected Result:** The page states that a verification link was sent to the guardian email. It does not open the student dashboard.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** Critical
- **Test Type:** Positive
- **Regression Required?** Critical smoke
- **Notes:**

### CONSENT-006

- **Module:** Minor / Guardian Consent
- **Feature:** Student blocked while consent is pending
- **Test Scenario:** A pending-consent student cannot use the dashboard, matching, or a new login.
- **Preconditions:** User status `pending_consent`. Token from registration may still be in the browser until the next protected student call.
- **Test Data:** That student.
- **Steps:**
  1. Open `/dashboard/student`.
  2. Call `GET /api/v1/matching` with the student token.
  3. Log out and try to sign in again.
- **Expected Result:** Dashboard navigation returns to `/onboarding`. Matching returns `403` with `requiresConsent: true` and the parental-consent message. Login returns the same `403` and does not issue a usable dashboard session.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** Critical
- **Test Type:** Negative / Security
- **Regression Required?** Critical smoke
- **Notes:**

### CONSENT-007

- **Module:** Minor / Guardian Consent
- **Feature:** Guardian approval
- **Test Scenario:** Opening the consent link and approving activates the student.
- **Preconditions:** A consent link from the server log in CONSENT-004. The token is unused.
- **Test Data:** That token.
- **Steps:**
  1. Open `/consent/verify?token=<token>` while signed out.
  2. Confirm the student name is shown.
  3. Approve consent.
  4. Call `GET /api/v1/consent/verify?token=<token>` and then `POST /api/v1/consent/approve` with `{ "token": "<token>" }` if the screen is unclear.
- **Expected Result:** Verify returns `200` and the student summary. Approve returns `200` and `Account verified successfully.` The user status becomes `active` and `consentApprovedAt` is set.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** Critical
- **Test Type:** Positive
- **Regression Required?** Critical smoke
- **Notes:** The verify page is public. It does not require the student to be signed in.

### CONSENT-008

- **Module:** Minor / Guardian Consent
- **Feature:** Student becomes active after approval
- **Test Scenario:** The student can sign in after guardian approval.
- **Preconditions:** CONSENT-007 passed. Student is onboarded.
- **Test Data:** Minor student email and password.
- **Steps:**
  1. Sign in.
  2. Open `/dashboard/student`.
- **Expected Result:** Login returns `200`. The student is not sent back to the consent waiting screen. The dashboard opens. Status remains `active` after refresh.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** Critical
- **Test Type:** Positive
- **Regression Required?** Critical smoke
- **Notes:** Province and municipality may still be empty, so Match Feed can still show the complete-profile message. That is profile completion, not consent.

### CONSENT-009

- **Module:** Minor / Guardian Consent
- **Feature:** Adult student does not require guardian consent
- **Test Scenario:** Adult onboarding never enters `pending_consent`.
- **Preconditions:** New student.
- **Test Data:** Date of birth `2004-05-15`, no guardian fields, `isMinor` false.
- **Steps:**
  1. Complete adult onboarding.
  2. Sign out and sign in.
- **Expected Result:** Status is `active`. No guardian email is stored. Login is allowed. No consent screen appears.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** High
- **Test Type:** Positive
- **Regression Required?** Full regression
- **Notes:**

### CONSENT-010

- **Module:** Minor / Guardian Consent
- **Feature:** Unauthorized consent resend
- **Test Scenario:** Only the pending student can resend their own consent email.
- **Preconditions:** One pending-consent student and one other account.
- **Test Data:** Other account token. Body may include the pending student's user id.
- **Steps:**
  1. Call `POST /api/v1/consent/resend` with no token.
  2. Call it as a provider or as an active adult student.
  3. As the pending student, call it with a different `userId`.
  4. As the pending student, call it with a different `guardianEmail`.
- **Expected Result:**
  - No token: `401`.
  - Wrong role or status: `403` and `Only a student awaiting guardian consent can resend the consent email.`
  - Different user id: `403` and `You can only resend consent for your own account.`
  - Different guardian email: `400` and `Guardian email does not match the address on this account.`
- **Actual Result:**
- **Status:** Not Run
- **Priority:** High
- **Test Type:** Negative / Security
- **Regression Required?** Full regression
- **Notes:** The pending student can resend for their own stored guardian email. A second route `POST /api/v1/user/consent/resend` uses the same rules.

### CONSENT-011

- **Module:** Minor / Guardian Consent
- **Feature:** Invalid consent token
- **Test Scenario:** Missing, tampered, and wrong-purpose tokens are rejected.
- **Preconditions:** None.
- **Test Data:** No token, token `abc`, and a normal login JWT.
- **Steps:**
  1. Open `/consent/verify` with no query token.
  2. Open `/consent/verify?token=abc`.
  3. `POST /api/v1/consent/approve` with `{ "token": "abc" }`.
- **Expected Result:** Missing token returns `400` and `Verification token is missing`. A bad token returns `400` and an invalid or expired token message. No user status changes.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** High
- **Test Type:** Negative / Security
- **Regression Required?** Full regression
- **Notes:** Consent tokens expire after 7 days. An expired token returns `Consent token has expired. Please request a new one.`

### CONSENT-012

- **Module:** Minor / Guardian Consent
- **Feature:** Consent status persistence
- **Test Scenario:** Pending and approved statuses remain after refresh and a new login attempt.
- **Preconditions:** One student left pending, and the student from CONSENT-008.
- **Test Data:** Both accounts.
- **Steps:**
  1. Refresh `/onboarding` as the pending student.
  2. Sign out and try to sign in.
  3. Sign in as the approved student and refresh the dashboard.
- **Expected Result:** The pending student still sees the guardian waiting state and still cannot log into the dashboard. The approved student remains active.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** High
- **Test Type:** Persistence
- **Regression Required?** Full regression
- **Notes:**

---

# 5. PROVIDER REGISTRATION & ONBOARDING

### PROV-001

- **Module:** Provider Registration & Onboarding
- **Feature:** Provider registration
- **Test Scenario:** Provider signup creates a user and a pending provider record.
- **Preconditions:** Unused email.
- **Test Data:** Organization `QA Foundation <stamp>`, email `qa.prov001.<stamp>@example.com`, password `Secret1`.
- **Steps:**
  1. Register as Sponsor / Provider.
  2. Read `GET /api/v1/auth/me`.
- **Expected Result:** Role is `provider`, `isOnboarded` is false, verification status is `Pending`. The UI ends on `/provider/onboarding`.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** Critical
- **Test Type:** Positive
- **Regression Required?** Critical smoke
- **Notes:**

### PROV-002

- **Module:** Provider Registration & Onboarding
- **Feature:** Provider onboarding page
- **Test Scenario:** A new provider is kept on onboarding until it is submitted.
- **Preconditions:** PROV-001 account.
- **Test Data:** That account.
- **Steps:**
  1. Open `/dashboard/provider`.
  2. Open `/dashboard/provider/create`.
  3. Open `/provider/onboarding`.
- **Expected Result:** Dashboard and create redirect to `/provider/onboarding`. The onboarding form stays open.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** Critical
- **Test Type:** Navigation
- **Regression Required?** Critical smoke
- **Notes:**

### PROV-003

- **Module:** Provider Registration & Onboarding
- **Feature:** Organization and representative information
- **Test Scenario:** Onboarding stores organization, address, and representative fields.
- **Preconditions:** Provider on `/provider/onboarding`.
- **Test Data:** Institution name `QA Foundation <stamp>`, type `Non-Profit / NGO`, website `https://example.com`, contact number `09171234567`, street `1 Test Street`, city `Legazpi`, province `Albay`, region `Bicol Region`, representative name `QA Rep`, title `Director`, work email `qa.rep.<stamp>@example.com`.
- **Steps:**
  1. Fill those fields.
  2. Do not submit yet.
  3. Submit only after PROV-004's file is attached, then open Organization Verification or `GET /api/v1/provider/profile`.
- **Expected Result:** Institution name, type, website, contact number, address, and representative name, title, and work email match the form.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** High
- **Test Type:** Positive
- **Regression Required?** Full regression
- **Notes:** Submit is covered with the document in PROV-005. This case checks the saved fields.

### PROV-004

- **Module:** Provider Registration & Onboarding
- **Feature:** Verification document upload
- **Test Scenario:** Onboarding requires one PDF, JPG, JPEG, or PNG of at most 10 MB.
- **Preconditions:** Provider onboarding form filled.
- **Test Data:** A small `.pdf`. Then a `.txt` renamed or a real `.txt`. Then a file larger than 10 MB if available.
- **Steps:**
  1. Submit with no file.
  2. Submit with a `.txt` file.
  3. Submit with a valid small PDF.
- **Expected Result:** No file returns `400` and `Please upload a valid verification document (PDF, PNG, JPG).` A disallowed type is rejected with `Only .pdf, .jpg, .jpeg, and .png files are allowed!` A valid PDF is accepted and stored in GridFS. The saved document URL is `/api/v1/documents/<filename>`, not a public `/uploads/...` path.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** Critical
- **Test Type:** Validation
- **Regression Required?** Critical smoke
- **Notes:**

### PROV-005

- **Module:** Provider Registration & Onboarding
- **Feature:** Pending status after submit
- **Test Scenario:** Successful onboarding sets Pending Review and opens the pending page.
- **Preconditions:** PROV-004 valid PDF submitted with the organization fields.
- **Test Data:** That provider.
- **Steps:**
  1. Complete submit.
  2. Read the next page and `GET /api/v1/auth/me`.
- **Expected Result:** The API message is `Verification documents submitted successfully. Account pending admin review.` Verification status is `Pending Review`. User `isOnboarded` is true. The browser opens `/provider/pending-approval`, which says the application is being processed.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** Critical
- **Test Type:** Positive
- **Regression Required?** Critical smoke
- **Notes:** Email to the admin or representative may fail if SMTP is not configured. The onboarding response can still succeed.

### PROV-006

- **Module:** Provider Registration & Onboarding
- **Feature:** Pending provider restrictions
- **Test Scenario:** A pending provider cannot use the provider dashboard or create a scholarship.
- **Preconditions:** Provider status `Pending Review`.
- **Test Data:** That provider.
- **Steps:**
  1. Open `/dashboard/provider`.
  2. Open `/dashboard/provider/listings`.
  3. Open `/dashboard/provider/create`.
  4. Open `/dashboard/provider/verification`.
  5. `POST /api/v1/scholarships` with a valid body and this token.
- **Expected Result:** Dashboard, listings, and create redirect to `/provider/pending-approval`. Verification stays available. Scholarship create returns `403` and `Only verified providers can create scholarships`.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** Critical
- **Test Type:** Negative
- **Regression Required?** Critical smoke
- **Notes:** `Approved` is treated as verified by the redirect helper, but scholarship create allows only the exact status `Verified`. Admin approval writes `Verified`.

### PROV-007

- **Module:** Provider Registration & Onboarding
- **Feature:** Student cannot open provider onboarding
- **Test Scenario:** A student is turned away from provider onboarding.
- **Preconditions:** Signed in as a student.
- **Test Data:** Student session.
- **Steps:**
  1. Open `/provider/onboarding`.
  2. Open `/provider/pending-approval`.
- **Expected Result:** Both URLs redirect to `/dashboard/student`.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** High
- **Test Type:** Negative / Security
- **Regression Required?** Full regression
- **Notes:**

### PROV-008

- **Module:** Provider Registration & Onboarding
- **Feature:** Guest cannot open provider onboarding
- **Test Scenario:** A signed-out visitor is sent to sign-in.
- **Preconditions:** Logged out.
- **Test Data:** None.
- **Steps:**
  1. Open `/provider/onboarding`.
- **Expected Result:** Redirect to `/auth?mode=signin`.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** High
- **Test Type:** Negative
- **Regression Required?** Full regression
- **Notes:**

### PROV-009

- **Module:** Provider Registration & Onboarding
- **Feature:** Provider cannot modify verification status
- **Test Scenario:** The provider profile update rejects verification fields.
- **Preconditions:** Pending or verified provider token.
- **Test Data:** `PUT /api/v1/provider/profile` body `{ "verificationStatus": "Verified" }`.
- **Steps:**
  1. Send that request.
  2. Reload organization verification.
- **Expected Result:** `403` and `Providers cannot change their own verification status.` The stored status is unchanged. The verification page has no control that sets status to Verified or Rejected.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** Critical
- **Test Type:** Negative / Security
- **Regression Required?** Critical smoke
- **Notes:** The same rejection applies to `rejectionReason`, `verifiedAt`, `submittedAt`, and `verificationDocuments` in the body.

### PROV-010

- **Module:** Provider Registration & Onboarding
- **Feature:** Organization verification page
- **Test Scenario:** The provider can read their own verification state and document.
- **Preconditions:** Onboarding submitted.
- **Test Data:** That provider.
- **Steps:**
  1. Open `/dashboard/provider/verification`.
- **Expected Result:** The page shows the organization name and status `Pending Review` with the under-review message. The uploaded document is listed. Opening it uses the protected document route.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** High
- **Test Type:** Positive
- **Regression Required?** Full regression
- **Notes:** Pending providers are allowed to stay on this dashboard path.

### PROV-011

- **Module:** Provider Registration & Onboarding
- **Feature:** Performance analytics
- **Test Scenario:** Analytics is simulated because no analytics API exists.
- **Preconditions:** Verified provider, so the page is reachable. There is no `GET /api/v1/provider/analytics` route.
- **Test Data:** None.
- **Steps:**
  1. Open `/dashboard/provider/analytics`.
  2. Change the time range.
  3. Use Export Report.
- **Expected Result:** The page shows `Backend API offline. Showing simulated metrics for range: ...`. Numbers such as impressions are generated in the browser. Export downloads a CSV built from those simulated rows. The page does not say the figures were loaded from the database.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** Medium
- **Test Type:** Prototype
- **Regression Required?** Full regression
- **Notes:** Prototype-only. A failure is a missing warning or a claim that live analytics were saved.

### PROV-012

- **Module:** Provider Registration & Onboarding
- **Feature:** Empty provider state before onboarding
- **Test Scenario:** A registered provider who has not submitted onboarding is not verified.
- **Preconditions:** PROV-001, form not submitted.
- **Test Data:** That account.
- **Steps:**
  1. Sign out and sign in again.
- **Expected Result:** The app returns to `/provider/onboarding`. Verification status is still `Pending`. Scholarship create is not available.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** Medium
- **Test Type:** Persistence
- **Regression Required?** Full regression
- **Notes:**

---

# 6. PROVIDER VERIFICATION

### VER-001

- **Module:** Provider Verification
- **Feature:** Pending status
- **Test Scenario:** A submitted provider remains Pending Review until an admin acts.
- **Preconditions:** PROV-005 completed.
- **Test Data:** That provider.
- **Steps:**
  1. Refresh `/provider/pending-approval`.
  2. Sign out and sign in.
- **Expected Result:** Sign-in still ends on `/provider/pending-approval`. Status remains `Pending Review`.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** High
- **Test Type:** Persistence
- **Regression Required?** Full regression
- **Notes:**

### VER-002

- **Module:** Provider Verification
- **Feature:** Pending provider cannot create a scholarship
- **Test Scenario:** Create is blocked in the UI and the API.
- **Preconditions:** Pending Review provider.
- **Test Data:** Shared scholarship JSON and the pending token.
- **Steps:**
  1. Try to open `/dashboard/provider/create`.
  2. `POST /api/v1/scholarships` with the pending token.
- **Expected Result:** The UI redirects to pending approval. The API returns `403` and `Only verified providers can create scholarships`. No scholarship is created.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** Critical
- **Test Type:** Negative
- **Regression Required?** Critical smoke
- **Notes:**

### VER-003

- **Module:** Provider Verification
- **Feature:** Verification queue
- **Test Scenario:** Admin sees the pending provider in the queue.
- **Preconditions:** Admin signed in. One Pending Review provider.
- **Test Data:** That provider's organization name.
- **Steps:**
  1. Open `/dashboard/admin/verification`.
  2. Leave the filter on **Pending Review**.
- **Expected Result:** The provider appears with status pending. `GET /api/v1/admin/verifications` returns `200` and includes that provider.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** Critical
- **Test Type:** Positive
- **Regression Required?** Critical smoke
- **Notes:**

### VER-004

- **Module:** Provider Verification
- **Feature:** Provider details and documents
- **Test Scenario:** Admin can read the provider record and open the verification file.
- **Preconditions:** VER-003 provider with an uploaded PDF.
- **Test Data:** Provider id from the queue.
- **Steps:**
  1. Open the provider row.
  2. Open the document.
  3. Optionally call `GET /api/v1/admin/providers/<providerId>` as admin.
- **Expected Result:** Organization, representative, and status are visible. The document request goes to `/api/v1/documents/<filename>` with the admin token and returns the file. The API detail call returns `200`.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** High
- **Test Type:** Positive
- **Regression Required?** Full regression
- **Notes:**

### VER-005

- **Module:** Provider Verification
- **Feature:** Provider cannot self-approve
- **Test Scenario:** The provider has no approve control, and the admin verify route rejects them.
- **Preconditions:** Pending provider token.
- **Test Data:** Their provider id.
- **Steps:**
  1. Confirm the verification page has no Approve button.
  2. `PATCH /api/v1/admin/verifications/<id>/status` with `{ "status": "APPROVED" }` and the provider token.
- **Expected Result:** The page cannot change status. The API returns `403`.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** Critical
- **Test Type:** Negative / Security
- **Regression Required?** Critical smoke
- **Notes:** Same rule as PROV-009.

### VER-006

- **Module:** Provider Verification
- **Feature:** Admin approval
- **Test Scenario:** Admin approval sets verification status to Verified.
- **Preconditions:** Pending provider in the queue. Use a provider created for this run.
- **Test Data:** Status `APPROVED`.
- **Steps:**
  1. On the queue, choose Approve and confirm.
  2. Read the provider record.
- **Expected Result:** The UI shows Verified. `PATCH /api/v1/admin/verifications/<id>/status` returns `200`. Stored `verificationStatus` is `Verified`, `verifiedAt` is set, and `rejectionReason` is cleared. The linked user `isVerified` is true.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** Critical
- **Test Type:** Positive
- **Regression Required?** Critical smoke
- **Notes:** Sending status `VERIFIED` has the same effect. Approval email is attempted and may fail without SMTP. Status must still change.

### VER-007

- **Module:** Provider Verification
- **Feature:** Approval persists after refresh
- **Test Scenario:** Verified status remains after refresh and a new admin session.
- **Preconditions:** VER-006 passed.
- **Test Data:** That provider.
- **Steps:**
  1. Refresh the verification queue.
  2. Filter to **Verified**.
  3. Sign out, sign in as admin, and open the queue again.
- **Expected Result:** The provider stays Verified and is not back in Pending Review.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** Critical
- **Test Type:** Persistence
- **Regression Required?** Critical smoke
- **Notes:**

### VER-008

- **Module:** Provider Verification
- **Feature:** Verified provider permissions
- **Test Scenario:** After approval, the provider can open the dashboard and create a scholarship.
- **Preconditions:** VER-006 provider. Sign in as that provider.
- **Test Data:** Shared scholarship fields with a unique name `QA Verified Create <stamp>`.
- **Steps:**
  1. Sign in.
  2. Open `/dashboard/provider`.
  3. Open `/dashboard/provider/create` and publish the scholarship.
- **Expected Result:** Sign-in ends on `/dashboard/provider`, not pending approval. The dashboard identifies the organization as verified. Create returns `201` and `Scholarship created successfully`.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** Critical
- **Test Type:** Positive
- **Regression Required?** Critical smoke
- **Notes:**

### VER-009

- **Module:** Provider Verification
- **Feature:** Rejection requires a reason
- **Test Scenario:** Reject with an empty reason does not change status.
- **Preconditions:** A different Pending Review provider than the one approved in VER-006.
- **Test Data:** Empty reason.
- **Steps:**
  1. Choose Reject and try to confirm without a reason.
  2. `PATCH /api/v1/admin/verifications/<id>/status` with `{ "status": "REJECTED", "rejectionReason": "  " }`.
- **Expected Result:** The UI asks for a reason and does not send a successful reject. The API returns `400` and `A rejection reason is required when rejecting an application.` Status stays Pending Review.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** Critical
- **Test Type:** Validation
- **Regression Required?** Critical smoke
- **Notes:**

### VER-010

- **Module:** Provider Verification
- **Feature:** Admin rejection
- **Test Scenario:** A reason is stored and the provider becomes Rejected.
- **Preconditions:** Pending provider from VER-009.
- **Test Data:** Reason `Registration document is unreadable.`
- **Steps:**
  1. Reject with that reason.
  2. Read the queue row and the API response.
- **Expected Result:** Status is `Rejected`. `rejectionReason` is the sentence above. `verifiedAt` is null. The queue can show the reason on the row.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** Critical
- **Test Type:** Positive
- **Regression Required?** Critical smoke
- **Notes:**

### VER-011

- **Module:** Provider Verification
- **Feature:** Rejection persists after refresh
- **Test Scenario:** Rejection and the reason remain after refresh.
- **Preconditions:** VER-010 passed.
- **Test Data:** That provider.
- **Steps:**
  1. Refresh the queue.
  2. Filter to **Rejected**.
  3. Sign out and sign in as admin again.
- **Expected Result:** Status is still Rejected and the same reason is visible.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** High
- **Test Type:** Persistence
- **Regression Required?** Full regression
- **Notes:**

### VER-012

- **Module:** Provider Verification
- **Feature:** Rejected provider login
- **Test Scenario:** A rejected provider cannot sign in.
- **Preconditions:** VER-010 account, currently signed out.
- **Test Data:** That email, password, and reason.
- **Steps:**
  1. Open `/auth?mode=signin`.
  2. Submit the rejected provider credentials.
- **Expected Result:** Login stays on the sign-in page. The API returns `403`. The error includes `Your provider application was rejected. Reason: Registration document is unreadable.`
- **Actual Result:**
- **Status:** Not Run
- **Priority:** Critical
- **Test Type:** Negative
- **Regression Required?** Critical smoke
- **Notes:** The form displays `message` when present. The auth error handler returns `error`. If the screen shows a generic sentence, confirm the Network response still contains the reason. Record a defect if the reason is missing from the response.

### VER-013

- **Module:** Provider Verification
- **Feature:** Existing session after rejection
- **Test Scenario:** A provider who was signed in when rejected cannot keep using the API.
- **Preconditions:** Provider signed in and still Pending. Admin rejects that provider in another session.
- **Test Data:** The provider's existing token.
- **Steps:**
  1. As admin, reject the provider with a reason.
  2. As the provider, refresh or call `GET /api/v1/provider/profile`.
  3. Call `GET /api/v1/auth/logout` with the same token.
- **Expected Result:** Profile and other protected calls return `403` and the rejection reason. Logout is still allowed and returns `200`. After refresh, the app clears the session because `/auth/me` fails.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** Critical
- **Test Type:** Negative / Security
- **Regression Required?** Critical smoke
- **Notes:**

### VER-014

- **Module:** Provider Verification
- **Feature:** Rejected provider cannot create a scholarship
- **Test Scenario:** Even a copied token cannot create a listing after rejection.
- **Preconditions:** VER-013 token, or a fresh login attempt.
- **Test Data:** Valid scholarship body.
- **Steps:**
  1. `POST /api/v1/scholarships` with the rejected provider token.
  2. Try to sign in and open create.
- **Expected Result:** The API returns `403` with the rejection reason before scholarship creation. Sign-in does not reach the create page. No scholarship is created.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** Critical
- **Test Type:** Negative
- **Regression Required?** Full regression
- **Notes:**

---

# 7. SCHOLARSHIP MANAGEMENT

Create and edit cases require a **Verified** provider. Use the provider from VER-008 or a seeded verified provider.

### SCH-001

- **Module:** Scholarship Management
- **Feature:** Provider creates a scholarship
- **Test Scenario:** A verified provider can publish a valid listing.
- **Preconditions:** Verified provider signed in.
- **Test Data:** Shared matching scholarship, name `QA College Grant <stamp>`.
- **Steps:**
  1. Open `/dashboard/provider/create`.
  2. Enter the shared fields, including both grading scales when the form requires them.
  3. Publish.
- **Expected Result:** `POST /api/v1/scholarships` returns `201`. The listing appears on `/dashboard/provider/listings` with status Open. `providerId` is the signed-in provider, even if the body tried to send another id.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** Critical
- **Test Type:** Positive
- **Regression Required?** Critical smoke
- **Notes:**

### SCH-002

- **Module:** Scholarship Management
- **Feature:** Required field validation
- **Test Scenario:** A listing without name, description, grant value, deadline, or application URL is not created.
- **Preconditions:** Verified provider.
- **Test Data:** Body missing `name`. Repeat with missing `applicationURL` and missing `deadline`.
- **Steps:**
  1. Submit the create form with the name empty.
  2. If the form blocks it, also call the API with the incomplete JSON.
- **Expected Result:** No listing is added. The API returns the validation message, including `At least one academic grading scale requirement is required.` when no scale is sent, or a required-field message for name, description, grant value, deadline, or application URL.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** Critical
- **Test Type:** Validation
- **Regression Required?** Critical smoke
- **Notes:** The scholarship controller returns validation failures as `500` with `message` set to the validation text. The listing must still be absent.

### SCH-003

- **Module:** Scholarship Management
- **Feature:** Academic requirements
- **Test Scenario:** The provider can save a maximum GWA on the 1.00–5.00 scale and a minimum GPA on the 60–100 scale.
- **Preconditions:** Create form open.
- **Test Data:** `1.00-5.00` maximum `2.00`, and `60-100` minimum `80`.
- **Steps:**
  1. Enter both scales.
  2. Leave the 1.00–5.00 maximum empty and try to continue.
  3. Save a listing that includes both values.
- **Expected Result:** An empty 1.00–5.00 maximum shows `Maximum Allowable GWA is required for the 1.00-5.00 scale.` An empty 60–100 minimum shows `Minimum Required GPA is required for the 60-100 scale.` A saved listing stores both entries on `academicRequirements`.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** High
- **Test Type:** Validation
- **Regression Required?** Full regression
- **Notes:** On the 1.00–5.00 scale the stored number is the maximum allowable GWA. On 60–100 it is the minimum score.

### SCH-004

- **Module:** Scholarship Management
- **Feature:** Income requirement
- **Test Scenario:** A monthly income cap is saved, and an invalid cap is blocked in the form.
- **Preconditions:** Verified provider.
- **Test Data:** Max monthly income `21190`. Then a negative value.
- **Steps:**
  1. Save a listing with cap `21190`.
  2. Try a negative cap in the form.
- **Expected Result:** The saved scholarship has `incomeRequirement.maxMonthlyIncome` `21190`. A negative cap is rejected by the form or by schema validation and is not stored.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** High
- **Test Type:** Positive / Validation
- **Regression Required?** Full regression
- **Notes:** Leaving the cap empty means no income hard filter.

### SCH-005

- **Module:** Scholarship Management
- **Feature:** Location requirement
- **Test Scenario:** Nationwide, region, province, and municipality scopes can be saved.
- **Preconditions:** Verified provider.
- **Test Data:** One listing for each scope: Nationwide; Region `Bicol Region`; Province `Albay`; Municipality a real city from the form.
- **Steps:**
  1. Create or edit four listings, one per scope.
  2. Reopen each listing.
- **Expected Result:** Each scholarship stores `hardFilters.geographicLocation.scope` and the matching place list. Nationwide does not require a place. Region, province, and municipality keep the selected place.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** High
- **Test Type:** Positive
- **Regression Required?** Full regression
- **Notes:**

### SCH-006

- **Module:** Scholarship Management
- **Feature:** Course requirement
- **Test Scenario:** Selected courses are stored, and an empty course list means no course limit.
- **Preconditions:** Verified provider.
- **Test Data:** Course `BS Computer Science`. Second listing with no course selected.
- **Steps:**
  1. Save both listings.
  2. Reopen them.
- **Expected Result:** The first `hardFilters.courseProgram` contains `BS Computer Science`. The second is an empty list.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** High
- **Test Type:** Positive
- **Regression Required?** Full regression
- **Notes:**

### SCH-007

- **Module:** Scholarship Management
- **Feature:** Required and preferred tags
- **Test Scenario:** A tag can be Exclusive or Preferred, not both.
- **Preconditions:** Create form open.
- **Test Data:** Required tag `Person with Disability (PWD)`. Preferred tag `Working Student`.
- **Steps:**
  1. Mark PWD as required.
  2. Mark Working Student as preferred.
  3. Mark PWD as preferred and confirm it leaves the required list.
  4. Save with PWD required and Working Student preferred.
- **Expected Result:** The saved `specialTags` contain PWD with mode `Exclusive` and Working Student with mode `Preferred`. Choosing one mode removes the other for that tag.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** High
- **Test Type:** Positive
- **Regression Required?** Full regression
- **Notes:** Exclusive is the hard filter. Preferred affects score only.

### SCH-008

- **Module:** Scholarship Management
- **Feature:** Provider ranking weights
- **Test Scenario:** Weights must total 100, and each weight must stay in range.
- **Preconditions:** Create form open.
- **Test Data:** `50 / 50 / 0` (valid). Then `40 / 40 / 30` (110). Then tags `40`.
- **Steps:**
  1. Set 50, 50, and 0 and save if the rest of the form is valid.
  2. Set a total other than 100.
  3. Set tags weight to 40.
- **Expected Result:** Total not equal to 100 shows `Total ranking weights must equal exactly 100%.` Tags outside 0–30 are rejected. GWA and income weights outside 20–70 are rejected by the form or the schema. A valid set is stored as fractions that sum to 1 (`0.5`, `0.5`, `0`).
- **Actual Result:**
- **Status:** Not Run
- **Priority:** High
- **Test Type:** Validation
- **Regression Required?** Full regression
- **Notes:** Default weights are 40 / 40 / 20.

### SCH-009

- **Module:** Scholarship Management
- **Feature:** Application URL and deadline
- **Test Scenario:** Both fields are required and are shown again after save.
- **Preconditions:** Verified provider.
- **Test Data:** URL `https://example.com/apply`, deadline 30 days ahead.
- **Steps:**
  1. Save a listing with those values.
  2. Reopen it.
  3. Try to save with the URL cleared.
- **Expected Result:** The saved listing shows the same URL and deadline. A blank URL or deadline does not replace the listing with empty values.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** High
- **Test Type:** Validation
- **Regression Required?** Full regression
- **Notes:** A date-only deadline stays open through 23:59:59.999 Asia/Manila on that date.

### SCH-010

- **Module:** Scholarship Management
- **Feature:** Open and Closed status
- **Test Scenario:** A new listing is Open, and the provider can close and reopen it.
- **Preconditions:** An Open listing owned by the provider. Deadline still in the future.
- **Test Data:** That listing.
- **Steps:**
  1. Confirm the new listing status is Open.
  2. Close it from the listings page and confirm.
  3. Refresh.
  4. Open it again.
- **Expected Result:** Close calls `PATCH /api/v1/scholarships/<id>/status` with `Closed` and returns `200`. Refresh still shows Closed. Reopen sets `Open`. A status other than Open or Closed returns `400` and `Status must be either Open or Closed`.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** High
- **Test Type:** Positive
- **Regression Required?** Full regression
- **Notes:** Closing does not archive the listing.

### SCH-011

- **Module:** Scholarship Management
- **Feature:** Edit scholarship
- **Test Scenario:** The owner can change the name and grant value.
- **Preconditions:** Listing from SCH-001.
- **Test Data:** New name `QA College Grant Edited`.
- **Steps:**
  1. Open the listing in edit mode.
  2. Change the name and save.
  3. Refresh the listings page.
- **Expected Result:** `PUT /api/v1/scholarships/<id>` returns `200`. The new name persists. Provider id, archived flag, and status are not replaced by extra fields in the body.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** High
- **Test Type:** Positive / Persistence
- **Regression Required?** Full regression
- **Notes:** Editable fields are name, type, description, benefits, grant value, academic requirements, hard filters, income, tags, weights, ranking mode, deadline, and application URL.

### SCH-012

- **Module:** Scholarship Management
- **Feature:** Archive scholarship
- **Test Scenario:** Archive hides the listing from the provider's active list and cannot be repeated.
- **Preconditions:** An unarchived listing owned by the provider.
- **Test Data:** That listing id.
- **Steps:**
  1. Archive it and confirm the prompt.
  2. Refresh listings.
  3. Call `PATCH /api/v1/scholarships/<id>/archive` again.
- **Expected Result:** The first call returns `200` and `Scholarship archived successfully.` The listing disappears from `GET /api/v1/scholarships/my`, which only returns `isArchived: false`. The second call returns `400` and `Scholarship is already archived`.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** High
- **Test Type:** Positive / Negative
- **Regression Required?** Full regression
- **Notes:** There is no unarchive endpoint.

### SCH-013

- **Module:** Scholarship Management
- **Feature:** Provider sees only their own scholarships
- **Test Scenario:** Provider A does not see Provider B's listings.
- **Preconditions:** Two verified providers, each with one listing.
- **Test Data:** Both accounts.
- **Steps:**
  1. Sign in as Provider A and open listings.
  2. Copy Provider B's scholarship id.
  3. Open `/dashboard/provider/scholarships/<B id>` as Provider A.
  4. Call `GET /api/v1/scholarships/<B id>` as Provider A.
- **Expected Result:** A's list contains only A's scholarships. B's id returns `404` and `Scholarship not found` to A.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** Critical
- **Test Type:** Security
- **Regression Required?** Critical smoke
- **Notes:**

### SCH-014

- **Module:** Scholarship Management
- **Feature:** Student views scholarship details
- **Test Scenario:** A student can open a scholarship by id, including one they do not own.
- **Preconditions:** Active student and an existing scholarship id.
- **Test Data:** That id.
- **Steps:**
  1. Sign in as the student.
  2. Open `/dashboard/student/scholarships/<id>`.
- **Expected Result:** The details page loads. `GET /api/v1/scholarships/<id>` with the student token returns `200` and the scholarship. A provider token for a different owner still receives `404`.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** High
- **Test Type:** Positive
- **Regression Required?** Full regression
- **Notes:** Student details are not limited to Open scholarships. Search and matching are.

### SCH-015

- **Module:** Scholarship Management
- **Feature:** Expired scholarship
- **Test Scenario:** After the Manila deadline day, matching excludes the scholarship, and the provider list marks it Closed.
- **Preconditions:** Verified provider owns an Open scholarship whose deadline date is yesterday in Asia/Manila.
- **Test Data:** That scholarship. A complete student who would otherwise match.
- **Steps:**
  1. Call `GET /api/v1/matching` as the student before opening the provider listings.
  2. Sign in as the provider and open listings or the provider dashboard.
  3. Refresh the listing.
  4. Call matching again.
- **Expected Result:** Matching omits the scholarship as soon as the deadline day has ended, even if status is still Open. Opening listings or the provider dashboard runs expiration and sets status to `Closed`. It stays Closed if the provider later moves the deadline forward. Closed scholarships are not returned to Open by the expiration job.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** Critical
- **Test Type:** Positive
- **Regression Required?** Critical smoke
- **Notes:** There is no scheduled job in the server startup. Status changes when provider dashboard or `GET /api/v1/scholarships/my` runs.

### SCH-016

- **Module:** Scholarship Management
- **Feature:** Closed scholarship
- **Test Scenario:** A Closed listing is excluded from matching and search.
- **Preconditions:** Provider closed an otherwise eligible scholarship. Student profile is complete and would match if it were Open.
- **Test Data:** That pair.
- **Steps:**
  1. Open Match Feed and Scholarship Search as the student.
- **Expected Result:** The Closed scholarship is absent. The API match list does not contain it.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** High
- **Test Type:** Negative
- **Regression Required?** Full regression
- **Notes:**

### SCH-017

- **Module:** Scholarship Management
- **Feature:** Archived scholarship
- **Test Scenario:** An archived listing is excluded from the provider active list and from matching.
- **Preconditions:** Eligible scholarship archived by the owner.
- **Test Data:** That scholarship and a matching student.
- **Steps:**
  1. Open provider listings.
  2. Open Match Feed as the student.
- **Expected Result:** The provider active list omits it. Matching omits it. `GET /api/v1/scholarships/my` does not return it.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** High
- **Test Type:** Negative
- **Regression Required?** Full regression
- **Notes:**

### SCH-018

- **Module:** Scholarship Management
- **Feature:** Pending provider create
- **Test Scenario:** Create stays forbidden until status is exactly Verified.
- **Preconditions:** Pending Review provider.
- **Test Data:** Valid scholarship body.
- **Steps:**
  1. Repeat the create API call.
- **Expected Result:** `403` and no new scholarship. Covered with VER-002; run again if scholarship code changed independently.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** High
- **Test Type:** Negative
- **Regression Required?** Module-only
- **Notes:** Skip when provider verification was not changed and VER-002 already passed in this run.

### SCH-019

- **Module:** Scholarship Management
- **Feature:** Student cannot create a scholarship
- **Test Scenario:** A student token cannot publish a listing.
- **Preconditions:** Student token.
- **Test Data:** Valid scholarship body.
- **Steps:**
  1. `POST /api/v1/scholarships` as the student.
- **Expected Result:** `403`. No listing is created for any provider.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** High
- **Test Type:** Negative / Security
- **Regression Required?** Full regression
- **Notes:**

### SCH-020

- **Module:** Scholarship Management
- **Feature:** Custom eligibility criterion request
- **Test Scenario:** A requested criterion is stored as a request and is not used as a matching tag.
- **Preconditions:** Verified provider on the create listing page.
- **Test Data:** Criterion name `QA Custom Criterion <stamp>`, a description, and a criterion type the form allows. A second request using the existing name `Working Student`.
- **Steps:**
  1. Submit the custom request.
  2. Submit `Working Student` as if it were new.
  3. Create a scholarship and look for the custom name in its tags.
- **Expected Result:** The custom request can be saved through `POST /api/v1/provider/eligibility-criterion-requests`. `Working Student` is rejected as already supported. The custom name does not appear as a selectable matching tag and does not change match results. The admin Taxonomy page does not approve it. Taxonomy is prototype-only.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** Medium
- **Test Type:** Negative / Known limitation
- **Regression Required?** Full regression
- **Notes:** Do not expect an admin review screen for these requests. None is routed.

---

# 8. SCHOLARSHIP SEARCH

Search loads the matching API and then filters in the browser. It is not a public catalog.

### SEARCH-001

- **Module:** Scholarship Search
- **Feature:** Search scholarships
- **Test Scenario:** The keyword box filters the matched list by name and other visible text.
- **Preconditions:** Complete student profile. At least two matches, one named `QA College Grant` and another with a different name.
- **Test Data:** Query `QA College`.
- **Steps:**
  1. Open `/dashboard/student/search`.
  2. Enter `QA College`.
  3. Clear the query.
- **Expected Result:** Only matches whose title, type, description, level, region, amount, benefits, or tag text contain the query remain. Clearing the query restores the matched list. Results still come from `GET /api/v1/matching`.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** Critical
- **Test Type:** Positive
- **Regression Required?** Critical smoke
- **Notes:**

### SEARCH-002

- **Module:** Scholarship Search
- **Feature:** Filter by academic level
- **Test Scenario:** Degree Level filters on academic level.
- **Preconditions:** Complete College profile with a College match. If a Senior High match is also present, use it as the contrast.
- **Test Data:** Degree Level `Undergraduate`, then `Senior High School`.
- **Steps:**
  1. Choose **Undergraduate**.
  2. Choose **Senior High School**.
  3. Choose **All Degree Levels**.
- **Expected Result:** Undergraduate keeps academic level `College`. Senior High School keeps `Senior High School` only. Postgraduate keeps `Graduate Studies`. All restores every current match. There is no separate academic-level control beyond Degree Level.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** High
- **Test Type:** Positive
- **Regression Required?** Full regression
- **Notes:**

### SEARCH-003

- **Module:** Scholarship Search
- **Feature:** Course
- **Test Scenario:** Search has no course dropdown. Course mismatch is already removed by matching.
- **Preconditions:** Complete profile with course `BS Computer Science`. One scholarship limited to `BS Nursing`, one limited to `BS Computer Science`, both otherwise eligible.
- **Test Data:** Those two scholarships.
- **Steps:**
  1. Open Search.
  2. Inspect the filter sidebar.
- **Expected Result:** The sidebar has keyword, minimum match score, Region Coverage, Degree Level, and Target Eligibility. It has no course dropdown. The nursing-only scholarship is absent. The computer science scholarship can appear.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** High
- **Test Type:** Positive / Negative
- **Regression Required?** Full regression
- **Notes:** Do not file a defect because a course dropdown is missing. It is not implemented.

### SEARCH-004

- **Module:** Scholarship Search
- **Feature:** Filter by location
- **Test Scenario:** Region Coverage filters listed places, and Nationwide scholarships stay visible.
- **Preconditions:** Matches include one Region scholarship for `Bicol Region`, one for `National Capital Region`, and one Nationwide scholarship.
- **Test Data:** Filter `Region V (Bicol Region)`, then `NCR`.
- **Steps:**
  1. Select Region V.
  2. Select NCR.
  3. Select All Regions / Nationwide.
- **Expected Result:** Region V shows the Bicol scholarship and the Nationwide scholarship. It hides the NCR-only scholarship. NCR shows the NCR scholarship and the Nationwide scholarship. The place text must contain `bicol`, `ncr`, or `calabarzon` as implemented for those three options. There is no province or municipality filter on this page.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** High
- **Test Type:** Positive
- **Regression Required?** Full regression
- **Notes:** Options are All, Region V (Bicol Region), NCR, and Region IV-A.

### SEARCH-005

- **Module:** Scholarship Search
- **Feature:** Income
- **Test Scenario:** Search has no income dropdown. Income mismatch is already removed by matching.
- **Preconditions:** Student income `Above ₱131,484 / month`. One scholarship with monthly cap `21190` and one with no cap. Both otherwise match.
- **Test Data:** Those scholarships.
- **Steps:**
  1. Open Search and inspect filters.
  2. Compare the cards with Match Feed.
- **Expected Result:** There is no income filter. The capped scholarship is absent. The uncapped scholarship can appear. The same absence is on Match Feed.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** High
- **Test Type:** Negative
- **Regression Required?** Full regression
- **Notes:** Do not expect an income dropdown.

### SEARCH-006

- **Module:** Scholarship Search
- **Feature:** Filter by eligibility
- **Test Scenario:** Target Eligibility keeps scholarships whose tags match the selected flag.
- **Preconditions:** Two matches. One has special tag `Working Student`. The other has no special tags.
- **Test Data:** Checkbox **Working Student**.
- **Steps:**
  1. Check Working Student.
  2. Clear it.
- **Expected Result:** Only scholarships tagged Working Student, or an equivalent label in the flag map, remain. The untagged scholarship is hidden. Clearing the box shows both again. Selecting a flag does not create new matches.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** High
- **Test Type:** Positive
- **Regression Required?** Full regression
- **Notes:**

### SEARCH-007

- **Module:** Scholarship Search
- **Feature:** Empty search results
- **Test Scenario:** A query that matches nothing shows an empty state.
- **Preconditions:** Search loaded at least one real match, or zero matches.
- **Test Data:** Query `zzzz-no-such-grant`.
- **Steps:**
  1. Enter that query.
- **Expected Result:** The page says `No matching grants found.` It does not invent cards. Reset All Filters clears the query.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** High
- **Test Type:** Empty state
- **Regression Required?** Critical smoke
- **Notes:**

### SEARCH-008

- **Module:** Scholarship Search
- **Feature:** Incomplete student profile
- **Test Scenario:** Search does not list scholarships when the profile is incomplete.
- **Preconditions:** Student missing province or municipality.
- **Test Data:** That student.
- **Steps:**
  1. Open `/dashboard/student/search`.
- **Expected Result:** The complete-profile message is shown. No scholarship cards and no sample grants are shown. Matching is not presented as a successful empty catalog.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** Critical
- **Test Type:** Negative / Empty state
- **Regression Required?** Critical smoke
- **Notes:**

### SEARCH-009

- **Module:** Scholarship Search
- **Feature:** API failure
- **Test Scenario:** A failed matching request does not fall back to mock cards.
- **Preconditions:** Complete profile. Block `GET /api/v1/matching` in the browser devtools, or stop the API after the page shell loads and reload Search.
- **Test Data:** None.
- **Steps:**
  1. Force the matching request to fail.
  2. Reload Search.
- **Expected Result:** The page says scholarship matches could not be loaded, or `Unable to load scholarship matches.` The list is empty. Cards titled CHED, DOST, or SM Foundation from the public homepage do not appear here.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** Critical
- **Test Type:** API failure
- **Regression Required?** Critical smoke
- **Notes:** The public homepage featured cards are separate and static. See NAV-022.

### SEARCH-010

- **Module:** Scholarship Search
- **Feature:** Minimum match score
- **Test Scenario:** The score slider hides lower scores.
- **Preconditions:** At least one match with a known total score.
- **Test Data:** Slider at `0`, then `90`.
- **Steps:**
  1. Set the slider to 0 and note the count.
  2. Set it to 90.
- **Expected Result:** A scholarship whose total score is below 90 disappears. One at or above 90 remains. The control runs from 0 to 90 in steps of 5.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** Medium
- **Test Type:** Positive
- **Regression Required?** Full regression
- **Notes:**

### SEARCH-011

- **Module:** Scholarship Search
- **Feature:** Sort
- **Test Scenario:** Sort changes order only.
- **Preconditions:** Two or more matches with different scores and deadlines.
- **Test Data:** Sort by highest match, nearest deadline, and highest grant value.
- **Steps:**
  1. Apply each sort.
- **Expected Result:** Highest match orders by `totalScore` descending. Nearest deadline orders by deadline ascending. Highest grant value orders by the first number found in the grant value. The membership of the list does not change.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** Medium
- **Test Type:** Positive
- **Regression Required?** Module-only
- **Notes:**

### SEARCH-012

- **Module:** Scholarship Search
- **Feature:** Reset filters
- **Test Scenario:** Reset restores the default filter state.
- **Preconditions:** A keyword, a region, a degree, a flag, and a raised score are set.
- **Test Data:** Those filters.
- **Steps:**
  1. Click the reset control.
- **Expected Result:** Query is empty, region is All, degree is All, flags are cleared, and minimum score is 0. Sort returns to highest match.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** Low
- **Test Type:** Positive
- **Regression Required?** Module-only
- **Notes:**

---

# 9. MATCHING / RECOMMENDATION ENGINE

All matching cases use `GET /api/v1/matching` and Match Feed at `/dashboard/student/matches`. A failed hard filter is omitted. It is not returned with score 0.

Prepare one verified provider and edit a single scholarship between cases, or create one scholarship per case. Use the shared complete College profile unless the case changes one field.

### MATCH-001

- **Module:** Matching / Recommendation Engine
- **Feature:** Academic level
- **Test Scenario:** Academic level must match exactly.
- **Preconditions:** Complete College profile. Scholarship academic level `College`, otherwise eligible. A second scholarship with academic level `Senior High School`.
- **Test Data:** Those scholarships.
- **Steps:**
  1. Request matches.
  2. Change the student academic level to `Senior High School` with a valid SHS year and course, save, and request matches again.
- **Expected Result:** The College student receives the College scholarship and not the Senior High scholarship. After the profile becomes Senior High, the opposite is true. A blank scholarship academic level does not match.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** Critical
- **Test Type:** Positive / Negative
- **Regression Required?** Critical smoke
- **Notes:** Comparison is case-insensitive.

### MATCH-002

- **Module:** Matching / Recommendation Engine
- **Feature:** Course canonicalization
- **Test Scenario:** An alias matches the canonical course at the same academic level.
- **Preconditions:** Student course `Bachelor of Science in Computer Science`, academic level `College`. Scholarship course list contains `BS Computer Science` only.
- **Test Data:** That pair.
- **Steps:**
  1. Request matches.
- **Expected Result:** The scholarship is eligible. Those two names share the canonical id `bs-cs`. `STEM` does not match `BS Computer Science`.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** Critical
- **Test Type:** Positive
- **Regression Required?** Critical smoke
- **Notes:** Catalog aliases include `BS Computer Science` and `Bachelor of Science in Computer Science`.

### MATCH-003

- **Module:** Matching / Recommendation Engine
- **Feature:** Course mismatch
- **Test Scenario:** A different canonical course fails the hard filter.
- **Preconditions:** Student course `BS Computer Science`. Scholarship courses contain only `BS Nursing` or `Bachelor of Science in Nursing`.
- **Test Data:** That pair.
- **Steps:**
  1. Request matches.
- **Expected Result:** The scholarship is absent.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** High
- **Test Type:** Negative
- **Regression Required?** Full regression
- **Notes:**

### MATCH-004

- **Module:** Matching / Recommendation Engine
- **Feature:** Unrestricted course list
- **Test Scenario:** An empty course list does not filter by course.
- **Preconditions:** Scholarship `courseProgram` is empty. Student course is any non-empty catalog course. All other hard filters pass.
- **Test Data:** That pair.
- **Steps:**
  1. Request matches.
- **Expected Result:** The scholarship remains eligible.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** High
- **Test Type:** Positive
- **Regression Required?** Full regression
- **Notes:** A student with a blank course fails when the scholarship lists at least one course.

### MATCH-005

- **Module:** Matching / Recommendation Engine
- **Feature:** GWA on the 1.00–5.00 scale
- **Test Scenario:** Lower or equal GWA passes. A higher number fails.
- **Preconditions:** Student scale `1.00-5.00`. Scholarship maximum allowable GWA `2.00` on that scale only.
- **Test Data:** Student GWA `2.00`, then `1.25`, then `2.01`.
- **Steps:**
  1. Save each GWA and request matches.
- **Expected Result:** `2.00` and `1.25` can match. `2.01` is omitted. Values outside 1 through 5 fail this scale.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** Critical
- **Test Type:** Positive / Negative
- **Regression Required?** Critical smoke
- **Notes:** On this scale a smaller number is the better grade.

### MATCH-006

- **Module:** Matching / Recommendation Engine
- **Feature:** GWA on the 60–100 scale
- **Test Scenario:** A score at or above the minimum passes.
- **Preconditions:** Student scale `60-100`. Scholarship minimum `80` on that scale only.
- **Test Data:** Student GWA `80`, then `95`, then `79`.
- **Steps:**
  1. Save each value and request matches.
- **Expected Result:** `80` and `95` can match. `79` is omitted. Values outside 60 through 100 fail this scale.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** Critical
- **Test Type:** Positive / Negative
- **Regression Required?** Critical smoke
- **Notes:**

### MATCH-007

- **Module:** Matching / Recommendation Engine
- **Feature:** Both GWA scales on one scholarship
- **Test Scenario:** Only the requirement for the student's scale is used.
- **Preconditions:** Scholarship has `1.00-5.00` maximum `2.00` and `60-100` minimum `95`.
- **Test Data:** Student A scale `1.00-5.00`, GWA `1.75`. Student B scale `60-100`, GWA `90`.
- **Steps:**
  1. Request matches for each student.
- **Expected Result:** Student A can match because `1.75` is within `2.00`. Student A's result does not use the 95 cutoff. Student B is omitted because `90` is below `95`, even though a 1.00–5.00 rule exists on the same scholarship.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** Critical
- **Test Type:** Positive / Negative
- **Regression Required?** Critical smoke
- **Notes:** If the scholarship has no requirement for the student's scale, it fails the academic hard filter.

### MATCH-008

- **Module:** Matching / Recommendation Engine
- **Feature:** Income matching
- **Test Scenario:** A bracket passes only when its whole ceiling is at or below the monthly cap.
- **Preconditions:** Cap `21190`. No other hard filter fails.
- **Test Data:** Income `Below ₱10,000 / month` (ceiling 10000), then `₱10,001 – ₱21,190 / month` (ceiling 21190), then `₱21,191 – ₱43,828 / month` (ceiling 43828).
- **Steps:**
  1. Save each bracket and request matches.
- **Expected Result:** The first two brackets can match. The third is omitted because 43828 is above 21190.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** Critical
- **Test Type:** Positive / Negative
- **Regression Required?** Critical smoke
- **Notes:** Brackets must use the labels stored by the profile form.

### MATCH-009

- **Module:** Matching / Recommendation Engine
- **Feature:** Open-ended top income bracket
- **Test Scenario:** `Above ₱131,484 / month` never passes a numeric cap.
- **Preconditions:** Cap `999999`. Student income `Above ₱131,484 / month`.
- **Test Data:** That pair.
- **Steps:**
  1. Request matches.
- **Expected Result:** The scholarship is omitted. The top bracket has no finite ceiling.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** High
- **Test Type:** Negative
- **Regression Required?** Full regression
- **Notes:**

### MATCH-010

- **Module:** Matching / Recommendation Engine
- **Feature:** No income cap
- **Test Scenario:** A null monthly cap does not filter income.
- **Preconditions:** `maxMonthlyIncome` null or omitted. Legacy `maximumIncome` may be set to an annual number.
- **Test Data:** Student income `₱76,670 – ₱131,484 / month`.
- **Steps:**
  1. Request matches.
- **Expected Result:** Income does not remove the scholarship. The legacy annual field is not used as a monthly cap. Income score is 100 when there is no monthly cap.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** High
- **Test Type:** Positive
- **Regression Required?** Full regression
- **Notes:**

### MATCH-011

- **Module:** Matching / Recommendation Engine
- **Feature:** Region matching
- **Test Scenario:** Region scope compares only the student's region.
- **Preconditions:** Scope `Region`, regions `['Bicol Region']`. Student region `Bicol Region`, province `Albay`.
- **Test Data:** Then change student region to `National Capital Region`.
- **Steps:**
  1. Request matches for both regions.
- **Expected Result:** Bicol matches. National Capital Region does not. Province is not required to appear in the scholarship's province list for a Region scope.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** High
- **Test Type:** Positive / Negative
- **Regression Required?** Full regression
- **Notes:**

### MATCH-012

- **Module:** Matching / Recommendation Engine
- **Feature:** Province matching
- **Test Scenario:** Province scope compares only the student's province.
- **Preconditions:** Scope `Province`, provinces `['Albay']`.
- **Test Data:** Student province `Albay`, then `Camarines Sur`.
- **Steps:**
  1. Request matches for both provinces.
- **Expected Result:** Albay matches. Camarines Sur does not. Region text is not the field that decides a Province scope.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** High
- **Test Type:** Positive / Negative
- **Regression Required?** Full regression
- **Notes:**

### MATCH-013

- **Module:** Matching / Recommendation Engine
- **Feature:** Municipality matching
- **Test Scenario:** Municipality scope compares `municipalityCity`.
- **Preconditions:** Scope `Municipality` and one municipality that exists in the profile dropdown, such as a city under Albay.
- **Test Data:** Student municipality equal to that city, then a different city.
- **Steps:**
  1. Request matches for both cities.
- **Expected Result:** The exact city matches, case-insensitively. The other city does not.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** High
- **Test Type:** Positive / Negative
- **Regression Required?** Full regression
- **Notes:**

### MATCH-014

- **Module:** Matching / Recommendation Engine
- **Feature:** Nationwide scholarship
- **Test Scenario:** Nationwide scope matches any student location.
- **Preconditions:** Scope `Nationwide`. Student region `Davao Region` with a valid province and municipality. Other hard filters pass.
- **Test Data:** That pair.
- **Steps:**
  1. Request matches.
- **Expected Result:** Location does not remove the scholarship.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** High
- **Test Type:** Positive
- **Regression Required?** Full regression
- **Notes:**

### MATCH-015

- **Module:** Matching / Recommendation Engine
- **Feature:** Citizenship
- **Test Scenario:** Filipino, Any, and a mismatch behave differently.
- **Preconditions:** Three scholarships that differ only by citizenship: `Filipino`, `Any`, and `Non-Filipino`.
- **Test Data:** Student citizenship `Filipino`, then `Non-Filipino`.
- **Steps:**
  1. Request matches for each citizenship.
- **Expected Result:** A Filipino student can receive Filipino and Any, not Non-Filipino. A Non-Filipino student can receive Non-Filipino and Any, not Filipino. Blank citizenship on the scholarship does not filter. `Any` accepts both stored student values.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** High
- **Test Type:** Positive / Negative
- **Regression Required?** Full regression
- **Notes:**

### MATCH-016

- **Module:** Matching / Recommendation Engine
- **Feature:** Required eligibility tags
- **Test Scenario:** An Exclusive tag removes the student when the flag is off.
- **Preconditions:** Scholarship tag `Person with Disability (PWD)` mode `Exclusive`. Student `isPWD` false, then true. Other filters pass.
- **Test Data:** That pair.
- **Steps:**
  1. Request matches with the flag off.
  2. Turn the PWD flag on, save, and request matches again.
- **Expected Result:** The scholarship is absent while the flag is off. It can appear after the flag is on. Equivalent labels `PWD` and `PWD Status` are the same flag.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** Critical
- **Test Type:** Positive / Negative
- **Regression Required?** Critical smoke
- **Notes:** Every Exclusive tag must match. One miss removes the scholarship.

### MATCH-017

- **Module:** Matching / Recommendation Engine
- **Feature:** Preferred eligibility tags
- **Test Scenario:** Preferred tags change the score and do not remove the scholarship.
- **Preconditions:** One Preferred tag `Working Student`. Student working-student flag off, then on. No Exclusive tags. Other filters pass.
- **Test Data:** Weights 40 / 40 / 20 so the tag portion is visible.
- **Steps:**
  1. Request matches with the flag off.
  2. Turn the flag on and request matches again.
- **Expected Result:** The scholarship is present both times. Tag score is `0` when the flag is off and `100` when it is on. With one preferred tag, the total changes by `20` if GWA and income scores stay the same. No preferred tags score `100`.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** High
- **Test Type:** Positive
- **Regression Required?** Full regression
- **Notes:**

### MATCH-018

- **Module:** Matching / Recommendation Engine
- **Feature:** Provider weights
- **Test Scenario:** Changing weights changes the total and does not change eligibility.
- **Preconditions:** Eligible scholarship. GWA score, income score, and tag score are known. Start from weights 0.40 / 0.40 / 0.20.
- **Test Data:** Change to 0.70 / 0.20 / 0.10, which sums to 1.
- **Steps:**
  1. Record the total at the first weights.
  2. Save the new weights.
  3. Request matches again.
- **Expected Result:** The scholarship stays eligible. `totalScore` equals `gpaScore * gwaWeight + incomeScore * incomeWeight + tagsScore * tagsWeight`, rounded to 2 decimals and clamped from 0 to 100. The response includes the weights used.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** High
- **Test Type:** Positive
- **Regression Required?** Full regression
- **Notes:** Missing weights fall back to 0.40 / 0.40 / 0.20.

### MATCH-019

- **Module:** Matching / Recommendation Engine
- **Feature:** Ranking score
- **Test Scenario:** The shared example scores 84 and is Recommended.
- **Preconditions:** Shared complete profile and shared matching scholarship, with no preferred tags.
- **Test Data:** GWA `1.50` versus maximum `2.00`. Income `Below ₱10,000 / month`. Cap `21190`. Weights 40 / 40 / 20.
- **Steps:**
  1. Request matches.
  2. Find `QA College Grant`.
- **Expected Result:** `gpaScore` is 80, `incomeScore` is 80, `tagsScore` is 100, `totalScore` is 84, classification is `Recommended`. Boundaries: 90 or above is `Highly Recommended`, 70–89 is `Recommended`, 50–69 is `Potential Match`, below 50 is `Low Compatibility`.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** Critical
- **Test Type:** Positive
- **Regression Required?** Critical smoke
- **Notes:** GWA ratio 0 scores 60, ratio 1 scores 100. Income distance 0 scores 60, 1 scores 80, 2 or more scores 100.

### MATCH-020

- **Module:** Matching / Recommendation Engine
- **Feature:** Ranking order
- **Test Scenario:** A higher total score is listed first.
- **Preconditions:** Two eligible scholarships. One uses weights or thresholds that score higher than the other for the same student.
- **Test Data:** Those two names.
- **Steps:**
  1. Open Match Feed.
  2. Compare the order with `matches` in the API response.
- **Expected Result:** The higher `totalScore` comes first. The feed does not sort a failed scholarship into the list.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** High
- **Test Type:** Positive
- **Regression Required?** Full regression
- **Notes:** Equal scores have no separate tie-break rule. Do not fail the case only for the order of equal scores.

### MATCH-021

- **Module:** Matching / Recommendation Engine
- **Feature:** Hard-filter failure
- **Test Scenario:** A failed scholarship is omitted rather than scored.
- **Preconditions:** One scholarship that fails citizenship or GWA, and one that passes.
- **Test Data:** Those scholarships.
- **Steps:**
  1. Request matches.
- **Expected Result:** The failed scholarship is not in `matches` and has no `totalScore` in the payload. The passing scholarship can appear. `count` equals the number of returned matches.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** Critical
- **Test Type:** Negative
- **Regression Required?** Critical smoke
- **Notes:**

### MATCH-022

- **Module:** Matching / Recommendation Engine
- **Feature:** Closed scholarship excluded
- **Test Scenario:** Status Closed removes an otherwise perfect match.
- **Preconditions:** Eligible scholarship set to Closed. Deadline still in the future. Not archived.
- **Test Data:** That scholarship.
- **Steps:**
  1. Request matches.
- **Expected Result:** It is absent.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** High
- **Test Type:** Negative
- **Regression Required?** Full regression
- **Notes:**

### MATCH-023

- **Module:** Matching / Recommendation Engine
- **Feature:** Archived scholarship excluded
- **Test Scenario:** `isArchived: true` removes the scholarship even if status is Open.
- **Preconditions:** Eligible scholarship archived by the owner.
- **Test Data:** That scholarship.
- **Steps:**
  1. Request matches.
- **Expected Result:** It is absent.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** High
- **Test Type:** Negative
- **Regression Required?** Full regression
- **Notes:**

### MATCH-024

- **Module:** Matching / Recommendation Engine
- **Feature:** Expired scholarship excluded
- **Test Scenario:** A deadline that has ended in Asia/Manila removes the scholarship before status is updated.
- **Preconditions:** Status still `Open`, `isArchived` false, deadline date yesterday in Asia/Manila. Do not open provider listings before the first matching call.
- **Test Data:** That scholarship.
- **Steps:**
  1. Request matches.
  2. Then open provider listings and request matches again.
- **Expected Result:** Both matching calls omit it. After listings load, status is `Closed`.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** Critical
- **Test Type:** Negative
- **Regression Required?** Critical smoke
- **Notes:** Same rule as SCH-015.

### MATCH-025

- **Module:** Matching / Recommendation Engine
- **Feature:** Incomplete profile
- **Test Scenario:** An incomplete profile returns no matches.
- **Preconditions:** Student missing province, municipality, citizenship, GWA scale, or income.
- **Test Data:** That profile.
- **Steps:**
  1. Open Match Feed.
  2. Read `GET /api/v1/matching`.
- **Expected Result:** HTTP `200`, `success: true`, `count: 0`, `matches: []`, `profileComplete: false`. The page shows the complete-profile message and no cards. A missing profile document returns `404` and `Student profile not found`.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** Critical
- **Test Type:** Negative / Empty state
- **Regression Required?** Critical smoke
- **Notes:**

### MATCH-026

- **Module:** Matching / Recommendation Engine
- **Feature:** Complete profile returns valid matches
- **Test Scenario:** A complete eligible pair appears in Match Feed.
- **Preconditions:** Shared complete profile and shared Open scholarship owned by a verified provider.
- **Test Data:** That pair.
- **Steps:**
  1. Open `/dashboard/student/matches`.
- **Expected Result:** The scholarship is listed with a score. The incomplete-profile message is absent. Refresh shows the same scholarship.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** Critical
- **Test Type:** Positive / Persistence
- **Regression Required?** Critical smoke
- **Notes:**

### MATCH-027

- **Module:** Matching / Recommendation Engine
- **Feature:** Wrong role and signed-out access
- **Test Scenario:** Matching is student-only.
- **Preconditions:** Provider token and no token.
- **Test Data:** None.
- **Steps:**
  1. Call `GET /api/v1/matching` with no token.
  2. Call it with a provider token.
  3. Open `/dashboard/student/matches` as a provider.
- **Expected Result:** No token returns `401`. Provider token returns `403`. The provider is redirected away from Match Feed.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** High
- **Test Type:** Negative / Security
- **Regression Required?** Full regression
- **Notes:**

### MATCH-028

- **Module:** Matching / Recommendation Engine
- **Feature:** API failure on Match Feed
- **Test Scenario:** A failed matching call does not show sample scholarships.
- **Preconditions:** Complete profile. Matching request blocked or API stopped.
- **Test Data:** None.
- **Steps:**
  1. Reload Match Feed while matching fails.
- **Expected Result:** The page says scholarship matches could not be loaded. It does not show homepage sample cards.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** High
- **Test Type:** API failure
- **Regression Required?** Full regression
- **Notes:**

---

# 10. SAVED SCHOLARSHIPS

### SAVE-001

- **Module:** Saved Scholarships
- **Feature:** Save scholarship
- **Test Scenario:** A student can bookmark a scholarship from Search or Match Feed.
- **Preconditions:** Complete or incomplete is irrelevant for the API as long as a student profile document exists. Use a student who can see a scholarship card.
- **Test Data:** A visible scholarship id.
- **Steps:**
  1. Choose the bookmark control on the card.
  2. Open `/dashboard/student/saved`.
- **Expected Result:** `POST /api/v1/students/saved-scholarships/<id>` returns `201`. The saved page lists that scholarship title.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** Critical
- **Test Type:** Positive
- **Regression Required?** Critical smoke
- **Notes:** Saving the same id again returns `200` and `alreadySaved: true`. It does not create a second row.

### SAVE-002

- **Module:** Saved Scholarships
- **Feature:** Unsave scholarship
- **Test Scenario:** Removing a bookmark deletes it.
- **Preconditions:** SAVE-001 scholarship is saved.
- **Test Data:** That id.
- **Steps:**
  1. On Saved Scholarships, use the remove control.
  2. Refresh the page.
- **Expected Result:** `DELETE /api/v1/students/saved-scholarships/<id>` returns `200`. The scholarship is gone after refresh. Removing an id that is not saved returns `404`.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** High
- **Test Type:** Positive
- **Regression Required?** Full regression
- **Notes:**

### SAVE-003

- **Module:** Saved Scholarships
- **Feature:** Persistence after refresh
- **Test Scenario:** A saved scholarship remains after refresh.
- **Preconditions:** One scholarship saved.
- **Test Data:** That title.
- **Steps:**
  1. Refresh `/dashboard/student/saved`.
- **Expected Result:** The same scholarship is still listed.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** Critical
- **Test Type:** Persistence
- **Regression Required?** Critical smoke
- **Notes:**

### SAVE-004

- **Module:** Saved Scholarships
- **Feature:** Persistence after logout and login
- **Test Scenario:** A saved scholarship remains in a new session.
- **Preconditions:** SAVE-003 data.
- **Test Data:** Same student.
- **Steps:**
  1. Log out.
  2. Sign in.
  3. Open Saved Scholarships.
- **Expected Result:** The scholarship is still listed.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** Critical
- **Test Type:** Persistence
- **Regression Required?** Critical smoke
- **Notes:**

### SAVE-005

- **Module:** Saved Scholarships
- **Feature:** Expired saved scholarship
- **Test Scenario:** An expired saved scholarship remains on the saved page and is not a deadline alert.
- **Preconditions:** Student saved a scholarship, then its deadline day ended.
- **Test Data:** That saved row.
- **Steps:**
  1. Open Saved Scholarships.
  2. Open Deadline Alerts.
- **Expected Result:** Saved Scholarships still shows the row. The API includes `status` and `isArchived`. Deadline Alerts does not show it once it is Closed or the deadline is no longer open.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** High
- **Test Type:** Positive / Negative
- **Regression Required?** Full regression
- **Notes:** The saved page does not remove expired rows.

### SAVE-006

- **Module:** Saved Scholarships
- **Feature:** Archived or closed saved scholarship
- **Test Scenario:** Closed and archived scholarships stay in Saved and leave Deadline Alerts.
- **Preconditions:** A saved scholarship that the provider then closes, and another that the provider archives.
- **Test Data:** Those two ids.
- **Steps:**
  1. Open Saved Scholarships.
  2. Open Deadline Alerts.
- **Expected Result:** Both still appear under Saved if the save row exists. Neither appears under Deadline Alerts. Match Feed does not show them as new matches.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** High
- **Test Type:** Negative
- **Regression Required?** Full regression
- **Notes:**

### SAVE-007

- **Module:** Saved Scholarships
- **Feature:** Invalid save
- **Test Scenario:** A bad id or a missing profile does not create a bookmark.
- **Preconditions:** Student token. A second call as a student with no profile document, if one exists.
- **Test Data:** Id `not-an-id`, and a well-formed id that is not in the database.
- **Steps:**
  1. `POST /api/v1/students/saved-scholarships/not-an-id`.
  2. `POST` a random Mongo id.
  3. `POST` as a provider.
- **Expected Result:** Invalid id returns `400`. Unknown id returns `404` and `Scholarship not found`. Provider returns `403`. No bookmark is created.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** Medium
- **Test Type:** Negative
- **Regression Required?** Full regression
- **Notes:** A student with no profile document receives `404` and `Student profile not found`.

### SAVE-008

- **Module:** Saved Scholarships
- **Feature:** Empty state and API failure
- **Test Scenario:** No bookmarks, and a failed load, do not show fake scholarships.
- **Preconditions:** Student with no saved rows. Then block the saved-scholarships request.
- **Test Data:** None.
- **Steps:**
  1. Open Saved Scholarships with an empty list.
  2. Reload while the API fails.
- **Expected Result:** Empty data shows `No saved scholarships yet`. A failed load shows `Unable to load saved scholarships` and does not show sample grants.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** Medium
- **Test Type:** Empty state / API failure
- **Regression Required?** Full regression
- **Notes:**

---

# 11. NOTIFICATIONS / DEADLINE ALERTS

Student deadline alerts are generated for saved scholarships only. Windows are 7 days, 3 days, and 24 hours before the end of the deadline day in Asia/Manila. They are created when a scholarship is saved or when saved scholarships are loaded.

### NOTIF-001

- **Module:** Notifications / Deadline Alerts
- **Feature:** Deadline notification
- **Test Scenario:** Saving a scholarship that closes within 7 days creates a deadline notification.
- **Preconditions:** Complete enough student to have a profile. Verified provider scholarship with deadline 5 days from today, status Open, not archived.
- **Test Data:** That scholarship.
- **Steps:**
  1. Save the scholarship.
  2. Open `/dashboard/student/notifications`.
- **Expected Result:** A deadline alert for that title is shown. `GET /api/v1/students/notifications` includes a `deadline` notification whose message says the scholarship closes within 7 days. It is unread until opened.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** Critical
- **Test Type:** Positive
- **Regression Required?** Critical smoke
- **Notes:** A deadline more than 7 days away does not create an alert yet. That is expected.

### NOTIF-002

- **Module:** Notifications / Deadline Alerts
- **Feature:** Closer windows
- **Test Scenario:** A deadline inside 3 days or 24 hours uses the closer copy.
- **Preconditions:** Two saved Open scholarships, one due in 2 days and one due later today but still before the Manila end of day.
- **Test Data:** Those deadlines.
- **Steps:**
  1. Load Saved Scholarships so notifications sync.
  2. Read `GET /api/v1/students/notifications`.
- **Expected Result:** The 2-day scholarship can produce a `3d` notification (`closes within 3 days`). The same-day scholarship can produce a `24h` notification. Opening Saved again does not duplicate the same scholarship and window.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** Medium
- **Test Type:** Positive
- **Regression Required?** Full regression
- **Notes:** Skip if the tester cannot set those deadlines. NOTIF-001 is the required deadline case.

### NOTIF-003

- **Module:** Notifications / Deadline Alerts
- **Feature:** Expired scholarships
- **Test Scenario:** An expired saved scholarship is not shown as an active alert.
- **Preconditions:** A deadline notification existed, then the deadline day passed, or the scholarship was never inside an open window.
- **Test Data:** That saved scholarship.
- **Steps:**
  1. Open Deadline Alerts.
- **Expected Result:** The page does not list it. The client drops alerts whose saved scholarship fails the open-deadline check.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** High
- **Test Type:** Negative
- **Regression Required?** Full regression
- **Notes:**

### NOTIF-004

- **Module:** Notifications / Deadline Alerts
- **Feature:** Closed scholarships
- **Test Scenario:** A Closed saved scholarship is not shown.
- **Preconditions:** Saved scholarship set to Closed by the provider. Deadline may still be in the future.
- **Test Data:** That scholarship.
- **Steps:**
  1. Open Deadline Alerts.
- **Expected Result:** It is not listed, even if an old deadline notification row exists.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** High
- **Test Type:** Negative
- **Regression Required?** Full regression
- **Notes:**

### NOTIF-005

- **Module:** Notifications / Deadline Alerts
- **Feature:** Archived scholarships
- **Test Scenario:** An archived saved scholarship is not shown.
- **Preconditions:** Saved scholarship archived by the provider.
- **Test Data:** That scholarship.
- **Steps:**
  1. Open Deadline Alerts.
- **Expected Result:** It is not listed.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** High
- **Test Type:** Negative
- **Regression Required?** Full regression
- **Notes:**

### NOTIF-006

- **Module:** Notifications / Deadline Alerts
- **Feature:** Notification display and mark read
- **Test Scenario:** Opening an alert marks that notification read.
- **Preconditions:** NOTIF-001 unread alert.
- **Test Data:** That alert.
- **Steps:**
  1. Open Deadline Alerts and note Status Unread.
  2. Open the alert.
  3. Return to the list.
- **Expected Result:** The row shows the title, provider, amount, and days left. Opening it calls `PATCH /api/v1/students/notifications/<id>/read`. A later load shows Status Read. The sidebar unread marker can clear when no unread deadline alerts remain.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** High
- **Test Type:** Positive / Persistence
- **Regression Required?** Full regression
- **Notes:** Filters on the page are All, Closing Soon, and High Priority. High Priority keeps alerts inside 24 hours.

### NOTIF-007

- **Module:** Notifications / Deadline Alerts
- **Feature:** Empty state
- **Test Scenario:** A student with no active alerts sees an empty state.
- **Preconditions:** Student with no saved scholarships, or none inside an open 7-day window.
- **Test Data:** That student.
- **Steps:**
  1. Open `/dashboard/student/notifications`.
- **Expected Result:** The page says `No active deadline alerts` and tells the student to save scholarships. It does not show sample alerts.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** Medium
- **Test Type:** Empty state
- **Regression Required?** Full regression
- **Notes:**

### NOTIF-008

- **Module:** Notifications / Deadline Alerts
- **Feature:** Profile-change notification
- **Test Scenario:** Changing a critical profile field can create a profile notification, which the alerts page does not treat as a deadline card.
- **Preconditions:** Student profile exists.
- **Test Data:** Change region or GWA to a new valid value.
- **Steps:**
  1. Save the profile.
  2. Call `GET /api/v1/students/notifications`.
  3. Open Deadline Alerts.
- **Expected Result:** The API can include one unread `profile_update` notification. Deadline Alerts does not render it as a scholarship deadline card. A second critical save while that notification is unread does not add another profile-update row.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** Low
- **Test Type:** Positive
- **Regression Required?** Module-only
- **Notes:** This is separate from deadline alerts. Do not expect it on the deadline card list.

### NOTIF-009

- **Module:** Notifications / Deadline Alerts
- **Feature:** Wrong role
- **Test Scenario:** A provider cannot read student notifications.
- **Preconditions:** Provider token.
- **Test Data:** None.
- **Steps:**
  1. `GET /api/v1/students/notifications` as the provider.
- **Expected Result:** `403`.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** Medium
- **Test Type:** Negative / Security
- **Regression Required?** Module-only
- **Notes:**

---

# 12. ADMIN MODULE

### ADMIN-001

- **Module:** Admin Module
- **Feature:** Admin login
- **Test Scenario:** A seeded admin can sign in.
- **Preconditions:** Admin user exists in the database. Do not create one through signup.
- **Test Data:** Seeded admin email and password.
- **Steps:**
  1. Open `/auth?mode=signin`.
  2. Sign in.
- **Expected Result:** The app opens `/dashboard/admin`. `GET /api/v1/auth/me` shows role `admin`, `superadmin`, or `super_admin`.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** Critical
- **Test Type:** Positive
- **Regression Required?** Critical smoke
- **Notes:**

### ADMIN-002

- **Module:** Admin Module
- **Feature:** Admin dashboard
- **Test Scenario:** The dashboard loads live queue data.
- **Preconditions:** Admin signed in. API running.
- **Test Data:** None.
- **Steps:**
  1. Open `/dashboard/admin`.
  2. Refresh.
- **Expected Result:** `GET /api/v1/admin/dashboard` returns `200` with `metrics`, `pendingProviders`, `pendingListings`, and `pendingConsents`. The cards show those metric labels: Pending Verifications, Pending Minor Consents, and Active Providers. A failed request shows an error and does not replace the queue with fake providers.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** Critical
- **Test Type:** Positive / API failure
- **Regression Required?** Critical smoke
- **Notes:** Scholarship status values in this system are Open and Closed. The pending-listings query looks for statuses such as Pending and Submitted, so that list can be empty even when Open scholarships exist.

### ADMIN-003

- **Module:** Admin Module
- **Feature:** Dashboard counts
- **Test Scenario:** Pending verification count matches pending providers.
- **Preconditions:** Note the Pending Verifications number. Submit one new provider onboarding, or use a known Pending Review provider.
- **Test Data:** That provider.
- **Steps:**
  1. Refresh the admin dashboard.
  2. Compare the number with `GET /api/v1/admin/providers/pending`.
- **Expected Result:** Pending Verifications equals the number of providers whose status is Pending, Pending Review, or Submitted. Active Providers counts Approved or Verified providers. The new pending provider is included after refresh.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** High
- **Test Type:** Positive
- **Regression Required?** Full regression
- **Notes:**

### ADMIN-004

- **Module:** Admin Module
- **Feature:** Minor consent metric
- **Test Scenario:** The live guardian-consent flow does not increase Pending Minor Consents.
- **Preconditions:** Admin dashboard visible. Complete CONSENT-004.
- **Test Data:** The new pending-consent student.
- **Steps:**
  1. Refresh the admin dashboard.
  2. Open the consent area of the dashboard if it is shown.
- **Expected Result:** Pending Minor Consents does not gain a row for that student. The count reads the `ParentalConsent` collection, which registration and onboarding do not write. Do not treat a missing row as a failed consent email. Confirm consent with CONSENT-005 instead.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** High
- **Test Type:** Known limitation
- **Regression Required?** Full regression
- **Notes:** Mark Fail only if the UI claims the student consent was stored in this queue.

### ADMIN-005

- **Module:** Admin Module
- **Feature:** Verification queue
- **Test Scenario:** Filters show pending, verified, rejected, and all providers.
- **Preconditions:** At least one provider in each status, or record which statuses exist.
- **Test Data:** Those providers.
- **Steps:**
  1. Open `/dashboard/admin/verification`.
  2. Select each filter, including a filter with no rows.
- **Expected Result:** Pending Review shows pending providers. Verified and Rejected show those statuses. All shows every returned provider. An empty filter says no verification requests were found for that filter.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** High
- **Test Type:** Positive / Empty state
- **Regression Required?** Full regression
- **Notes:**

### ADMIN-006

- **Module:** Admin Module
- **Feature:** Provider details and documents
- **Test Scenario:** Admin can view the application and the uploaded file.
- **Preconditions:** Pending provider with a PDF.
- **Test Data:** That provider.
- **Steps:**
  1. Open the row.
  2. Open the document.
- **Expected Result:** Name, status, and document label are visible. The file loads through `/api/v1/documents/<filename>`. A provider with no file shows `No document file uploaded`.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** High
- **Test Type:** Positive
- **Regression Required?** Full regression
- **Notes:**

### ADMIN-007

- **Module:** Admin Module
- **Feature:** Approve provider
- **Test Scenario:** Approve persists and unlocks the provider.
- **Preconditions:** Pending provider that has not been used for a rejection case.
- **Test Data:** That provider.
- **Steps:**
  1. Approve in the queue.
  2. Refresh.
  3. Sign in as the provider.
- **Expected Result:** Status remains Verified after refresh. The provider reaches `/dashboard/provider` and can create a scholarship. This is the same outcome as VER-006 and VER-008.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** Critical
- **Test Type:** Positive / Persistence
- **Regression Required?** Critical smoke
- **Notes:**

### ADMIN-008

- **Module:** Admin Module
- **Feature:** Reject requires a reason
- **Test Scenario:** Empty rejection does not save.
- **Preconditions:** Another pending provider.
- **Test Data:** Blank reason.
- **Steps:**
  1. Start Reject and confirm with no reason.
- **Expected Result:** The UI reports that a reason is required. Status stays pending. Same rule as VER-009.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** Critical
- **Test Type:** Validation
- **Regression Required?** Critical smoke
- **Notes:**

### ADMIN-009

- **Module:** Admin Module
- **Feature:** Reject provider
- **Test Scenario:** A reason is saved and the provider is restricted.
- **Preconditions:** Pending provider.
- **Test Data:** Reason `Registration document is unreadable.`
- **Steps:**
  1. Reject with that reason.
  2. Refresh.
  3. Try to sign in as the provider.
- **Expected Result:** After refresh the status is Rejected and the reason is still shown. Login is refused with that reason. Create scholarship is impossible. Same outcome as VER-010 and VER-012.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** Critical
- **Test Type:** Positive / Persistence
- **Regression Required?** Critical smoke
- **Notes:**

### ADMIN-010

- **Module:** Admin Module
- **Feature:** Admin RBAC
- **Test Scenario:** Student and provider tokens cannot call admin APIs.
- **Preconditions:** Student token and verified provider token.
- **Test Data:** None.
- **Steps:**
  1. `GET /api/v1/admin/dashboard` as each.
  2. `PATCH` a verification status as each.
- **Expected Result:** Every call returns `403` and `Not authorized to access this route`. No status changes.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** Critical
- **Test Type:** Negative / Security
- **Regression Required?** Critical smoke
- **Notes:**

### ADMIN-011

- **Module:** Admin Module
- **Feature:** Content Moderation prototype
- **Test Scenario:** The page says it does not save moderation actions.
- **Preconditions:** Admin signed in.
- **Test Data:** Any visible report row, if the fallback list is shown.
- **Steps:**
  1. Open `/dashboard/admin/moderation`.
  2. Read the notice.
  3. Run a resolve or remove action.
  4. Refresh.
- **Expected Result:** A **Prototype only** notice says content moderation is not connected to the database and resolve or remove actions are not saved. The action shows an error that it was not saved. Refresh does not show a newly stored moderation record. The page must not show a success message that claims the listing was removed from the database.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** High
- **Test Type:** Prototype
- **Regression Required?** Full regression
- **Notes:** Prototype-only.

### ADMIN-012

- **Module:** Admin Module
- **Feature:** Taxonomy prototype
- **Test Scenario:** Adding or deleting a tag does not change scholarship data.
- **Preconditions:** Admin signed in. Note an existing scholarship's tags.
- **Test Data:** Tag name `QA Prototype Tag`.
- **Steps:**
  1. Open `/dashboard/admin/taxonomy`.
  2. Read the notice.
  3. Add the tag.
  4. Refresh.
  5. Open a scholarship as a provider and look for that tag.
- **Expected Result:** A **Prototype only** notice says taxonomy is not stored and adding or deleting a tag does not change scholarship data. The add action reports that the tag was not saved. After refresh, provider scholarship tags are unchanged.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** High
- **Test Type:** Prototype
- **Regression Required?** Full regression
- **Notes:** Prototype-only.

### ADMIN-013

- **Module:** Admin Module
- **Feature:** Audit log prototype
- **Test Scenario:** The audit page does not present a live compliance log.
- **Preconditions:** Admin signed in.
- **Test Data:** None.
- **Steps:**
  1. Open `/dashboard/admin/audit-log`.
  2. Read the notice and the summary cards.
- **Expected Result:** A **Prototype only** notice says audit and compliance logs are not stored. A card says `Not evaluated in this prototype`. The page does not claim a new audit row was written for the admin's last approval.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** Medium
- **Test Type:** Prototype
- **Regression Required?** Full regression
- **Notes:** Prototype-only. Export downloads only rows that were actually loaded. If none were loaded, it must not pretend a compliance archive was saved.

### ADMIN-014

- **Module:** Admin Module
- **Feature:** Settings prototype
- **Test Scenario:** Settings controls do not save.
- **Preconditions:** Admin signed in.
- **Test Data:** Any toggle or text change.
- **Steps:**
  1. Open `/dashboard/admin/settings`.
  2. Read the header and notice.
  3. Submit a settings form.
  4. Refresh.
- **Expected Result:** The header says prototype settings are not saved. The notice says system settings, invitations, cache tools, and backups are not connected to the database. Submit shows `This control is prototype-only. Nothing was saved to the database.` Refresh shows no saved change. Password save on this screen says password changes are not available.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** High
- **Test Type:** Prototype
- **Regression Required?** Full regression
- **Notes:** Prototype-only.

### ADMIN-015

- **Module:** Admin Module
- **Feature:** Admin notifications prototype
- **Test Scenario:** Broadcast and mark-read do not save or send.
- **Preconditions:** Admin signed in.
- **Test Data:** Any broadcast text.
- **Steps:**
  1. Open `/dashboard/admin/notifications`.
  2. Read the notice.
  3. Submit a broadcast.
  4. Use Mark All Logged Events as Read.
- **Expected Result:** A **Prototype only** notice says notifications and broadcasts are not connected to the database. Broadcast shows `Broadcasts are prototype-only and were not sent.` Mark read shows `Marking notifications as read is prototype-only and was not saved.` No student receives that broadcast.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** High
- **Test Type:** Prototype
- **Regression Required?** Full regression
- **Notes:** Prototype-only. Student deadline alerts are a different page and are covered by NOTIF cases.

### ADMIN-016

- **Module:** Admin Module
- **Feature:** Admin help prototype
- **Test Scenario:** Help text does not claim live support or database changes.
- **Preconditions:** Admin signed in.
- **Test Data:** None.
- **Steps:**
  1. Open `/dashboard/admin/help`.
- **Expected Result:** A **Prototype only** notice says the notes are not live procedures and the page does not change the database. Visible status text includes `Not measured in this prototype` or `No live support hotline is connected in this prototype`.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** Low
- **Test Type:** Prototype
- **Regression Required?** Full regression
- **Notes:** Prototype-only.

### ADMIN-017

- **Module:** Admin Module
- **Feature:** Signed-out admin page
- **Test Scenario:** Admin URLs require a session.
- **Preconditions:** Logged out.
- **Test Data:** None.
- **Steps:**
  1. Open `/dashboard/admin/verification`.
- **Expected Result:** Redirect to `/auth?mode=signin`.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** High
- **Test Type:** Negative
- **Regression Required?** Full regression
- **Notes:**

### ADMIN-018

- **Module:** Admin Module
- **Feature:** Scholarship status endpoint is not the moderation UI
- **Test Scenario:** Content Moderation must not be used as proof that a scholarship was published or rejected.
- **Preconditions:** Admin signed in. One Open scholarship.
- **Test Data:** That scholarship.
- **Steps:**
  1. Use only the Content Moderation screen to try to remove the scholarship.
  2. Open the scholarship as a student through its id if you already know it.
- **Expected Result:** The moderation screen does not persist the action. The scholarship record remains Open unless a different, explicit API test changed it. Do not expect status `Published` from the UI.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** Medium
- **Test Type:** Prototype
- **Regression Required?** Full regression
- **Notes:** `PATCH /api/v1/admin/scholarships/:id/status` exists but writes `Published` or `Rejected`, which are not the Open/Closed values used by matching. The shipped moderation screen does not use that as a working content workflow. Do not add a pass condition that depends on it.

---

# 13. DOCUMENT SECURITY

Use a file uploaded in PROV-004. Its URL looks like `/api/v1/documents/<filename>`.

### DOC-001

- **Module:** Document Security
- **Feature:** No token
- **Test Scenario:** The file cannot be downloaded without a token.
- **Preconditions:** Filename known. Browser signed out. No Authorization header.
- **Test Data:** That filename.
- **Steps:**
  1. Open `http://localhost:5000/api/v1/documents/<filename>` directly.
- **Expected Result:** `401` and `Not authorized to access this route`. The PDF or image bytes are not returned.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** Critical
- **Test Type:** Negative / Security
- **Regression Required?** Critical smoke
- **Notes:**

### DOC-002

- **Module:** Document Security
- **Feature:** Student access
- **Test Scenario:** A student cannot read a provider verification file.
- **Preconditions:** Student token. File uploaded by a provider.
- **Test Data:** That filename.
- **Steps:**
  1. `GET /api/v1/documents/<filename>` with the student token.
- **Expected Result:** `403` and `Access denied. You do not have permission to view this document.`
- **Actual Result:**
- **Status:** Not Run
- **Priority:** Critical
- **Test Type:** Negative / Security
- **Regression Required?** Critical smoke
- **Notes:**

### DOC-003

- **Module:** Document Security
- **Feature:** Unrelated provider
- **Test Scenario:** Another provider cannot read the file.
- **Preconditions:** Provider B token. File belongs to Provider A.
- **Test Data:** That filename.
- **Steps:**
  1. Request the file as Provider B.
- **Expected Result:** `403` and the access-denied message.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** Critical
- **Test Type:** Negative / Security
- **Regression Required?** Critical smoke
- **Notes:**

### DOC-004

- **Module:** Document Security
- **Feature:** Document owner
- **Test Scenario:** The uploading provider can view the file.
- **Preconditions:** Signed in as the provider who uploaded it.
- **Test Data:** That filename.
- **Steps:**
  1. Open Organization Verification.
  2. Open the document.
- **Expected Result:** The viewer requests `/api/v1/documents/<filename>` with the Bearer token and displays the PDF or image. The API returns `200` with a content type of `application/pdf` or the image type.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** Critical
- **Test Type:** Positive
- **Regression Required?** Critical smoke
- **Notes:**

### DOC-005

- **Module:** Document Security
- **Feature:** Admin access
- **Test Scenario:** An admin can view the same file.
- **Preconditions:** Admin token. Same filename.
- **Test Data:** That filename.
- **Steps:**
  1. From the verification queue, open the document.
- **Expected Result:** The file is shown. The API returns `200` for the admin role.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** Critical
- **Test Type:** Positive
- **Regression Required?** Critical smoke
- **Notes:** Allowed admin role strings include `admin`, `superadmin`, `super_admin`, and `super-admin`.

### DOC-006

- **Module:** Document Security
- **Feature:** Invalid document
- **Test Scenario:** An unknown filename returns not found.
- **Preconditions:** Admin token, so authorization is not the reason for failure.
- **Test Data:** Filename `doc-does-not-exist.pdf`.
- **Steps:**
  1. `GET /api/v1/documents/doc-does-not-exist.pdf` as admin.
- **Expected Result:** `404` and `Document not found in database.`
- **Actual Result:**
- **Status:** Not Run
- **Priority:** Medium
- **Test Type:** Negative
- **Regression Required?** Full regression
- **Notes:**

### DOC-007

- **Module:** Document Security
- **Feature:** Public uploads path
- **Test Scenario:** `/uploads` is not a public file server.
- **Preconditions:** A real filename from GridFS.
- **Test Data:** `http://localhost:5000/uploads/<filename>` and `http://localhost:5173/uploads/<filename>`.
- **Steps:**
  1. Open both URLs with no token.
- **Expected Result:** Neither URL returns the file. The API has no static `/uploads` route. The response is a 404 or the Express cannot-GET response, not the document bytes.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** Critical
- **Test Type:** Negative / Security
- **Regression Required?** Critical smoke
- **Notes:** Stored `fileUrl` values for new uploads use `/api/v1/documents/<filename>`.

### DOC-008

- **Module:** Document Security
- **Feature:** Protected document route
- **Test Scenario:** The viewer does not embed the raw file URL without authorization.
- **Preconditions:** Owner or admin opening the viewer.
- **Test Data:** A verification document.
- **Steps:**
  1. Open the document from verification.
  2. In the Network panel, confirm the document request.
- **Expected Result:** The request URL contains `/api/v1/documents/` and sends `Authorization: Bearer` or the session cookie. A request with neither is `401`.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** High
- **Test Type:** Security
- **Regression Required?** Full regression
- **Notes:**

---

# 14. NAVIGATION & ROUTING

### NAV-001

- **Module:** Navigation & Routing
- **Feature:** Public homepage
- **Test Scenario:** The landing page opens without a session.
- **Preconditions:** Logged out.
- **Test Data:** None.
- **Steps:**
  1. Open `http://localhost:5173/`.
- **Expected Result:** The homepage renders, including the hero, eligibility section, and featured scholarships section. It does not redirect to sign-in.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** High
- **Test Type:** Navigation
- **Regression Required?** Full regression
- **Notes:**

### NAV-002

- **Module:** Navigation & Routing
- **Feature:** Login and registration
- **Test Scenario:** Auth URLs open the same auth screen.
- **Preconditions:** Logged out.
- **Test Data:** None.
- **Steps:**
  1. Open `/auth?mode=signin`.
  2. Open `/login`.
  3. Open `/auth?mode=signup`.
  4. Open `/auth?mode=signup&role=provider`.
- **Expected Result:** `/auth` and `/login` show the auth page. `mode=signin` shows sign-in. `mode=signup` shows registration. `role=provider` selects Sponsor / Provider. `role=student` selects Student.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** High
- **Test Type:** Navigation
- **Regression Required?** Full regression
- **Notes:**

### NAV-003

- **Module:** Navigation & Routing
- **Feature:** Student dashboard
- **Test Scenario:** An onboarded student can open the student home.
- **Preconditions:** Onboarded active student.
- **Test Data:** That account.
- **Steps:**
  1. Open `/dashboard/student`.
- **Expected Result:** The student dashboard stays open. The sidebar includes Dashboard, Matched Feed, Student Profile, Scholarship Search, Saved Scholarships, Deadline Alerts, and Help Center.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** High
- **Test Type:** Navigation
- **Regression Required?** Full regression
- **Notes:**

### NAV-004

- **Module:** Navigation & Routing
- **Feature:** Provider dashboard
- **Test Scenario:** A verified provider can open the provider home.
- **Preconditions:** Verified provider.
- **Test Data:** That account.
- **Steps:**
  1. Open `/dashboard/provider`.
- **Expected Result:** The provider dashboard stays open. The sidebar includes Dashboard, Scholarship Listings, Create Listing, Performance & Analytics, Organization Verification, and Help & Support.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** High
- **Test Type:** Navigation
- **Regression Required?** Full regression
- **Notes:**

### NAV-005

- **Module:** Navigation & Routing
- **Feature:** Admin dashboard
- **Test Scenario:** Admin can open the operations home from the sidebar.
- **Preconditions:** Admin signed in.
- **Test Data:** That account.
- **Steps:**
  1. Open `/dashboard/admin`.
  2. Use the sidebar link for Verification Queue.
- **Expected Result:** Dashboard stays on `/dashboard/admin`. Verification Queue opens `/dashboard/admin/verification`.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** High
- **Test Type:** Navigation
- **Regression Required?** Full regression
- **Notes:**

### NAV-006

- **Module:** Navigation & Routing
- **Feature:** Student onboarding
- **Test Scenario:** A new student is routed to onboarding.
- **Preconditions:** Student with `isOnboarded` false.
- **Test Data:** That account.
- **Steps:**
  1. Sign in, or open `/dashboard/student`.
- **Expected Result:** The final URL is `/onboarding`.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** High
- **Test Type:** Navigation
- **Regression Required?** Full regression
- **Notes:**

### NAV-007

- **Module:** Navigation & Routing
- **Feature:** Provider onboarding and pending approval
- **Test Scenario:** Provider destination follows verification state.
- **Preconditions:** One provider not onboarded, one Pending Review, one Verified.
- **Test Data:** Those accounts.
- **Steps:**
  1. Sign in as each and record the final URL.
- **Expected Result:** Not onboarded ends on `/provider/onboarding`. Pending Review ends on `/provider/pending-approval`. Verified ends on `/dashboard/provider`.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** Critical
- **Test Type:** Navigation
- **Regression Required?** Critical smoke
- **Notes:**

### NAV-008

- **Module:** Navigation & Routing
- **Feature:** Verification queue route
- **Test Scenario:** Only admin reaches the queue URL.
- **Preconditions:** Admin, student, and provider sessions.
- **Test Data:** Those accounts.
- **Steps:**
  1. Open `/dashboard/admin/verification` as each role.
- **Expected Result:** Admin sees the queue. Student ends on `/dashboard/student`. Provider ends on the provider destination for their verification state.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** High
- **Test Type:** Navigation / Security
- **Regression Required?** Full regression
- **Notes:**

### NAV-009

- **Module:** Navigation & Routing
- **Feature:** Scholarship details
- **Test Scenario:** Student and owning provider have detail routes.
- **Preconditions:** Known scholarship id.
- **Test Data:** That id.
- **Steps:**
  1. As student, open `/dashboard/student/scholarships/<id>`.
  2. As the owning provider, open `/dashboard/provider/scholarships/<id>`.
- **Expected Result:** Both pages render the scholarship. A pending provider is redirected to pending approval before the provider detail page, except they may still open verification.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** High
- **Test Type:** Navigation
- **Regression Required?** Full regression
- **Notes:**

### NAV-010

- **Module:** Navigation & Routing
- **Feature:** Search, Match Feed, Profile, Saved, Notifications, Help
- **Test Scenario:** Student sidebar links open the matching pages.
- **Preconditions:** Onboarded student.
- **Test Data:** None.
- **Steps:**
  1. Open each sidebar item: Matched Feed, Student Profile, Scholarship Search, Saved Scholarships, Deadline Alerts, Help Center.
- **Expected Result:** URLs are `/dashboard/student/matches`, `/dashboard/student/profile`, `/dashboard/student/search`, `/dashboard/student/saved`, `/dashboard/student/notifications`, and `/dashboard/student/help`. Each page renders its own heading or empty state.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** High
- **Test Type:** Navigation
- **Regression Required?** Full regression
- **Notes:** Student Help Center is a static FAQ. It is not an admin prototype screen.

### NAV-011

- **Module:** Navigation & Routing
- **Feature:** Provider help
- **Test Scenario:** Provider help opens.
- **Preconditions:** Verified provider.
- **Test Data:** None.
- **Steps:**
  1. Open `/dashboard/provider/help`.
- **Expected Result:** The help page renders. It is static guidance, not a database write.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** Low
- **Test Type:** Navigation
- **Regression Required?** Module-only
- **Notes:**

### NAV-012

- **Module:** Navigation & Routing
- **Feature:** Invalid route
- **Test Scenario:** An unknown path goes to sign-in.
- **Preconditions:** Try once signed out and once signed in.
- **Test Data:** `/this-route-does-not-exist`.
- **Steps:**
  1. Open that path signed out.
  2. Open it signed in.
- **Expected Result:** Both end on `/auth?mode=signin`. There is no custom 404 page.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** Medium
- **Test Type:** Navigation
- **Regression Required?** Full regression
- **Notes:**

### NAV-013

- **Module:** Navigation & Routing
- **Feature:** Old and deprecated routes
- **Test Scenario:** Retired student and provider paths redirect.
- **Preconditions:** Onboarded student and verified provider.
- **Test Data:** None.
- **Steps:**
  1. As student, open `/dashboard/student/alerts`.
  2. As student, open `/dashboard/student/settings`.
  3. As provider, open `/dashboard/provider/settings`.
- **Expected Result:** Student alerts and student settings redirect to `/dashboard/student/profile`. Provider settings redirect to `/dashboard/provider`.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** Medium
- **Test Type:** Navigation
- **Regression Required?** Full regression
- **Notes:** `ApplicationTracker.jsx` is not mounted on any route. Do not test an applications page.

### NAV-014

- **Module:** Navigation & Routing
- **Feature:** Logout redirect
- **Test Scenario:** Logout from each role ends on sign-in.
- **Preconditions:** One session per role.
- **Test Data:** Student, provider, admin.
- **Steps:**
  1. Log out from each sidebar.
- **Expected Result:** Each logout ends on `/auth?mode=signin` and the token is gone.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** High
- **Test Type:** Navigation
- **Regression Required?** Full regression
- **Notes:**

### NAV-015

- **Module:** Navigation & Routing
- **Feature:** Role-based redirects
- **Test Scenario:** `/dashboard` sends the user to their own home.
- **Preconditions:** Onboarded student, verified provider, admin.
- **Test Data:** Those accounts.
- **Steps:**
  1. Open `/dashboard` as each.
- **Expected Result:** Student to `/dashboard/student`. Verified provider to `/dashboard/provider`. Admin to `/dashboard/admin`. A not-onboarded or pending user follows NAV-007 instead of staying on `/dashboard`.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** High
- **Test Type:** Navigation
- **Regression Required?** Full regression
- **Notes:**

### NAV-016

- **Module:** Navigation & Routing
- **Feature:** Consent route
- **Test Scenario:** The public consent URL is reachable signed out.
- **Preconditions:** A real consent token, or the URL with a bad token.
- **Test Data:** `/consent/verify?token=abc`.
- **Steps:**
  1. Open that URL signed out.
- **Expected Result:** The consent page loads and shows an invalid-token state. It does not redirect to the student dashboard.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** Medium
- **Test Type:** Navigation
- **Regression Required?** Module-only
- **Notes:**

### NAV-017

- **Module:** Navigation & Routing
- **Feature:** Homepage samples are not live matches
- **Test Scenario:** Featured scholarships and the eligibility checker are not the matching engine.
- **Preconditions:** Logged out on the homepage. Optionally watch the Network panel.
- **Test Data:** GWA `1.25`, any income tier, any region in the checker.
- **Steps:**
  1. Read the featured scholarship titles.
  2. Read the eligibility heading.
  3. Submit the checker.
  4. Confirm no `GET /api/v1/matching` call is made.
- **Expected Result:** Featured titles are the fixed CHED, DOST-SEI, and SM Foundation cards. The checker is labeled **Instant Matching Simulator**. The result is a local estimated count. No account is created and no database scholarship list is returned.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** High
- **Test Type:** Prototype / Navigation
- **Regression Required?** Full regression
- **Notes:** These cards are marketing samples. Do not use them as proof that matching works.

### NAV-018

- **Module:** Navigation & Routing
- **Feature:** Pending provider exception
- **Test Scenario:** A pending provider may open verification and not the rest of the dashboard.
- **Preconditions:** Pending Review provider.
- **Test Data:** That account.
- **Steps:**
  1. Open `/dashboard/provider/verification`.
  2. Open `/dashboard/provider/listings`.
- **Expected Result:** Verification remains open. Listings redirects to `/provider/pending-approval`.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** High
- **Test Type:** Navigation
- **Regression Required?** Full regression
- **Notes:**

---

# 15. SECURITY / ACCESS CONTROL

These cases are API-focused. UI redirects for the same rules are in Authentication and Navigation.

### SEC-001

- **Module:** Security / Access Control
- **Feature:** Missing token on protected APIs
- **Test Scenario:** Protected route groups reject anonymous calls.
- **Preconditions:** No cookie and no Authorization header.
- **Test Data:** None.
- **Steps:**
  1. Call `GET /api/v1/auth/me`.
  2. Call `GET /api/v1/students/profile`.
  3. Call `GET /api/v1/scholarships/my`.
  4. Call `GET /api/v1/matching`.
  5. Call `GET /api/v1/admin/dashboard`.
  6. Call `GET /api/v1/provider/profile`.
- **Expected Result:** Each returns `401`.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** Critical
- **Test Type:** Security
- **Regression Required?** Critical smoke
- **Notes:**

### SEC-002

- **Module:** Security / Access Control
- **Feature:** Student token on provider and admin APIs
- **Test Scenario:** A student cannot perform provider or admin writes.
- **Preconditions:** Student token.
- **Test Data:** Valid scholarship JSON. A pending provider id.
- **Steps:**
  1. `POST /api/v1/scholarships`.
  2. `PATCH /api/v1/admin/verifications/<id>/status` with `{ "status": "APPROVED" }`.
  3. `POST /api/v1/provider/onboarding`.
- **Expected Result:** Scholarship and onboarding return `403`. Admin verify returns `403`. No scholarship is created and no provider status changes.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** Critical
- **Test Type:** Security
- **Regression Required?** Critical smoke
- **Notes:**

### SEC-003

- **Module:** Security / Access Control
- **Feature:** Provider token on student APIs
- **Test Scenario:** A verified provider cannot read or write the student profile, matches, or saves.
- **Preconditions:** Verified provider token.
- **Test Data:** None.
- **Steps:**
  1. `GET /api/v1/students/profile`.
  2. `GET /api/v1/matching`.
  3. `GET /api/v1/students/saved-scholarships`.
  4. `GET /api/v1/students/notifications`.
- **Expected Result:** Each returns `403`.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** High
- **Test Type:** Security
- **Regression Required?** Full regression
- **Notes:**

### SEC-004

- **Module:** Security / Access Control
- **Feature:** Pending consent token
- **Test Scenario:** A student in `pending_consent` cannot call student routes.
- **Preconditions:** Minor student after onboarding, token still stored.
- **Test Data:** That token.
- **Steps:**
  1. `GET /api/v1/matching`.
  2. `GET /api/v1/students/profile`.
  3. `GET /api/v1/students/saved-scholarships`.
- **Expected Result:** Each returns `403` with `requiresConsent: true`.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** Critical
- **Test Type:** Security
- **Regression Required?** Critical smoke
- **Notes:**

### SEC-005

- **Module:** Security / Access Control
- **Feature:** Rejected provider token
- **Test Scenario:** Rejection blocks every protected route except logout.
- **Preconditions:** Provider token captured before rejection, then admin rejects the provider.
- **Test Data:** That token and the rejection reason.
- **Steps:**
  1. `GET /api/v1/provider/profile`.
  2. `GET /api/v1/scholarships/my`.
  3. `GET /api/v1/auth/me`.
  4. `GET /api/v1/auth/logout`.
- **Expected Result:** The first three return `403` and the rejection reason. Logout returns `200`.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** Critical
- **Test Type:** Security
- **Regression Required?** Critical smoke
- **Notes:**

### SEC-006

- **Module:** Security / Access Control
- **Feature:** Provider cannot set verification fields
- **Test Scenario:** A profile update cannot self-verify.
- **Preconditions:** Pending provider token.
- **Test Data:** `{ "institutionName": "QA Renamed", "verificationStatus": "Verified" }`.
- **Steps:**
  1. `PUT /api/v1/provider/profile` with that body.
  2. `PUT` again with only `{ "institutionName": "QA Renamed" }`.
- **Expected Result:** The first call returns `403` and does not rename or verify. The second call returns `200` and updates the name only. Status stays Pending Review.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** High
- **Test Type:** Security
- **Regression Required?** Full regression
- **Notes:**

### SEC-007

- **Module:** Security / Access Control
- **Feature:** Scholarship ownership
- **Test Scenario:** A provider cannot edit, close, or archive another provider's scholarship.
- **Preconditions:** Two verified providers.
- **Test Data:** Provider B's scholarship id and Provider A's token.
- **Steps:**
  1. `PUT /api/v1/scholarships/<B id>` as A.
  2. `PATCH /api/v1/scholarships/<B id>/status` with `{ "status": "Closed" }` as A.
  3. `PATCH /api/v1/scholarships/<B id>/archive` as A.
- **Expected Result:** Each returns `404` and `Scholarship not found`. B's scholarship stays Open and unarchived.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** Critical
- **Test Type:** Security
- **Regression Required?** Critical smoke
- **Notes:**

### SEC-008

- **Module:** Security / Access Control
- **Feature:** Document and uploads
- **Test Scenario:** Anonymous, student, and public `/uploads` access do not return the file.
- **Preconditions:** Known verification filename.
- **Test Data:** That filename.
- **Steps:**
  1. Repeat DOC-001, DOC-002, and DOC-007.
- **Expected Result:** `401`, `403`, and no file bytes from `/uploads`.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** Critical
- **Test Type:** Security
- **Regression Required?** Critical smoke
- **Notes:** Can be marked Pass by reference when DOC-001, DOC-002, and DOC-007 passed in the same run.

### SEC-009

- **Module:** Security / Access Control
- **Feature:** Admin registration and consent resend
- **Test Scenario:** Admin signup and cross-account consent resend stay blocked.
- **Preconditions:** Pending-consent student id. Another user's token.
- **Test Data:** AUTH-003 payload and CONSENT-010 payload.
- **Steps:**
  1. Repeat the admin register call.
  2. Repeat the cross-account resend call.
- **Expected Result:** Register returns `403`. Resend returns `403` or `401` as in CONSENT-010. No admin user and no email to a different guardian are created by these calls.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** High
- **Test Type:** Security
- **Regression Required?** Full regression
- **Notes:**

### SEC-010

- **Module:** Security / Access Control
- **Feature:** Rate limit
- **Test Scenario:** The API limit responds after too many calls.
- **Preconditions:** A tester is allowed to generate traffic against the local API. Do not run this against a shared staging server during a demo.
- **Test Data:** More than 100 requests to `/api/v1/health` within 10 minutes from one IP.
- **Steps:**
  1. Send 101 `GET /api/v1/health` requests quickly.
- **Expected Result:** A later request returns `429` or the limiter JSON `Too many requests from this IP, please try again later.` Earlier requests still return `200`.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** Low
- **Test Type:** Security
- **Regression Required?** Module-only
- **Notes:** Skip on shared staging if it would lock the team out for 10 minutes. The limit is 100 requests per 10 minutes for `/api/v1`.

### SEC-011

- **Module:** Security / Access Control
- **Feature:** Health check stays public
- **Test Scenario:** Health does not require a token.
- **Preconditions:** Signed out.
- **Test Data:** None.
- **Steps:**
  1. `GET /api/v1/health` with no token.
- **Expected Result:** `200` and `IskolarMatch API Online`.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** Low
- **Test Type:** Positive
- **Regression Required?** Module-only
- **Notes:**

### SEC-012

- **Module:** Security / Access Control
- **Feature:** Update cannot reassign a scholarship
- **Test Scenario:** A provider cannot move a listing to another provider id.
- **Preconditions:** Verified provider owns a scholarship.
- **Test Data:** Body `{ "name": "QA Rename Only", "providerId": "<another provider id>" }`.
- **Steps:**
  1. `PUT /api/v1/scholarships/<own id>` with that body.
  2. Read the scholarship as the owner.
- **Expected Result:** The name can change. `providerId` stays the owner. The other provider's list does not contain it.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** High
- **Test Type:** Security
- **Regression Required?** Full regression
- **Notes:** `providerId` is not in the allowed update fields.

---

# 16. CROSS-MODULE / END-TO-END WORKFLOWS

### E2E-001

- **Module:** Cross-module / End-to-end
- **Feature:** Student discovery path
- **Test Scenario:** Student registration, onboarding, complete profile, matching, scholarship details, and save.
- **Preconditions:** Unused student email. One verified provider already has the shared Open scholarship that matches the shared complete profile.
- **Test Data:** Student `qa.e2e001.<stamp>@example.com` / `Secret1`. Shared complete profile. Scholarship `QA College Grant`.
- **Steps:**
  1. Register as Student.
  2. Confirm the app opens `/onboarding`.
  3. Submit adult onboarding with the shared academic, GWA, region, and income values.
  4. Open Student Profile and save province `Albay` and a municipality under Albay. Confirm citizenship `Filipino` and GWA scale `1.00-5.00`.
  5. Open Match Feed and confirm `QA College Grant` is listed with a score.
  6. Open that scholarship's details.
  7. Save it.
  8. Refresh Saved Scholarships.
- **Expected Result:** The account is a student. Onboarding sets `isOnboarded` true. Match Feed does not show the incomplete-profile message after step 4. The scholarship details page opens. Saved Scholarships still shows it after refresh. No step shows sample homepage cards in place of API data.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** Critical
- **Test Type:** End-to-end
- **Regression Required?** Critical smoke
- **Notes:**

### E2E-002

- **Module:** Cross-module / End-to-end
- **Feature:** Provider approval path
- **Test Scenario:** Provider registration, onboarding, document upload, pending approval, admin approval, and scholarship create.
- **Preconditions:** Unused provider email. Seeded admin. A small PDF.
- **Test Data:** Organization `QA E2E Foundation <stamp>`, provider password `Secret1`, document PDF, scholarship name `QA E2E Grant <stamp>`.
- **Steps:**
  1. Register as Sponsor / Provider.
  2. Complete onboarding with organization, representative, and the PDF.
  3. Confirm `/provider/pending-approval`.
  4. Try to open Create Listing and confirm the redirect.
  5. Sign in as admin and approve the provider in the verification queue.
  6. Refresh the queue and confirm Verified.
  7. Sign in as the provider.
  8. Create the scholarship with the shared required fields.
- **Expected Result:** Onboarding sets Pending Review. Create is blocked before approval. Admin approval persists as Verified. After approval the provider dashboard opens and the scholarship is created with `201`. The provider list shows it as Open.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** Critical
- **Test Type:** End-to-end
- **Regression Required?** Critical smoke
- **Notes:**

### E2E-003

- **Module:** Cross-module / End-to-end
- **Feature:** Provider rejection path
- **Test Scenario:** Onboarding, admin rejection with a reason, and no scholarship create.
- **Preconditions:** Unused provider email. Seeded admin. A small PDF.
- **Test Data:** Organization `QA Rejected Foundation <stamp>`. Reason `Registration document is unreadable.`
- **Steps:**
  1. Register and finish provider onboarding.
  2. Confirm pending approval.
  3. As admin, try to reject with an empty reason and stop.
  4. Reject with the reason.
  5. Refresh and confirm the reason is still visible.
  6. Sign in as the provider.
  7. If a token was kept from before rejection, call create scholarship with it.
- **Expected Result:** Empty rejection does not change status. The stored status is Rejected and the reason persists. Login is refused with that reason. Scholarship create returns `403`. No scholarship is created.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** Critical
- **Test Type:** End-to-end
- **Regression Required?** Critical smoke
- **Notes:**

### E2E-004

- **Module:** Cross-module / End-to-end
- **Feature:** Minor consent path
- **Test Scenario:** Minor registration, onboarding, guardian approval, student access, and matching.
- **Preconditions:** Unused student email. A guardian email that is not the student's email. Server log is available if email is not delivered. A matching Open scholarship exists for the profile you will complete after approval.
- **Test Data:** Date of birth `2012-01-15`. Guardian `QA Guardian` / `qa.e2e004.guardian.<stamp>@example.com`. After approval, complete the shared College profile only if the minor's academic level in onboarding was College. Otherwise build a consistent Senior High profile and a Senior High scholarship.
- **Steps:**
  1. Register as Student.
  2. Enter the minor date of birth and confirm guardian fields appear.
  3. Try the student's own email as guardian and confirm it is rejected.
  4. Submit with the guardian email.
  5. Confirm the waiting screen and that dashboard and login are blocked.
  6. Open the consent link from the server log and approve.
  7. Sign in as the student.
  8. Complete any missing profile fields.
  9. Open Match Feed.
- **Expected Result:** Pending status blocks dashboard, matching, and login. Approval sets status active. The new login reaches the student area. Match Feed returns real matches or a true empty list, not sample cards. Consent status is still active after refresh.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** Critical
- **Test Type:** End-to-end
- **Regression Required?** Critical smoke
- **Notes:** Use a College academic level during minor onboarding if the prepared scholarship is College. Academic level is a hard filter.

### E2E-005

- **Module:** Cross-module / End-to-end
- **Feature:** Deadline expiry
- **Test Scenario:** A created scholarship leaves matching and search after the deadline, then becomes Closed.
- **Preconditions:** Verified provider and a complete student who matches the scholarship.
- **Test Data:** Scholarship deadline set to yesterday's date. All other shared filters pass.
- **Steps:**
  1. Create the scholarship while the deadline is still today, and confirm the student sees it in Match Feed.
  2. Edit the deadline to yesterday, or wait until the Manila day has ended.
  3. Reload Match Feed and Search before opening provider listings.
  4. Open provider listings.
  5. Reload Match Feed.
- **Expected Result:** While the deadline day is still open, the scholarship can appear. After the Manila end of that day, Match Feed and Search omit it even if status is still Open. Opening provider listings sets status to Closed. The scholarship stays absent from matching. It is not deleted.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** Critical
- **Test Type:** End-to-end
- **Regression Required?** Critical smoke
- **Notes:** If editing a past deadline is blocked by the form, create the scholarship through the API with yesterday's deadline and start at step 3. Do not expect a background job to close it before the provider list or dashboard is opened.

### E2E-006

- **Module:** Cross-module / End-to-end
- **Feature:** Approved provider scholarship reaches a matching student
- **Test Scenario:** Admin approval, scholarship create, and student Match Feed.
- **Preconditions:** Pending provider and a complete student whose profile will match the scholarship you create. Admin account.
- **Test Data:** Shared College student in Bicol with GWA `1.50` and income below ₱10,000. Scholarship `QA Match Bridge <stamp>` using the shared matching scholarship fields.
- **Steps:**
  1. As admin, approve the provider and refresh.
  2. As the provider, sign in and create the scholarship.
  3. As the student, open Match Feed.
  4. Open the scholarship details from the feed.
- **Expected Result:** The provider is Verified. The scholarship is Open and owned by that provider. Match Feed shows it with a numeric score. Details open at `/dashboard/student/scholarships/<id>`. A student with an incomplete profile does not see it, and that result is a profile-completion failure rather than a matching failure.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** Critical
- **Test Type:** End-to-end
- **Regression Required?** Critical smoke
- **Notes:**

### E2E-007

- **Module:** Cross-module / End-to-end
- **Feature:** Rejection restricts current and later access
- **Test Scenario:** Admin rejection stops an existing session and a new sign-in.
- **Preconditions:** Provider finished onboarding and is signed in on browser A. Admin is signed in on browser B.
- **Test Data:** Reason `Registration document is unreadable.`
- **Steps:**
  1. In browser A, confirm the provider can open Organization Verification.
  2. In browser B, reject the provider with the reason.
  3. In browser A, refresh and try to open listings or create.
  4. Sign out if still possible, then sign in again as the provider.
  5. `POST /api/v1/scholarships` with any token captured before the refresh.
- **Expected Result:** Refresh or the next protected call returns `403` with the reason, and the app drops the session. The new login is refused with the same reason. Create does not succeed. The rejection reason is still on the admin queue after refresh.
- **Actual Result:**
- **Status:** Not Run
- **Priority:** Critical
- **Test Type:** End-to-end
- **Regression Required?** Critical smoke
- **Notes:** Logout remains available so the old token can be cleared.

---

# After the run

1. Set every executed **Status** to Pass, Fail, or Blocked.
2. Write the observed sentence or status code in **Actual Result**.
3. Copy Fail items into the release notes before staging is called stable.
4. Use `docs/REGRESSION_CHECKLIST.md` for the smoke list, the full list, the module matrix, required accounts, and prototype limits.

Temporary accounts created with the `qa.` email prefix can be left in a local database or removed by the team after the run. Do not change their passwords into shared credentials. Do not edit source code from this suite.


