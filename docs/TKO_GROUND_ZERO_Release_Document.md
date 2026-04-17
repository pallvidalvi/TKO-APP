# TKO - GROUND ZERO

## Release Document and User Guide

Document version: 1.0  
Application version: 1.0.1  
Package name: com.vehiclecategories.app  
Platform: Android tablet and phone, built with Expo React Native  
Primary target device: Lenovo Tab K10 Gen 2

## 1. Purpose

This document describes the current release of the TKO - GROUND ZERO application, including the main user flows, feature set, operating model, and step-by-step guidance for using the app during an event.

The app is designed to support rally or off-road event operations where teams are grouped into vehicle categories and must be timed, scored, reviewed, and ranked track by track across multiple days.

## 2. Application Summary

TKO - GROUND ZERO is a race-day operations app used to:

- select an event day
- browse active vehicle categories
- open a track-specific participant list
- run a stopwatch for a selected vehicle
- apply penalties and late-start rules
- save final results
- mark DNS and DNF outcomes
- hold records under dispute instead of submitting immediately
- resolve disputes later from Settings
- review saved records in Reports
- review aggregate points in Leaderboard
- manage category and track visibility by day
- protect sensitive actions using password and PIN verification
- switch between light and dark theme modes

## 3. Main Screens

### 3.1 Splash and Start Flow

When the app starts, it shows a branded splash or ignition-style intro and then takes the user to the day selection page.

### 3.2 Day Selection Page

The app supports three report days:

- Day 1
- Day 2
- Day 3

The user must choose a day before race operations begin. All records, disputes, reports, and leaderboard sessions are linked to the selected day where applicable.

### 3.3 Main Category Dashboard

After selecting a day, the user enters the main dashboard.

The dashboard includes:

- the event title
- the selected day label and date
- a back button to return to day selection
- a search bar for category filtering
- vehicle category cards
- a top-right menu for Reports, Leaderboard, Settings, and Theme

Each vehicle category card includes:

- category logo
- team count
- track count
- category description

### 3.4 Track and Record Selection

After opening a category, the app shows the available tracks and eligible vehicles for that category. The user can select a track and then open a specific vehicle record for stopwatch operations.

### 3.5 Registration Form and Stopwatch Screen

This is the main operational screen used during live event timing.

It contains:

- selected record details
- track name
- driver and co-driver information
- stopwatch controls
- penalty controls
- DNF controls
- Submit button
- Dispute button
- Close button

### 3.6 Settings

Settings includes three main operational areas:

- Configuration
- Disputes
- Security

### 3.7 Reports

Reports shows saved results and disputed holds by category and track for the selected day.

### 3.8 Leaderboard

Leaderboard shows points and track summaries grouped by category and vehicle across saved results.

## 4. Core Features

### 4.1 Day-Based Event Management

The app separates event activity by day. A user can operate Day 1, Day 2, or Day 3 independently.

### 4.2 Category Search and Navigation

Users can search categories from the main dashboard to quickly access the correct competition group.

### 4.3 Track-Based Vehicle Workflow

Each category has its own set of tracks. The app lets the operator work one track at a time for the selected category.

### 4.4 Stopwatch Timing

The stopwatch flow supports:

- start timing
- stop timing
- reset timing
- view formatted stopwatch output

The app prevents unsafe closure of the stopwatch form when timing is active or partially completed.

### 4.5 Penalty Handling

The app supports structured penalty entry for race records, including:

- busting or bunting penalties
- seatbelt penalties
- ground touch penalties
- attempt penalties
- task skipped penalties
- late start penalties

These values are included in the total timing calculation.

### 4.6 DNF Handling

The app supports DNF status for cases such as:

- wrong course
- fourth attempt
- time over

DNF point handling is built into the record flow.

### 4.7 DNS Handling

Vehicles can be marked as DNS from the track record list.

### 4.8 Dispute Hold Workflow

Instead of immediately saving a stopwatch record as a final result, the operator can hold it under dispute.

The dispute flow allows the user to:

- select one or more dispute reasons
- enter dispute details for each selected reason
- confirm the disputed hold using PIN verification

Disputed records are stored separately from final results and can be reviewed later from Settings.

### 4.9 Automatic Dispute Expiry

Each disputed record has a 20-minute timer.

If no action is taken within 20 minutes:

- the disputed hold is automatically converted into a normal submitted result
- the record is removed from the disputes list
- reports and leaderboard reflect the submitted record

The remaining time is shown:

- in Settings > Disputes for each disputed record independently
- in Reports for disputed entries
- in Leaderboard for disputed entries

### 4.10 Reports

Reports support:

- selected-day filtering
- category-level navigation
- track-level navigation
- mixed viewing of normal saved records and disputed holds
- dispute detail visibility
- timing and points visibility

### 4.11 Leaderboard

Leaderboard supports:

- category-based points view
- total vehicle points
- track-wise point summaries
- day-wise track entries
- disputed hold visibility with remaining timer

### 4.12 Admin Configuration

Configuration allows an administrator to control what is visible on each day.

This includes:

- category activation by day
- track activation by day and category

This makes it possible to tailor the operational view to the actual event plan.

### 4.13 Security

Security includes:

- a password required to access protected settings
- a 4-digit PIN required for sensitive record actions

PIN verification is used before:

- Submit
- DNS
- Confirm Dispute

### 4.14 Theme Support

The app supports:

- Dark mode
- Light mode

### 4.15 Local Data Storage

The app stores operational data locally using SQLite on native builds, which supports practical offline-style use during event operations.

Stored areas include:

- team data
- category data
- results
- disputes
- settings

## 5. Recommended User Roles

The current release best fits the following operating roles:

- Event operator
- Timekeeper
- Marshal or dispute reviewer
- Admin or event setup manager

## 6. End-to-End User Flows

### 6.1 Standard Race Result Flow

1. Open the app.
2. Select the correct event day.
3. Search or browse to the required vehicle category.
4. Open the track list and select the required track.
5. Open the target vehicle record.
6. Start the stopwatch when the run begins.
7. Stop the stopwatch when the run ends.
8. Apply penalties if needed.
9. If the run is valid, press Submit.
10. Complete PIN verification.
11. The record is saved to results and becomes visible in Reports and Leaderboard.

### 6.2 DNS Flow

1. Open the category and track.
2. Find the correct vehicle.
3. Press DNS.
4. Complete PIN verification.
5. The DNS record is saved as a result.

### 6.3 DNF Flow

1. Open the selected vehicle record.
2. Use the DNF controls if the run qualifies as DNF.
3. Select the applicable DNF reason and points path.
4. Submit the record.
5. Complete PIN verification.

### 6.4 Dispute Hold Flow

1. Open the selected vehicle record.
2. Complete stopwatch timing and penalties as required.
3. Press Dispute instead of Submit.
4. Select one or more dispute reasons.
5. Enter details for each selected dispute reason.
6. Press Confirm Dispute.
7. Complete PIN verification.
8. The record is moved into the disputes queue.

### 6.5 Dispute Resolution Flow

1. Open the top-right menu.
2. Open Settings.
3. Enter the settings password if prompted.
4. Open Disputes.
5. Choose the correct category.
6. Choose the correct track.
7. Review the disputed record, including dispute details and remaining timer.
8. Press Resolve Hold.
9. Review the held stopwatch snapshot.
10. Submit the record once resolved.
11. The user is returned to the disputes track page to continue resolving other disputes.

### 6.6 Automatic Dispute Submission Flow

1. A disputed hold is created.
2. The 20-minute countdown starts automatically.
3. The remaining time is visible in Settings, Reports, and Leaderboard.
4. If the dispute is not resolved within 20 minutes, the app automatically submits the record.
5. The item disappears from Disputes and is treated as a final saved result.

### 6.7 Reports Review Flow

1. Open the top-right menu.
2. Open Reports.
3. Select the required category.
4. Select the required track.
5. Review the record table.
6. For disputed items, review the dispute label and remaining auto-submit timer.

### 6.8 Leaderboard Review Flow

1. Open the top-right menu.
2. Open Leaderboard.
3. Select the required category.
4. Review the overall vehicle ranking and total points.
5. Review track-wise day entries for each vehicle.
6. For disputed holds, observe the live remaining timer in the relevant track entry.

### 6.9 Configuration Flow

1. Open Settings.
2. Open Configuration.
3. Select the required day.
4. Activate or deactivate categories for that day.
5. Select a category.
6. Activate or deactivate tracks for that day and category.

### 6.10 Security Management Flow

1. Open Settings.
2. Open Security.
3. Open Pin Verification to review or change the current PIN.
4. Open Change Password to update the settings access password.

## 7. How to Use the App During an Event

### 7.1 Before the Event Starts

- launch the app on the official event device
- confirm the correct day is selected
- open Settings and verify category activation for the day
- verify track activation for the day and category combinations
- verify the correct PIN and password are known to authorized operators
- confirm theme preference for the operating environment

### 7.2 During Live Timing

- keep the app on the correct category and track as long as possible
- open only the current vehicle record when ready to time
- use Submit for clean runs
- use Dispute for runs that need review
- use DNS only for non-start vehicles
- resolve disputes as early as possible to avoid auto-submit

### 7.3 After Runs Are Completed

- open Reports and verify the day-specific records
- open Leaderboard and verify points visibility
- open Settings > Disputes and check that no unresolved holds remain

## 8. Important Operational Notes

### 8.1 PIN-Protected Actions

Submit, DNS, and Confirm Dispute are protected by PIN verification. Operators should keep the PIN available only to authorized staff.

### 8.2 Password-Protected Settings

Settings access is protected by a password. This helps reduce accidental day or track configuration changes during live operations.

### 8.3 Dispute Timers

Each dispute timer is independent. One record expiring does not change the timer of another disputed record.

### 8.4 Day-Specific Data

Reports and disputes are filtered using the selected day. Operators must make sure they are working under the correct day before recording results.

### 8.5 Auto-Submit Behavior

Auto-submit is intended as a fail-safe so that unresolved holds do not remain indefinitely. Operational teams should still resolve disputes manually whenever possible.

## 9. Current Release Scope

This release includes:

- race-day category browsing
- stopwatch and penalties
- DNS and DNF support
- disputes and timed auto-submit
- reports and leaderboard
- admin configuration
- PIN and password security
- theme switching
- responsive tablet-oriented layout improvements

## 10. Quick Start for Operators

1. Open app.
2. Select day.
3. Choose category.
4. Choose track.
5. Open vehicle record.
6. Start stopwatch.
7. Stop stopwatch.
8. Apply penalties if required.
9. Submit or hold under dispute.
10. Review Reports and Leaderboard.

## 11. File and Release Reference

Release file name recommendation:

- TKO_GROUND_ZERO_Release_Document.docx

Source guide maintained in repository:

- docs/TKO_GROUND_ZERO_Release_Document.md

