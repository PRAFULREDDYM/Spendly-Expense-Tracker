# DEVICE TEST CHECKLIST

App: Expense Tracker  
Bundle ID: `com.prafulreddy.expensetracker`  
Focus: Web + Capacitor native verification before store submission

## Section 1 — Basic Auth

### 1. Sign up with email and enter the app
Steps:
1. Open the app on a fresh device or browser profile.
2. Go to the sign-up screen.
3. Enter a new email, password, and name.
4. Submit the form.

Expected result:
- The account is created successfully.
- The app opens into the authenticated workspace.
- No repeated red error toasts appear.

Pass/Fail: [ ]

### 2. Sign out and sign back in
Steps:
1. Open the Profile page.
2. Tap `Sign out`.
3. Return to the sign-in screen.
4. Sign in with the same account.

Expected result:
- Sign-out returns the user to auth.
- Sign-in succeeds immediately.
- The same workspace data is restored after login.

Pass/Fail: [ ]

### 3. Cross-device account match
Steps:
1. Sign in on Device A.
2. Add one expense and one category on Device A.
3. Sign in with the same account on Device B.
4. Open Dashboard, History, and Profile on Device B.

Expected result:
- The same account data appears on both devices.
- The new expense and category are visible on Device B.

Pass/Fail: [ ]

## Section 2 — Adding Expenses

### 4. Quick Add creates an expense
Steps:
1. Open `/quick-add` or the in-app Quick Add flow.
2. Enter an amount.
3. Choose a category.
4. Save the expense.

Expected result:
- The save succeeds.
- A success toast appears.
- The expense is added to History and Dashboard totals.

Pass/Fail: [ ]

### 5. Full expense sheet saves with category and date
Steps:
1. Open the full expense composer from Dashboard.
2. Enter amount, description, category, and a custom date.
3. Save the expense.

Expected result:
- Category dropdown works.
- Date picker works.
- The saved expense shows the chosen category and date in History.

Pass/Fail: [ ]

### 6. Income entry works
Steps:
1. Open the expense sheet.
2. Switch from `Expense` to `Income`.
3. Enter amount, description, and save.

Expected result:
- The transaction is stored as income.
- Dashboard income totals update.
- History shows the entry with income styling.

Pass/Fail: [ ]

### 7. New expense appears in History immediately
Steps:
1. Add a new expense from either Quick Add or the full sheet.
2. Immediately navigate to History.
3. Look for the new transaction at the top of the list.

Expected result:
- The new expense appears without needing a manual refresh.

Pass/Fail: [ ]

## Section 3 — Offline Sync

### 8. Offline expense add shows optimistic UI
Steps:
1. Sign in and wait for data to load.
2. Turn on airplane mode or disable network.
3. Add a new expense.
4. Open History.

Expected result:
- The expense appears immediately in the UI.
- The write is not lost while offline.

Pass/Fail: [ ]

### 9. Pending sync badge appears offline
Steps:
1. Stay offline.
2. Add or edit an expense.
3. Look at the app shell for the pending sync indicator.

Expected result:
- A pending sync badge appears.
- It reflects that there are unsynced changes.

Pass/Fail: [ ]

### 10. Offline delete queues correctly
Steps:
1. While offline, delete an existing expense.
2. Stay in History and Dashboard.
3. Verify the item is removed locally.

Expected result:
- The deleted item disappears immediately.
- The pending sync badge stays visible until reconnect.

Pass/Fail: [ ]

### 11. Reconnect flushes queued writes
Steps:
1. Create, edit, or delete one or more expenses while offline.
2. Re-enable Wi-Fi or cellular data.
3. Wait a few seconds.
4. Refresh the app on a second device if available.

Expected result:
- Pending sync badge disappears.
- Changes sync to Supabase.
- The second device shows the same final data.

Pass/Fail: [ ]

## Section 4 — Shared Budgets

### 12. Create a shared group
Steps:
1. Open Profile.
2. Go to the `Shared budgets` section.
3. Enter a group name.
4. Tap `Create group`.

Expected result:
- The group is created successfully.
- The group appears in the shared budgets section.
- The app navigates to or opens the group view.

Pass/Fail: [ ]

### 13. Invite link can be created
Steps:
1. Open the created group.
2. Enter an invite email.
3. Tap the invite action.

Expected result:
- An invite is created.
- A share/copyable invite link is available.
- No save error appears while online.

Pass/Fail: [ ]

### 14. Invited user can accept the group invite
Steps:
1. Copy the invite link.
2. Open it on a second account.
3. If prompted, sign in.
4. Let the invite page complete.

Expected result:
- The invite is accepted.
- The invited account is added to the group.
- The app redirects into the shared group or Profile.

Pass/Fail: [ ]

### 15. Shared expense appears in group view
Steps:
1. On any group member account, create a new expense.
2. In the composer, choose `Share with group`.
3. Save the expense.
4. Open the group detail page.

Expected result:
- The expense appears in `Recent shared expenses`.
- The expense shows the spending member’s avatar/name.

Pass/Fail: [ ]

### 16. Shared expense is visible to another member
Steps:
1. Add a shared expense using Account A.
2. Sign in to Account B, which belongs to the same group.
3. Open the same group detail page.

Expected result:
- Account B sees the same shared expense.
- Shared budget totals update for both members.

Pass/Fail: [ ]

### 17. Group budget progress updates from shared spending
Steps:
1. Create a budget inside a shared group.
2. Add one or more shared expenses to that group.
3. Return to Profile and Group Detail.

Expected result:
- Budget progress bars update.
- `spent` values reflect the new shared expenses.

Pass/Fail: [ ]

### 18. Owner can remove a member
Steps:
1. Sign in as the group owner.
2. Open Group Detail.
3. Remove a non-owner member.
4. Have the removed member reopen the group.

Expected result:
- The member is removed successfully.
- The removed member no longer has access to the group.

Pass/Fail: [ ]

## Section 5 — Recurring + Reminders

### 19. Create a recurring expense
Steps:
1. Open the expense sheet.
2. Create an expense and mark it as recurring.
3. Choose a frequency such as monthly.
4. Save it.

Expected result:
- The recurring item appears in the Dashboard recurring section.
- It shows name, amount, frequency, and next due date.

Pass/Fail: [ ]

### 20. Due-soon reminder banner appears
Steps:
1. Create a recurring expense due within the next 3 days.
2. Return to Dashboard.

Expected result:
- A reminder banner appears at the top of Dashboard.
- The banner text matches the recurring item and due timing.

Pass/Fail: [ ]

### 21. Log it action advances the cycle
Steps:
1. Tap `Log it` from the reminder banner or recurring row.
2. Open History and Dashboard again.

Expected result:
- A matching expense is created.
- The reminder is marked logged.
- The recurring item moves to the next cycle with a new next due date.

Pass/Fail: [ ]

### 22. Local notification is scheduled on native
Steps:
1. On an Android or iPhone build, create a recurring expense due soon.
2. Grant notification permission if prompted.
3. Background the app and wait until the scheduled reminder time.

Expected result:
- A local notification appears for the bill reminder.
- The title/body match the recurring expense.

Pass/Fail: [ ]

### 23. Overdue recurring shows red warning state
Steps:
1. Create a recurring expense with a past due date.
2. Open Dashboard.

Expected result:
- The reminder/banner uses the overdue red state.
- The recurring row shows overdue messaging such as `X days overdue`.

Pass/Fail: [ ]

## Section 6 — Insights

### 24. Monthly forecast insight appears
Steps:
1. Add enough current-month expenses to approach or exceed budget pace.
2. Open Dashboard.

Expected result:
- An insight card appears forecasting monthly spend.
- It uses amber or red based on budget pressure.

Pass/Fail: [ ]

### 25. Spending spike insight appears
Steps:
1. Add a noticeably higher amount in one category this week than normal.
2. Open Dashboard insights row.

Expected result:
- A spending spike insight appears.
- It mentions the category and relative increase.

Pass/Fail: [ ]

### 26. Unusual expense insight appears
Steps:
1. Add several normal expenses for one category.
2. Add one much larger expense in that same category.
3. Reopen Dashboard.

Expected result:
- An unusual expense insight appears.
- It references the large outlier transaction.

Pass/Fail: [ ]

### 27. Detected recurring pattern insight appears
Steps:
1. Create 3 or more similar expenses with similar intervals and description.
2. Open Dashboard.

Expected result:
- A detected recurring pattern insight appears.
- It suggests creating a recurring expense.

Pass/Fail: [ ]

## Section 7 — Native Feel

### 28. Numpad tap haptics work on native
Steps:
1. Open Quick Add or the amount entry screen on a native build.
2. Tap several numpad buttons.

Expected result:
- Light haptic feedback is felt on button taps.
- No errors appear on web where haptics are unavailable.

Pass/Fail: [ ]

### 29. Save and delete actions feel distinct
Steps:
1. Save a new expense on native.
2. Delete an expense on native.

Expected result:
- Save uses medium haptic feedback.
- Delete uses heavier feedback.

Pass/Fail: [ ]

### 30. Splash screen feels native
Steps:
1. Close the native app completely.
2. Relaunch it from the home screen.

Expected result:
- The branded splash screen appears briefly.
- The app opens without a white flash.

Pass/Fail: [ ]

### 31. Keyboard does not cover save action
Steps:
1. Open Quick Add or Add Transaction on native.
2. Focus the description or other text input.
3. Observe the bottom action area while the keyboard is open.

Expected result:
- The save/continue action stays visible above the keyboard.
- The sheet does not become unusable.

Pass/Fail: [ ]

### 32. Portrait lock and mobile layout hold
Steps:
1. Open the native app on phone.
2. Rotate the device.

Expected result:
- The app stays portrait-oriented.
- Layout remains mobile-optimized.

Pass/Fail: [ ]

## Section 8 — Cross-Device Data

### 33. Category sync across devices
Steps:
1. Create or edit a category on Device A.
2. Open Profile or an expense form on Device B.

Expected result:
- The category change appears on Device B.
- Category color/icon/name match.

Pass/Fail: [ ]

### 34. Budget sync across devices
Steps:
1. Create or edit a personal budget on Device A.
2. Open Profile and Dashboard on Device B.

Expected result:
- The new or edited budget appears on Device B.
- Progress values remain consistent.

Pass/Fail: [ ]

### 35. Delete sync across devices
Steps:
1. Delete an expense on Device A.
2. Refresh or reopen History on Device B.

Expected result:
- The deleted expense is gone on Device B as well.

Pass/Fail: [ ]

## Section 9 — Performance

### 36. Cold start feels under 2 seconds
Steps:
1. Fully close the app.
2. Reopen it on the target device.
3. Measure roughly from tap to usable Dashboard.

Expected result:
- The app becomes usable in about 2 seconds or less on a normal modern device.

Pass/Fail: [ ]

### 37. Main scrolling feels smooth
Steps:
1. Scroll Dashboard, History, and Profile.
2. Open and close sheets while scrolling through content.

Expected result:
- Scrolling is smooth.
- No jank, frozen frames, or large layout jumps are visible.

Pass/Fail: [ ]

### 38. No blank screens during navigation
Steps:
1. Navigate repeatedly between Dashboard, History, Analysis, Profile, Group Detail, and Quick Add.
2. Test both online and offline.

Expected result:
- No blank white or black screens appear.
- Loading states are intentional and brief.

Pass/Fail: [ ]

## Section 10 — Store Readiness

### 39. Android install path is ready
Steps:
1. Open the Android project in Android Studio.
2. Confirm the app builds successfully.
3. Use the generated release flow to prepare a signed build.

Expected result:
- The Android project is buildable and ready for signed release packaging.
- No missing plugin or sync errors block the release path.

Pass/Fail: [ ]

### 40. Android: no browser address bar
Steps:
1. Build the signed APK or AAB and install it on an Android phone.
2. Open the app from the home screen icon.

Expected result:
- The app opens with no browser address bar at the top.
- Only the app's own UI is visible.
- If a browser bar shows, `assetlinks.json` or signing config needs review.

Pass/Fail: [ ]

### 41. iOS: no browser chrome after Add to Home Screen
Steps:
1. Open Safari on iPhone and navigate to the deployed app URL.
2. Tap the Share button and choose `Add to Home Screen`.
3. Close Safari completely.
4. Tap the new app icon on the home screen.

Expected result:
- The app opens without Safari address bar, tab bar, or navigation buttons.
- Only the app UI is visible.

Pass/Fail: [ ]

### 42. Desktop blocker on laptop
Steps:
1. Open the deployed app URL in Chrome or Safari on a laptop or desktop computer.
2. Keep the window at full desktop width.

Expected result:
- A dark screen appears saying the app is designed for mobile.
- Links to the Play Store and App Store are visible.
- The mobile app UI itself is not rendered.

Pass/Fail: [ ]

---

## SIGN-OFF

Tester name: ______________________________

Devices tested:
- Device 1: ______________________________
- Device 2: ______________________________
- Device 3: ______________________________

Test date: ______________________________

Total tests: 42

All 42 tests passed: YES / NO

Notes:

____________________________________________________________

____________________________________________________________

____________________________________________________________
