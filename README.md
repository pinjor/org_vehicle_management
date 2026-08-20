# FleetFlow Pro

MASTER DEVELOPMENT PROMPT

Enterprise Vehicle Request, Dispatch & Fleet Management System

Act as a world-class SaaS product architect, senior full-stack engineer, database architect, UI/UX designer, fleet-management domain expert, security engineer, and QA engineer.

I want you to design and develop a production-grade Enterprise Vehicle Request, Dispatch & Fleet Management System for organizations that own and operate multiple vehicles and drivers.

This must NOT look or behave like a basic CRUD application.

The final application should feel like a combination of:

Enterprise Fleet Management System

Corporate Transport Request System

Intelligent Dispatch Console

Driver Mobile Application

Real-Time Trip Management System

Vehicle Maintenance & Availability System

Google Maps/Uber-style trip visualization

Modern enterprise SaaS dashboard

The application must be:

Premium

Professional

Highly user-friendly

Mobile responsive

Fast

Secure

Role-based

Scalable

API-driven

Production ready

Easy for non-technical employees

Extremely efficient for transport administrators

1. CORE BUSINESS SCENARIO

An organization owns multiple vehicles and employs multiple drivers.

Employees can submit vehicle requests containing:

Journey date

Required pickup time

Expected drop/completion time

Number of passengers

Pickup location

Drop location

Multiple pickup points

Multiple drop points

Round-trip requirement

Return time

Return pickup location

Return destination

Purpose of journey

Department

Project/cost center

Passenger details

Special requirements

Required vehicle type

Remarks

Attachments if necessary

The request is submitted to the Transport/Admin team.

The Transport Admin should immediately see:

Request details

Passenger requirements

Route

Date/time

Estimated distance

Estimated trip duration

Available vehicles

Available drivers

Recommended vehicles

Recommended drivers

Possible conflicts

Vehicle capacity compatibility

Driver shift compatibility

Existing bookings

Vehicle service/maintenance status

The system must intelligently recommend the best vehicle + driver combination.

The administrator reviews the recommendations and assigns a vehicle and driver.

After assignment:

Requester is notified.

Driver is automatically notified.

Trip appears in driver's mobile dashboard.

Driver can see complete route and passenger information.

Driver starts the trip.

Driver reaches pickup location.

Driver confirms arrival.

Driver confirms passenger pickup.

Driver navigates to the next destination.

Driver confirms each route checkpoint.

Driver confirms final drop.

If round trip exists, the return leg starts.

Driver completes the entire trip.

Vehicle becomes available again.

Requester/admin receives completion notification.

2. USER ROLES

Implement proper RBAC.

Main roles:

2.1 Employee / Requester

Can:

Submit vehicle request

Save draft

Edit pending request

Cancel request

View request history

Track approval

View assigned vehicle

View assigned driver

See driver phone number depending on policy

See vehicle registration

View trip route

Track trip status

Add passengers

Add multiple route points

Request round trip

View completed trips

Rate trip/driver if enabled

Submit trip feedback

Receive notifications

2.2 Transport Administrator / Dispatcher

This is one of the most important interfaces.

Can:

View all transport requests

Review pending requests

Approve/reject requests

Assign vehicle

Assign driver

Change vehicle

Change driver

Reassign trip

See available vehicles

See busy vehicles

See unavailable vehicles

See maintenance vehicles

See available drivers

See busy drivers

See unavailable drivers

View scheduling conflicts

View intelligent matching suggestions

View trip calendar

View dispatch board

Track active trips

View driver locations if GPS is enabled

Override recommendations

Manage priority trips

Handle emergencies

Handle vehicle breakdowns

Approve vehicle unavailability/service requests

2.3 Driver

Driver interface should be mobile-first.

Driver can:

View today's assigned trips

View upcoming trips

View trip details

View passenger count

View passenger names

View pickup locations

View multiple stops

View destination

Open navigation

Call requester

Confirm assignment

Mark "Heading to Pickup"

Mark "Arrived at Pickup"

Confirm passenger pickup

Mark checkpoint reached

Confirm passenger drop

Start return trip

Finish trip

Enter odometer start

Enter odometer end

Enter fuel information

Add comments

Report issue

Report accident

Report breakdown

Change availability

Request maintenance/service status

Upload photos where necessary

A driver MUST NOT directly make a vehicle permanently unavailable without administrative governance.

Example:

Driver selects:

"Vehicle Problem / Request Unavailable"

Admin receives approval request.

After admin approval:

Vehicle status becomes:

Unavailable

or

Under Maintenance.

2.4 Fleet Manager

Can manage:

Vehicles

Drivers

Vehicle documents

Maintenance

Insurance

Registration

Tax documents

Fuel

Vehicle assignment

Vehicle categories

Service schedules

Compliance

Expiry alerts

2.5 System Administrator

Full system administration including:

Users

Roles

Permissions

Organization

Departments

Locations

Settings

Notification settings

Workflow configuration

Master data

Audit logs

3. VEHICLE REQUEST FORM

Design a beautiful step-by-step intelligent request experience rather than one giant form.

Suggested workflow:

Step 1 — Journey

Fields:

Request date

Journey date

Pickup time

Expected return/completion time

Trip type

Trip Type:

One Way

Round Trip

Multi Stop

Step 2 — Route

Create a dynamic route builder.

Example:

Pickup

Head Office

↓

Stop 1

Airport

↓

Stop 2

Hotel

↓

Destination

Client Office

Users must be able to:

Add stop

Remove stop

Drag and reorder stops

Select location from map

Search location

Choose office location

Use current location

Save frequently used places

Store:

Location name

Address

Latitude

Longitude

Sequence number

Location type

Expected arrival time

Pickup/drop instruction

Support unlimited logical stops, with a reasonable configured maximum such as 20.

4. ROUND TRIP

Round Trip checkbox:

[ ] Round Trip

When selected show:

Return date

Return pickup time

Return pickup place

Return drop place

Return stops

Expected return completion time

Allow:

Same Route Back

or

Custom Return Route.

5. PASSENGERS

Fields:

Passenger count

Primary passenger

Employee passengers

Guest passengers

Each passenger can contain:

Name

Employee ID

Department

Mobile

Passenger type

Pickup point

Drop point

Special note

The system must validate:

Passenger Count <= Vehicle Capacity.

6. REQUEST PRIORITY

Support:

Normal

Important

High

Emergency

VIP

Priority can influence dispatch recommendations.

Do NOT allow arbitrary employees to abuse Emergency/VIP classifications.

Make priority policy configurable.

7. VEHICLE MASTER DATA

Create detailed vehicle profiles.

Vehicle fields:

Identification

Vehicle ID

Registration number

Fleet number

Vehicle name

Vehicle type

Vehicle category

Brand

Model

Model year

Color

Chassis number

Engine number

Capacity

Seat capacity

Recommended passenger capacity

Luggage capacity

Technical

Fuel type

Transmission

Engine capacity

Mileage

Current odometer

Average mileage

Ownership

Owned

Leased

Rented

Organizational

Company

Branch

Department

Cost center

Primary location

Documents

Registration expiry

Fitness expiry

Insurance expiry

Tax token expiry

Route permit expiry

Operational status

Available

Reserved

Assigned

En Route

Occupied

Returning

Unavailable

Under Maintenance

Out of Service

Accident

Retired

Vehicle profile should show:

Photo

Current driver

Today's schedule

Upcoming assignments

Maintenance status

Recent trips

Documents

Odometer

Fuel statistics

8. DRIVER MASTER DATA

Driver profile fields:

Driver ID

Employee ID

Full name

Photo

Mobile

Alternate phone

Address

Date of joining

Driver category

License number

License type

License issue date

License expiry

Allowed vehicle categories

Years of experience

Emergency contact

Blood group

Assigned base location

Shift

Weekly off days

Current assigned vehicle

Current status

Driver statuses:

Available

Reserved

Driving

Break

Off Duty

Leave

Unavailable

Suspended

Show:

Today's assignments

Future assignments

Trip history

Current availability

License warning

Ratings

Incidents

9. VEHICLE + DRIVER INTELLIGENT MATCHING ENGINE

This is a CRITICAL feature.

Whenever Admin opens a vehicle request, display:

Recommended Matches

Automatically analyze available vehicles and drivers.

Check:

Vehicle availability

Vehicle must not have overlapping trip assignment.

Calculate using:

requested pickup datetime

through

estimated trip completion datetime

including configurable buffer time.

Vehicle suitability

Analyze:

Passenger count vs capacity

Requested vehicle category

Distance

Trip duration

Road/location compatibility

VIP requirement

Accessibility requirement

Luggage requirement

Air-conditioning requirement

Special request

Vehicle location

Prefer vehicles close to the pickup location.

Maintenance

Exclude:

Under maintenance

Out of service

Breakdown

Expired mandatory documents if policy requires

Driver availability

Driver cannot:

Have overlapping trip

Be on leave

Be off duty

Be unavailable

Have an expired license

Drive an unauthorized vehicle category

10. MATCH SCORE

Create a transparent recommendation score.

Example:

Toyota Hiace

Match Score: 96%

Reasons:

✓ Available at requested time
✓ 12 seats for 8 passengers
✓ Driver available
✓ Only 1.8 km from pickup
✓ No maintenance issues
✓ No schedule conflict

Potential warning:

⚠ Another assignment begins 90 minutes after expected trip completion.

Suggested scoring framework:

Availability: 30%

Capacity Fit: 20%

Location Proximity: 15%

Driver Compatibility: 15%

Schedule Buffer: 10%

Vehicle Preference: 5%

Operational Efficiency: 5%

Make scoring weights configurable by administrators.

Never hide why a recommendation was generated.

11. MATCHING SCREEN

For every request show:

Best Match

Vehicle

Toyota Hiace

12 Seats

Available

1.8 km away

Driver

Rahim Ahmed

Available

Match

96%

[Assign]

Then:

Other Suitable Matches

Display 3-10 alternatives.

Admin can filter by:

Vehicle type

Seat capacity

Branch

Distance

Driver

Availability

Vehicle condition

12. AVAILABILITY BOARD

Create a visual Fleet Availability dashboard.

Top summary:

Available Vehicles — 18

Assigned — 9

Active Trips — 7

Maintenance — 3

Unavailable — 2

Drivers Available — 16

Drivers Driving — 8

Drivers Off Duty — 4

Create cards/table showing:

Vehicle

Driver

Status

Current Trip

Next Booking

Available From

Current Location

Capacity

Maintenance Status

Actions

13. DISPATCH BOARD

Create a premium dispatch board similar to airline/transport operations.

Columns could be:

New Requests

Awaiting Approval

Approved

Assigned

Driver Confirmed

Heading to Pickup

Passenger Onboard

At Destination

Return Journey

Completed

Allow drag/drop only when business rules permit.

14. SCHEDULING CALENDAR

Provide:

Day

Week

Month

Vehicle timeline

Driver timeline

Example:

Vehicle | 8AM | 9AM | 10AM | 11AM | 12PM

Visualize assignments.

Conflicts should appear prominently.

15. TRIP STATE MACHINE

Do NOT handle trip statuses as random strings.

Implement controlled workflow.

Suggested:

DRAFT

→ SUBMITTED

→ UNDER_REVIEW

→ APPROVED

→ VEHICLE_ASSIGNED

→ DRIVER_ASSIGNED

→ DRIVER_CONFIRMED

→ HEADING_TO_PICKUP

→ ARRIVED_PICKUP

→ PASSENGER_PICKED_UP

→ IN_TRANSIT

→ STOP_REACHED

→ DESTINATION_REACHED

→ PASSENGER_DROPPED

→ RETURN_PENDING

→ RETURN_IN_TRANSIT

→ COMPLETED

Additional:

REJECTED

CANCELLED

NO_SHOW

BREAKDOWN

EMERGENCY_STOP

REASSIGNMENT_REQUIRED

16. DRIVER TRIP SCREEN

Make this extremely easy to operate while on a phone.

Show:

Trip #VR-2026-001284

Pickup Time

08:30 AM

Passenger

Md. Karim

Passengers

5

Vehicle

Toyota Hiace

Registration

Dhaka Metro-Cha-00-0000

Then show visual route:

Head Office

↓

Airport

↓

Hotel

↓

Customer Office

Primary CTA should change based on state.

Example:

[START HEADING TO PICKUP]

then

[I HAVE ARRIVED]

then

[CONFIRM PASSENGER PICKUP]

then

[NAVIGATE]

then

[CONFIRM STOP]

then

[CONFIRM FINAL DROP]

then

[COMPLETE TRIP]

Large touch-friendly buttons.

17. MAP INTEGRATION

Integrate architecture suitable for:

Google Maps
or

Mapbox

Features:

Address autocomplete

Geocoding

Reverse geocoding

Route plotting

Multiple waypoints

Distance calculation

ETA calculation

Driver navigation

Current location

Optional live vehicle tracking

Route deviation tracking

Estimated arrival time

Do not hard-code Google Maps-specific business logic into domain services. Abstract the map provider.

18. VEHICLE UNAVAILABILITY WORKFLOW

Driver can report:

Vehicle issue

Mechanical problem

Tire issue

Battery issue

Accident

General maintenance required

Cleaning required

Other

Driver enters:

Reason

Description

Severity

Photos

Current location

Status:

PENDING ADMIN APPROVAL

Admin receives notification.

Admin chooses:

Approve Unavailable

Send to Maintenance

Reject Request

Request More Information

When approved, vehicle disappears from available dispatch results.

19. BREAKDOWN DURING ACTIVE TRIP

Handle this professionally.

If driver selects:

"Vehicle Breakdown"

System should:

Mark trip as disrupted.

Notify Transport Admin.

Record vehicle location.

Recommend replacement vehicles.

Recommend replacement drivers if required.

Preserve passenger/route data.

Allow one-click reassignment.

Notify requester.

Notify replacement driver.

Maintain full incident audit history.

20. REQUEST APPROVAL WORKFLOW

Make workflow configurable.

Possible:

Employee

→ Line Manager

→ Department Head

→ Transport Admin

or simply:

Employee

→ Transport Admin

depending organization settings.

Support approval thresholds based on:

Department

Request type

Priority

Vehicle category

Trip distance

Outside-city travel

21. NOTIFICATION ENGINE

Support architecture for:

In-app

Push notification

Email

SMS

WhatsApp integration later

Notifications include:

Request Submitted

Request Approved

Request Rejected

Vehicle Assigned

Driver Assigned

Driver Changed

Vehicle Changed

Driver Heading to Pickup

Driver Arrived

Passenger Picked Up

Trip Completed

Vehicle Breakdown

Vehicle Unavailability

Maintenance Approval

Document Expiry

Upcoming Trip

22. REQUESTER LIVE STATUS

Requester should see a beautiful tracking timeline.

Example:

✓ Request Submitted

✓ Admin Approved

✓ Vehicle Assigned

✓ Driver Assigned

✓ Driver Confirmed

● Driver Heading to Pickup

○ Arrived

○ Passenger Pickup

○ Destination

○ Completed

Display driver/vehicle card once assigned.

23. DASHBOARD

Create role-specific dashboards.

Transport Admin Dashboard

KPI cards:

Requests Today

Pending Approval

Trips Today

Active Trips

Completed Trips

Available Vehicles

Available Drivers

Vehicles Under Maintenance

Upcoming Requests

Delayed Trips

Charts:

Trips by department

Vehicle utilization

Monthly trip trend

Vehicle category usage

Driver utilization

Request status

On-time pickup %

Trip completion %

Maintenance trend

Sections:

Active Trips Map

Upcoming Dispatches

Pending Requests

Vehicles Needing Attention

Document Expiries

24. FLEET UTILIZATION

Calculate:

Vehicle utilization %

Driver utilization %

Average trip duration

Average idle time

Distance traveled

Trips per vehicle

Trips per driver

Vehicle downtime

Cancellation rate

Approval turnaround time

On-time pickup percentage

25. FUEL MANAGEMENT — PREPARE ARCHITECTURE

Support optional future module:

Fuel issue

Fuel station

Fuel quantity

Cost

Odometer

Fuel receipt

Mileage

Cost/km

Vehicle fuel efficiency

26. MAINTENANCE MODULE

Support:

Preventive maintenance

Corrective maintenance

Service schedule

Maintenance request

Workshop

Vendor

Spare parts

Maintenance cost

Odometer-based service

Date-based service

Maintenance history

Examples:

Oil change every 5,000 km

Service every 10,000 km

Fitness expiry alert

Insurance expiry alert

27. DATABASE DESIGN

Design a proper relational database.

At minimum consider entities:

organizations

branches

departments

cost_centers

users

roles

permissions

user_roles

employees

locations

vehicle_categories

vehicle_types

vehicles

vehicle_documents

vehicle_status_history

drivers

driver_documents

driver_vehicle_permissions

driver_shifts

driver_availability

vehicle_requests

request_passengers

request_route_points

request_approvals

vehicle_assignments

driver_assignments

trips

trip_legs

trip_stops

trip_status_history

trip_events

driver_locations

vehicle_locations

vehicle_unavailability_requests

maintenance_requests

maintenance_jobs

vehicle_maintenance_history

incidents

notifications

notification_preferences

attachments

audit_logs

system_settings

Create appropriate:

Foreign keys

Unique constraints

Indexes

Composite indexes

Check constraints

Soft deletion where required

created_at

created_by

updated_at

updated_by

version columns where concurrency matters

28. IMPORTANT SCHEDULING DATA MODEL

Avoid using only:

vehicle.available = true/false.

Availability must be calculated using:

Current operational status

Existing assignments

Reservation time

Trip start/end

Maintenance

Temporary blocking

Driver schedules

Leave

Document validity

Create an availability engine.

29. PREVENT DOUBLE BOOKING

This is CRITICAL.

The backend must guarantee that two admins cannot simultaneously assign the same vehicle or driver for overlapping times.

Do NOT depend only on frontend validation.

Implement proper transaction/concurrency protection.

Validate vehicle and driver availability again inside the database transaction immediately before assignment.

Where supported, use:

Database transaction

Appropriate locking

Optimistic/pessimistic concurrency control

Exclusion constraints or equivalent scheduling safeguards

Return useful conflict information.

30. REQUEST NUMBERING

Generate identifiers such as:

VR-2026-000001

Trip:

TR-2026-000001

Maintenance:

MT-2026-000001

Incident:

INC-2026-000001

Generate safely server-side.

31. AUDIT TRAIL

Every important event must be logged.

Examples:

Request created

Request edited

Request approved

Vehicle assigned

Vehicle changed

Driver assigned

Driver changed

Status changed

Pickup confirmed

Drop confirmed

Trip completed

Vehicle unavailable

Maintenance status changed

Store:

User

Timestamp

Old value

New value

Entity

IP

Device information where appropriate

32. UI/UX DESIGN SYSTEM

Create a premium modern SaaS experience.

Visual direction:

Clean enterprise aesthetic

Spacious layout

Rounded cards

Subtle borders

Premium typography

Professional iconography

Excellent whitespace

Strong visual hierarchy

Data-rich without becoming cluttered

Responsive

Accessible

Avoid:

Excessive gradients

Giant empty cards

Random colors

Overusing shadows

Cartoon UI

Generic Bootstrap appearance

Huge forms on one page

Recommended visual style:

Light background

Dark navy/slate primary text

Professional blue/indigo primary accent

Emerald for available/success

Amber for warning

Red for danger/unavailable

Neutral gray for inactive data

Build reusable design tokens rather than hardcoding styles.

33. DESKTOP LAYOUT

Main sidebar:

Dashboard

Vehicle Requests

Dispatch Board

Live Trips

Schedule

Fleet

Drivers

Maintenance

Reports

Notifications

Administration

Settings

Bottom:

User profile

34. MOBILE DRIVER NAVIGATION

Bottom navigation:

Home

Trips

Navigation

Alerts

Profile

Do not simply shrink the desktop admin interface for drivers.

Create a dedicated mobile experience.

35. REQUEST LIST

Columns:

Request #

Requester

Department

Journey Date

Pickup Time

Route

Passengers

Priority

Requested Vehicle

Status

Recommended Match

Actions

Filters:

Today

Tomorrow

This Week

Pending

Approved

Assigned

Active

Completed

Cancelled

Department

Requester

Vehicle

Driver

36. REQUEST DETAIL SCREEN

Use a command-center style layout.

Header:

Request #

Status

Priority

Requester

Created Time

Buttons:

Approve

Reject

Assign

Edit Assignment

More

Main sections:

Journey Summary

Route Map

Passengers

Requirements

Approval History

Recommended Matches

Existing Assignment

Status Timeline

Activity/Audit Log

37. ASSIGNMENT DRAWER

When admin clicks:

Assign Vehicle

Open premium side drawer/modal.

Show:

REQUEST REQUIREMENTS

8 passengers

Airport Transfer

08:30 → 12:00

Then:

RECOMMENDED

Toyota Hiace

96% Match

Driver: Rahim

[Assign]

Other available combinations below.

Admin can manually select another vehicle/driver.

38. SEARCH

Global search:

Vehicle Registration

Driver

Employee

Request #

Trip #

Department

Phone

Support autocomplete.

39. REPORTS

Create reporting architecture for:

Vehicle Request Register

Vehicle Utilization

Driver Utilization

Trip Register

Department-wise Transport Usage

Cost Center Usage

Vehicle Trip History

Driver Trip History

Vehicle Downtime

Vehicle Availability

Maintenance History

Fuel Consumption

Document Expiry

Cancelled Requests

Delayed Pickups

Trip Distance

Monthly Fleet KPI

Allow:

Date range

Department

Branch

Vehicle

Driver

Status

Export:

Excel

CSV

PDF

Print

40. SECURITY

Implement:

Authentication

Authorization

RBAC

Secure password management

JWT/session best practices depending architecture

API authorization

Object-level access control

Input validation

Rate limiting

CSRF protection where applicable

XSS protection

SQL injection prevention

Secure uploads

Audit logging

Refresh token security if JWT is used

Environment-based secret management

Never expose sensitive secrets to frontend.

41. API ARCHITECTURE

Build clean REST APIs or use the existing project's API conventions.

Examples:

POST /requests

GET /requests

GET /requests/:id

PATCH /requests/:id

POST /requests/:id/submit

POST /requests/:id/approve

POST /requests/:id/reject

GET /requests/:id/matches

POST /requests/:id/assign

POST /requests/:id/reassign

POST /requests/:id/cancel

GET /vehicles/availability

GET /drivers/availability

GET /trips/:id

POST /trips/:id/start

POST /trips/:id/arrive-pickup

POST /trips/:id/pickup

POST /trips/:id/complete-stop

POST /trips/:id/drop

POST /trips/:id/complete

POST /vehicles/:id/unavailability-request

POST /maintenance/requests

Use:

Request DTO validation

Service layer

Repository/data layer

Domain services

Central error handling

Consistent API responses

42. MATCHING API

Example:

GET /requests/{id}/recommendations

Response concept:

{
"requestId": 1234,
"recommended": [
{
"vehicle": {},
"driver": {},
"score": 96,
"reasons": [],
"warnings": [],
"estimatedDistanceToPickup": 1.8,
"availableUntil": "...",
"nextAssignment": {}
}
]
}

Do not hard-code recommendation data.

Compute from actual master/schedule data.

43. REAL-TIME ARCHITECTURE

Where practical use:

WebSockets / Server-Sent Events / real-time infrastructure

for:

Trip status

Admin dispatch dashboard

Driver assignment

Vehicle availability

Driver availability

Notifications

Location tracking

But provide graceful fallback if real-time channel disconnects.

44. OFFLINE DRIVER SUPPORT

Prepare driver workflows for unstable mobile internet.

Critical actions can be queued:

Arrived

Pickup Confirmed

Drop Confirmed

Trip Complete

When network returns:

Synchronize safely.

Do not allow duplicate events.

Use idempotency keys.

45. GPS PRIVACY

If driver live tracking is implemented:

Do not track a driver continuously 24/7 by default.

Tracking should normally operate during:

Scheduled active assignment window

Heading to pickup

Active trip

Make tracking behavior configurable according to organizational/legal requirements.

46. TECHNOLOGY

If this is a new application, use a modern production-grade stack.

Preferred frontend:

React / Next.js

TypeScript

Tailwind CSS

shadcn/ui or equivalent

TanStack Query

React Hook Form

Zod

Modern data tables

Recharts

Map abstraction compatible with Google Maps/Mapbox

Backend can use whichever robust architecture best fits the project, for example:

NestJS + PostgreSQL

or

FastAPI + PostgreSQL

Use:

Redis where beneficial

Background job queue for notifications

WebSocket/SSE where beneficial

If I already have an existing codebase:

DO NOT blindly replace its architecture.

First inspect:

package files

folder structure

existing components

database

API patterns

authentication

theme

coding conventions

Then integrate this system into that architecture.

47. CODE QUALITY REQUIREMENTS

Do NOT:

Put entire application in one component

Hardcode fake records throughout production code

Use any unnecessarily

Duplicate business logic

Mix UI/business/database logic

Ignore validation

Fake API calls when real backend exists

Create huge 2,000-line components

Store critical scheduling logic only in frontend

Create reusable modules.

Suggested frontend domains:

features/requests

features/dispatch

features/trips

features/vehicles

features/drivers

features/maintenance

features/maps

features/notifications

features/reports

features/settings

48. BACKEND DOMAIN SERVICES

Create services such as:

VehicleAvailabilityService

DriverAvailabilityService

FleetMatchingService

DispatchService

TripLifecycleService

RouteService

NotificationService

MaintenanceService

ConflictDetectionService

AuditService

Do not put all business logic into controllers.

49. VALIDATION RULES

Examples:

Pickup must be before expected completion.

Passenger count must be > 0.

Vehicle capacity must support passenger count.

Driver must possess valid license.

Driver must support vehicle category.

Vehicle must not be under maintenance.

Vehicle documents must satisfy policy.

Driver cannot have overlapping assignment.

Vehicle cannot have overlapping assignment.

A completed trip cannot return to active without privileged correction.

Cancellation after pickup requires admin privileges.

Pickup/drop confirmation must follow valid state transitions.

Round-trip return time must make chronological sense.

50. EDGE CASES

Explicitly handle:

Vehicle becomes unavailable after assignment.

Driver calls sick.

Driver rejects assignment.

Trip delayed.

Passenger increases after vehicle assignment.

Passenger decreases.

Route changes.

Additional stop added.

Pickup time changes.

Trip runs longer than expected.

Next vehicle booking becomes at risk.

Vehicle breakdown.

Driver loses internet connection.

Admin accidentally tries duplicate assignment.

Vehicle documents expire.

Driver license expires.

Requester cancels after approval.

Requester cancels after driver dispatch.

Emergency reassignment.

Driver confirms wrong checkpoint.

Trip spans midnight.

Multi-day trip.

Outstation journey.

51. CONFLICT ALERT

If an active trip is running late and threatens the next assignment:

Admin dashboard should show:

⚠ Schedule Conflict Risk

Vehicle:

Toyota Hiace

Current trip expected completion:

3:45 PM

Next assignment:

4:00 PM

Recommended action:

Reassign next request.

Provide:

[View Alternatives]

52. SMART OPERATIONAL FEATURES

Implement or architect for:

Smart Vehicle Recommendation

Already described.

Smart Driver Recommendation

Based on:

Availability

Distance

Shift

Vehicle permission

Current workload

Previous hours driven

Return Trip Optimization

If a vehicle is returning empty and another nearby employee request exists, architecture should eventually support recommendations.

Fleet Load Forecast

Show expected:

Morning peak

Afternoon peak

Evening peak

Vehicle shortages

Driver shortages

53. REQUEST DUPLICATION

Allow:

"Request Again"

for previous trips.

Pre-fill:

Route

Passenger info

Purpose

Vehicle preference

But require new date/time.

54. FAVORITE ROUTES

Employee can save:

Home → Head Office

Head Office → Airport

Head Office → Factory

etc.

55. ORGANIZATION LOCATIONS

Admin can define known locations:

Head Office

Factory

Warehouse

Airport

Branch Office

Customer Site

Use them in location autocomplete.

56. COMMAND CENTER

Admin dashboard should have a section:

Transport Operations Now

Example:

7 Active Trips

3 Drivers Heading to Pickup

2 Awaiting Pickup

18 Vehicles Available

4 Requests Need Assignment

2 Trips At Risk

Clicking any KPI should filter operational data immediately.

57. NOTIFICATION CENTER

Create notification bell.

Categories:

Request

Assignment

Trip

Maintenance

Compliance

Emergency

Support:

Unread/read

Mark all read

Deep link to relevant record.

58. EMPTY / LOADING / ERROR STATES

Create polished:

Skeleton loaders

Empty states

Error states

Retry buttons

Do NOT show blank pages or raw API errors.

59. ACCESSIBILITY

Use:

Keyboard navigation

Proper labels

ARIA where necessary

Readable contrast

Focus states

Touch-friendly controls

Do not depend only on color to communicate status.

60. RESPONSIVE BEHAVIOR

Desktop admin experience:

Optimized for 1440px+ but fully usable at laptop sizes.

Tablet:

Adaptive dispatch experience.

Mobile:

Employee request and driver experience optimized.

61. TESTING

Create:

Unit tests

API tests

Integration tests

Critical E2E tests

Important scenarios:

Employee submits multi-stop request.

Employee submits round trip.

Admin receives request.

Matching system recommends valid vehicle.

Busy vehicle excluded.

Maintenance vehicle excluded.

Insufficient capacity excluded.

Busy driver excluded.

Expired driver license excluded.

Admin assigns recommendation.

Two admins cannot double-book vehicle.

Driver receives trip.

Driver confirms pickup.

Driver completes multiple stops.

Driver confirms drop.

Round trip completes.

Vehicle becomes available.

Driver reports vehicle issue.

Admin approves unavailable status.

Unavailable vehicle excluded from future recommendations.

Breakdown triggers reassignment workflow.

62. SEED DATA

For development create realistic seed records:

25 vehicles

30 drivers

100 employees

8 departments

5 vehicle categories

Multiple branches

Historical trips

Future bookings

Maintenance records

Requests in various statuses

Do not use meaningless names such as:

Test User 1

Car 1

Driver 1

Use realistic enterprise sample data.

63. INITIAL SCREENS TO BUILD

Build in this sequence:

Phase 1

Authentication

Application shell

RBAC

Master data architecture

Phase 2

Employee Vehicle Request

Request List

Request Detail

Multi-stop Route Builder

Phase 3

Vehicle Master

Driver Master

Availability Engine

Phase 4

Admin Dispatch Dashboard

Recommendation Engine

Vehicle/Driver Assignment

Scheduling Calendar

Phase 5

Driver Mobile App

Trip State Machine

Pickup/Drop Confirmation

Phase 6

Notifications

Maps

Trip Tracking

Phase 7

Vehicle Unavailability

Maintenance

Incident/Breakdown

Phase 8

Analytics

Reports

Operational dashboards

64. DEVELOPMENT PROCESS

Before coding:

Analyze existing repository.

Understand existing architecture.

List reusable components.

Identify missing backend/database components.

Define data model.

Define state transitions.

Define API contracts.

Define RBAC.

Define implementation plan.

Then begin implementation.

Do NOT create another disconnected application inside the repository.

65. DO NOT STOP AT MOCKUP

This instruction is critical.

Do not only make attractive screens.

Every UI action must eventually connect to:

UI

→ validation

→ API

→ business service

→ database

→ audit

→ notification/event

where applicable.

Examples:

Assign Vehicle

must actually validate availability and save assignment.

Driver Pickup

must change trip state and record event.

Vehicle Unavailable

must alter availability after correct workflow.

66. UX PHILOSOPHY

A transport administrator should be able to answer these questions in under five seconds:

Which requests need my attention?

Which vehicles are available?

Which drivers are available?

What vehicle should I assign to this request?

Which trips are currently active?

Where are potential schedule conflicts?

Which vehicles have problems?

Which upcoming requests have no assignment?

Design the application around these questions.

67. REQUESTER UX PHILOSOPHY

An employee should be able to submit a standard vehicle request in approximately one minute or less.

Use:

Smart defaults

Saved locations

Favorite routes

Employee auto-fill

Previous-trip reuse

Progressive disclosure

Do not overwhelm the requester with fleet administration data.

68. DRIVER UX PHILOSOPHY

Driver should never need to search through complex menus while working.

The driver's home page should immediately show:

NEXT TRIP

Pickup Time

Pickup Place

Passenger

Vehicle

Route

and one obvious primary action.

69. PREMIUM DETAILS

Add thoughtful touches such as:

Relative time:

"Pickup in 38 minutes"

Availability:

"Available until 4:30 PM"

Schedule:

"Next trip in 2h 15m"

Recommendation:

"Best Match"

Conflict:

"Low buffer — 20 min"

Driver:

"2 trips today"

Vehicle:

"Last service 12 days ago"

These micro-details make the system feel intelligent.

70. FINAL DELIVERY EXPECTATION

I want a complete working Vehicle Request & Fleet Dispatch platform, not just isolated CRUD screens.

The system must revolve around four central engines:

1. Request Engine

Employee journey requirements.

2. Availability Engine

What vehicles/drivers can actually serve the request.

3. Matching & Dispatch Engine

Which available combination is the best operational choice.

4. Trip Execution Engine

What happens after assignment until passengers reach their destination and the vehicle becomes available again.

Everything else should support these engines.

71. STARTING INSTRUCTION

Start by inspecting the existing project.

Then provide a short internal implementation checklist and immediately begin implementing.

If something is not yet available, make the most professional architecture decision rather than building a fake shortcut.

Keep the current application working while implementing the new module.

After each major module:

Build

Type check

Run tests

Fix errors

Check responsive UI

Check permissions

Check loading/error states

Verify API integration

Verify scheduling rules

Continue until the complete workflow works end-to-end:

EMPLOYEE REQUEST

→ APPROVAL

→ SMART VEHICLE/DRIVER MATCHING

→ ASSIGNMENT

→ DRIVER NOTIFICATION

→ DRIVER HEADS TO PICKUP

→ ARRIVAL

→ PASSENGER PICKUP

→ MULTI-STOP JOURNEY

→ PASSENGER DROP

→ ROUND TRIP IF REQUIRED

→ TRIP COMPLETION

→ VEHICLE/DRIVER AVAILABLE AGAIN

→ REPORTING + AUDIT HISTORY.

The quality bar should be comparable to a polished commercial enterprise SaaS product, not a university project, proof-of-concept, or generic admin template.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/5ab44e50-e575-4b1a-9c4f-f41146ef3c3c).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
